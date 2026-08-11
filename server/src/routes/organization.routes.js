import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/options', async (_req, res) => {
  const [departments, teams, heads, managers, employees] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.team.findMany({ include: { department: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { role: 'HEAD_MANAGER', isActive: true }, select: { id: true, name: true, employeeId: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { role: 'MANAGER', isActive: true }, select: { id: true, name: true, employeeId: true, supervisorId: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { role: 'EMPLOYEE', isActive: true }, select: { id: true, name: true, employeeId: true, supervisorId: true }, orderBy: { name: 'asc' } }),
  ]);
  res.json({ departments, teams, heads, managers, employees });
});

router.post('/departments', requireRoles('HEAD_MANAGER'), async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid department name.' });
  try {
    const department = await prisma.department.create({ data: { name: parsed.data.name } });
    res.status(201).json({ message: 'Department created.', department });
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ message: 'That department already exists.' });
    throw e;
  }
});

router.post('/teams', requireRoles('HEAD_MANAGER'), async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(80), departmentId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Team name and department are required.' });
  try {
    const team = await prisma.team.create({ data: parsed.data, include: { department: true } });
    res.status(201).json({ message: 'Team created.', team });
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ message: 'That team already exists in this department.' });
    throw e;
  }
});
export default router;
