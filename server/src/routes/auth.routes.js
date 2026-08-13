/**
 * Authentication Routes
 * ====================
 * Handles user authentication including:
 * - Account signup (first user setup and new user registration)
 * - User login with email/password
 * - Password recovery via forgot password flow
 * - Get current user info
 */

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

/**
 * Issue JWT token for a user
 * Token includes role and employeeId, expires in 8 hours
 * @param {object} user - User object from database
 * @returns {string} JWT token
 */
function issueToken(user) {
  return jwt.sign(
    { role: user.role, employeeId: user.employeeId },
    process.env.JWT_SECRET,
    { subject: user.id, expiresIn: '8h' },
  );
}

/**
 * Email rule validation message
 */
function emailRuleMessage() {
  return 'Use either a @dev.com company email or a @gmail.com email.';
}

/**
 * Validate manager selection for a public Employee signup.
 * Public signup can only ever create an Employee reporting to an existing
 * Manager - creating a new Manager/Head Manager account (and the new team
 * that comes with it) is an authorized-admin-only action, see
 * management.routes.js.
 */
async function validateManagerForSignup(supervisorId) {
  if (!supervisorId) throw new Error('Select a Manager.');
  const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
  if (!supervisor || !supervisor.isActive || supervisor.role !== 'MANAGER') throw new Error('Selected manager is unavailable.');
  return supervisor;
}

/**
 * GET /setup-status
 * Check if organization needs initial setup (no users yet)
 */
router.get('/setup-status', async (_req, res) => {
  const count = await prisma.user.count();
  res.json({ needsSetup: count === 0 });
});

/**
 * GET /signup-options
 * Get all available options for the public signup form (Employee accounts
 * only, post-bootstrap):
 * - All departments (independent of Manager/Team)
 * - All active Managers, each carrying the team they lead
 */
router.get('/signup-options', async (_req, res) => {
  const [count, departments, managers] = await Promise.all([
    prisma.user.count(),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { role: 'MANAGER', isActive: true },
      select: { id: true, name: true, employeeId: true, team: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);
  res.json({
    needsSetup: count === 0,
    departments,
    managers: managers.map((manager) => ({
      id: manager.id,
      name: manager.name,
      employeeId: manager.employeeId,
      teamId: manager.team?.id || null,
      teamName: manager.team?.name || null,
    })),
  });
});

/**
 * Validation schema for email input
 */
const otpEmailSchema = z.object({ email: z.string().email() });

/**
 * Validation schema for public signup.
 * Supports creating the first account (bootstraps a department, team, and
 * Head Manager) or an Employee account reporting to an existing Manager.
 * Public signup can never create a Manager/Head Manager or a new team -
 * only an authorized admin can (see management.routes.js).
 */
const publicSignupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  employeeId: z.string().trim().min(2).max(40),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().trim().max(30).optional().nullable(),
  jobTitle: z.string().trim().min(2).max(100),
  departmentId: z.string().optional().nullable(),
  supervisorId: z.string().optional().nullable(),
  departmentName: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().min(2).max(80).optional().nullable()),
  teamName: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().min(2).max(80).optional().nullable()),
});

/**
 * POST /signup
 * Create new user account
 * - First signup creates initial HEAD_MANAGER with department and team
 * - Subsequent signups create user in existing department/team
 */
router.post('/signup', async (req, res) => {
  const parsed = publicSignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Enter valid signup details.' });
  const data = parsed.data;
  // Normalize email to lowercase for consistency
  const email = normalizeEmail(data.email);
  if (!isAllowedEmail(email)) return res.status(400).json({ message: emailRuleMessage() });

  // Check for duplicate email or employee ID
  const duplicate = await prisma.user.findFirst({ where: { OR: [{ email }, { employeeId: data.employeeId.trim() }] } });
  if (duplicate) return res.status(409).json({ message: 'That email or employee ID is already registered. Use a unique value.' });

  const userCount = await prisma.user.count();
  try {
    // Hash password with bcrypt (salt rounds: 12)
    const passwordHash = await bcrypt.hash(data.password, 12);
    let user;

    // If this is the first user, create department and team, make them HEAD_MANAGER
    if (userCount === 0) {
      if (!data.departmentName || !data.teamName) return res.status(400).json({ message: 'Department and team are required for the first account.' });
      user = await prisma.$transaction(async (tx) => {
        // Create initial department
        const department = await tx.department.create({ data: { name: data.departmentName.trim() } });
        // Create first user as HEAD_MANAGER
        const created = await tx.user.create({
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
            supervisorId: null,
            availableLeaveDays: 25,
          },
        });
        // Create their team, owned by them, then link it back
        const team = await tx.team.create({ data: { name: data.teamName.trim(), managerId: created.id } });
        return tx.user.update({
          where: { id: created.id },
          data: { teamId: team.id },
          include: { department: true, team: true, managedTeam: true, supervisor: true },
        });
      });
      // Log initial setup
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
      // Existing organization - public signup can only create an Employee
      // reporting to an existing Manager. Department is independent.
      if (!data.departmentId) return res.status(400).json({ message: 'Select a department.' });
      let supervisor;
      try {
        supervisor = await validateManagerForSignup(data.supervisorId);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }

      // Create new Employee account, team derived from the chosen manager
      user = await prisma.user.create({
        data: {
          name: data.name.trim(),
          employeeId: data.employeeId.trim(),
          email,
          emailVerified: true,
          passwordHash,
          phone: data.phone?.trim() || null,
          role: 'EMPLOYEE',
          jobTitle: data.jobTitle.trim(),
          departmentId: data.departmentId,
          teamId: supervisor.teamId,
          supervisorId: supervisor.id,
          availableLeaveDays: 20,
        },
        include: { department: true, team: true, managedTeam: true, supervisor: true },
      });
      // Log signup
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'SELF_SIGNUP',
          targetType: 'User',
          targetId: user.id,
          details: `${user.name} created an EMPLOYEE account using ${isDevEmail(email) ? 'company' : 'Gmail'} email`,
        },
      });
    }

    // Return token and user data
    res.status(201).json({ message: 'Account created successfully.', token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Email, employee ID, department, or team already exists. Use unique values.' });
    }
    throw error;
  }
});

/**
 * Validation schema for login
 */
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

/**
 * POST /login
 * Authenticate user with email and password
 * Returns JWT token and user data
 */
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and a password with at least 8 characters.' });
  const email = normalizeEmail(parsed.data.email);
  // Find user by email with related data
  const user = await prisma.user.findUnique({ where: { email }, include: { department: true, team: true, managedTeam: true, supervisor: true } });
  if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid email or password.' });
  // Compare provided password with stored hash
  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' });
  res.json({ token: issueToken(user), user: publicUser(user) });
});

/**
 * POST /forgot-password/request
 * Request password reset
 * - For @dev.com: returns 'DEV' mode (user confirms employee ID)
 * - For @gmail.com: sends OTP code via email, returns 'GMAIL' mode
 */
router.post('/forgot-password/request', async (req, res) => {
  const parsed = otpEmailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email address.' });
  const email = normalizeEmail(parsed.data.email);
  if (!isAllowedEmail(email)) return res.status(400).json({ message: emailRuleMessage() });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.status(404).json({ message: 'No active account was found for that email.' });

  if (isDevEmail(email)) {
    // Company email - user verifies via employee ID
    return res.json({ mode: 'DEV', message: 'For @dev.com accounts, confirm your Employee ID and choose a new password.' });
  }

  try {
    // Gmail - send OTP code
    const { expiresAt } = await issueOtp(email, 'PASSWORD_RESET');
    return res.json({ mode: 'GMAIL', message: 'A password-reset code was sent to your Gmail address.', expiresAt });
  } catch (error) {
    if (error.code === 'EMAIL_NOT_CONFIGURED') return res.status(503).json({ message: error.message });
    throw error;
  }
});

/**
 * Validation schema for password reset
 */
const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
  employeeId: z.string().trim().optional().nullable(),
});

/**
 * POST /forgot-password/reset
 * Reset password
 * - For @dev.com: verify employee ID matches
 * - For @gmail.com: verify OTP code
 */
router.post('/forgot-password/reset', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and a new password with at least 8 characters.' });
  const email = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.status(404).json({ message: 'No active account was found for that email.' });

  if (isDevEmail(email)) {
    // For company email, verify employee ID
    if (!parsed.data.employeeId || parsed.data.employeeId.trim() !== user.employeeId) {
      return res.status(400).json({ message: 'Enter the Employee ID linked to this @dev.com account.' });
    }
  } else if (isGmailEmail(email)) {
    // For Gmail, verify OTP code
    if (!parsed.data.otp) return res.status(400).json({ message: 'Enter the 6-digit code sent to your Gmail address.' });
    const verified = await verifyOtp(email, 'PASSWORD_RESET', parsed.data.otp);
    if (!verified.ok) return res.status(400).json({ message: verified.message });
  } else {
    return res.status(400).json({ message: emailRuleMessage() });
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  // Update user password
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  // Log password reset
  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'PASSWORD_RESET', targetType: 'User', targetId: user.id, details: `Password reset for ${email}` },
  });
  res.json({ message: 'Password changed successfully. You can now sign in.' });
});

/**
 * GET /me
 * Get current authenticated user info
 * Requires valid JWT token in Authorization header
 */
router.get('/me', requireAuth, async (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
