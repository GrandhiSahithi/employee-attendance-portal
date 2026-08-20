/**
 * Organization Routes
 * ===================
 * Read-only reference data for building forms (signup, user creation,
 * reassignment) plus department creation:
 * - Departments, Head Managers, and Managers (each with their team)
 * - Creating a new department
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /options
 * Return picklist data for admin forms: all departments, all active Head
 * Managers, and all active Managers (each carrying their team id/name).
 *
 * Department is independent of the Manager<->Team relationship, so it is
 * just a flat picklist. Managers each own exactly one team, so a single
 * `managers` list (each carrying its teamId/teamName) is enough to drive a
 * bidirectional Manager<->Team picker on the client: selecting "by manager"
 * or "by team" both just set the same supervisorId.
 */
router.get('/options', async (_req, res) => {
  const [departments, heads, managers] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { role: 'HEAD_MANAGER', isActive: true }, select: { id: true, name: true, employeeId: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { role: 'MANAGER', isActive: true },
      select: { id: true, name: true, employeeId: true, supervisorId: true, team: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    }),
  ]);
  res.json({
    departments,
    heads,
    managers: managers.map((manager) => ({
      id: manager.id,
      name: manager.name,
      employeeId: manager.employeeId,
      supervisorId: manager.supervisorId,
      teamId: manager.team?.id || null,
      teamName: manager.team?.name || null,
    })),
  });
});

/**
 * POST /departments
 * Create a new department. Head Manager only.
 */
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

export default router;
