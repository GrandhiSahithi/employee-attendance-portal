import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser } from '../utils/serializers.js';
import { isAllowedEmail, isDevEmail, isGmailEmail, issueOtp, normalizeEmail, verifyOtp } from '../utils/otp.js';

const router = Router();

function issueToken(user) {
  return jwt.sign(
    { role: user.role, employeeId: user.employeeId },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: '8h' },
  );
}

function emailRuleMessage() {
  return 'Use either a @dev.com company email or a @gmail.com email.';
}

async function validateSupervisorForSignup(role, supervisorId) {
  if (role === 'HEAD_MANAGER') return null;
  if (!supervisorId) throw new Error(role === 'MANAGER' ? 'Select a Head Manager.' : 'Select a Manager.');
  const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
  if (!supervisor || !supervisor.isActive) throw new Error('Selected supervisor is unavailable.');
  if (role === 'MANAGER' && supervisor.role !== 'HEAD_MANAGER') throw new Error('A Manager must report to a Head Manager.');
  if (role === 'EMPLOYEE' && supervisor.role !== 'MANAGER') throw new Error('An Employee must report to a Manager.');
  return supervisor;
}

router.get('/setup-status', async (_req, res) => {
  const count = await prisma.user.count();
  res.json({ needsSetup: count === 0 });
});

router.get('/signup-options', async (_req, res) => {
  const [count, departments, teams, heads, managers] = await Promise.all([
    prisma.user.count(),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.team.findMany({ include: { department: true }, orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }] }),
    prisma.user.findMany({ where: { role: 'HEAD_MANAGER', isActive: true }, select: { id: true, name: true, employeeId: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { role: 'MANAGER', isActive: true }, select: { id: true, name: true, employeeId: true, supervisorId: true }, orderBy: { name: 'asc' } }),
  ]);
  res.json({ needsSetup: count === 0, departments, teams, heads, managers });
});

const otpEmailSchema = z.object({ email: z.string().email() });

const publicSignupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  employeeId: z.string().trim().min(2).max(40),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().trim().max(30).optional().nullable(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HEAD_MANAGER']),
  jobTitle: z.string().trim().min(2).max(100),
  departmentId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  supervisorId: z.string().optional().nullable(),
  departmentName: z.string().trim().min(2).max(80).optional().nullable(),
  teamName: z.string().trim().min(2).max(80).optional().nullable(),
});

router.post('/signup', async (req, res) => {
  const parsed = publicSignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Enter valid signup details.' });
  const data = parsed.data;
  const email = normalizeEmail(data.email);
  if (!isAllowedEmail(email)) return res.status(400).json({ message: emailRuleMessage() });

  const duplicate = await prisma.user.findFirst({ where: { OR: [{ email }, { employeeId: data.employeeId.trim() }] } });
  if (duplicate) return res.status(409).json({ message: 'That email or employee ID is already registered. Use a unique value.' });

  const userCount = await prisma.user.count();
  try {
    const passwordHash = await bcrypt.hash(data.password, 12);
    let user;

    if (userCount === 0) {
      if (!data.departmentName || !data.teamName) return res.status(400).json({ message: 'Department and team are required for the first account.' });
      user = await prisma.$transaction(async (tx) => {
        const department = await tx.department.create({ data: { name: data.departmentName.trim() } });
        const team = await tx.team.create({ data: { name: data.teamName.trim(), departmentId: department.id } });
        return tx.user.create({
          data: {
            name: data.name.trim(),
            employeeId: data.employeeId.trim(),
            email,
            emailVerified: true,
            passwordHash,
            phone: data.phone?.trim() || null,
            role: 'HEAD_MANAGER',
            jobTitle: data.jobTitle.trim(),
            departmentId: department.id,
            teamId: team.id,
            supervisorId: null,
            availableLeaveDays: 25,
          },
          include: { department: true, team: true, supervisor: true },
        });
      });
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'INITIAL_ORGANIZATION_SETUP',
          targetType: 'User',
          targetId: user.id,
          details: `${user.name} created the first Head Manager account`,
        },
      });
    } else {
      if (!data.departmentId || !data.teamId) return res.status(400).json({ message: 'Select a department and team.' });
      const team = await prisma.team.findUnique({ where: { id: data.teamId } });
      if (!team || team.departmentId !== data.departmentId) return res.status(400).json({ message: 'Selected team must belong to the selected department.' });
      try {
        await validateSupervisorForSignup(data.role, data.supervisorId);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }

      user = await prisma.user.create({
        data: {
          name: data.name.trim(),
          employeeId: data.employeeId.trim(),
          email,
          emailVerified: true,
          passwordHash,
          phone: data.phone?.trim() || null,
          role: data.role,
          jobTitle: data.jobTitle.trim(),
          departmentId: data.departmentId,
          teamId: data.teamId,
          supervisorId: data.role === 'HEAD_MANAGER' ? null : data.supervisorId,
          availableLeaveDays: data.role === 'HEAD_MANAGER' ? 25 : data.role === 'MANAGER' ? 22 : 20,
        },
        include: { department: true, team: true, supervisor: true },
      });
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'SELF_SIGNUP',
          targetType: 'User',
          targetId: user.id,
          details: `${user.name} created a ${user.role} account using ${isDevEmail(email) ? 'company' : 'Gmail'} email`,
        },
      });
    }

    if (signupOtpRecord) {
      await prisma.otpCode.update({ where: { id: signupOtpRecord.id }, data: { usedAt: new Date() } });
    }
    res.status(201).json({ message: 'Account created successfully.', token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Email, employee ID, department, or team already exists. Use unique values.' });
    }
    throw error;
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and a password with at least 8 characters.' });
  const email = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findUnique({ where: { email }, include: { department: true, team: true, supervisor: true } });
  if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid email or password.' });
  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' });
  res.json({ token: issueToken(user), user: publicUser(user) });
});

router.post('/forgot-password/request', async (req, res) => {
  const parsed = otpEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email address.' });
  const email = normalizeEmail(parsed.data.email);
  if (!isAllowedEmail(email)) return res.status(400).json({ message: emailRuleMessage() });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.status(404).json({ message: 'No active account was found for that email.' });

  if (isDevEmail(email)) {
    return res.json({ mode: 'DEV', message: 'For @dev.com accounts, confirm your Employee ID and choose a new password.' });
  }

  try {
    const { expiresAt } = await issueOtp(email, 'PASSWORD_RESET');
    return res.json({ mode: 'GMAIL', message: 'A password-reset code was sent to your Gmail address.', expiresAt });
  } catch (error) {
    if (error.code === 'EMAIL_NOT_CONFIGURED') return res.status(503).json({ message: error.message });
    throw error;
  }
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
  employeeId: z.string().trim().optional().nullable(),
});

router.post('/forgot-password/reset', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and a new password with at least 8 characters.' });
  const email = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.status(404).json({ message: 'No active account was found for that email.' });

  if (isDevEmail(email)) {
    if (!parsed.data.employeeId || parsed.data.employeeId.trim() !== user.employeeId) {
      return res.status(400).json({ message: 'Enter the Employee ID linked to this @dev.com account.' });
    }
  } else if (isGmailEmail(email)) {
    if (!parsed.data.otp) return res.status(400).json({ message: 'Enter the 6-digit code sent to your Gmail address.' });
    const verified = await verifyOtp(email, 'PASSWORD_RESET', parsed.data.otp);
    if (!verified.ok) return res.status(400).json({ message: verified.message });
  } else {
    return res.status(400).json({ message: emailRuleMessage() });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'PASSWORD_RESET', targetType: 'User', targetId: user.id, details: `Password reset for ${email}` },
  });
  res.json({ message: 'Password changed successfully. You can now sign in.' });
});

router.get('/me', requireAuth, async (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
