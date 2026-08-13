import { Router } from 'express';
import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { currentDateOnly } from '../utils/date.js';
import { leaveDto, publicUser } from '../utils/serializers.js';
import { buildAnalytics, analyticsToCsv } from '../utils/analytics.js';

const router = Router();
router.use(requireAuth, requireRoles('MANAGER', 'HEAD_MANAGER'));

function visibilityWhere(user) {
  if (user.role === 'HEAD_MANAGER') return { isActive: true, id: { not: user.id } };
  return { isActive: true, supervisorId: user.id };
}

async function validateSupervisorForRole(role, supervisorId, targetId = null) {
  if (role === 'HEAD_MANAGER') return null;
  if (!supervisorId) throw new Error(role === 'MANAGER' ? 'Select a Head Manager.' : 'Select a Manager.');
  if (targetId && supervisorId === targetId) throw new Error('A user cannot report to themselves.');

  const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
  if (!supervisor || !supervisor.isActive) throw new Error('Selected supervisor is unavailable.');
  if (role === 'MANAGER' && supervisor.role !== 'HEAD_MANAGER') throw new Error('A Manager must report to a Head Manager.');
  if (role === 'EMPLOYEE' && supervisor.role !== 'MANAGER') throw new Error('An Employee must report to a Manager.');
  return supervisor;
}

router.get('/team', async (req, res) => {
  const today = currentDateOnly();
  const employees = await prisma.user.findMany({
    where: visibilityWhere(req.user),
    include: {
      department: true,
      team: true,
      supervisor: true,
      attendances: { where: { workDate: today }, take: 1 },
      // "Who's in today" roster: leave takes priority over attendance status.
      leaveRequests: { where: { status: 'APPROVED', fromDate: { lte: today }, toDate: { gte: today } }, take: 1 },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  res.json({
    employees: employees.map((employee) => {
      const attendance = employee.attendances[0];
      const onLeave = employee.leaveRequests[0];
      return {
        ...publicUser(employee),
        todayAttendanceStatus: onLeave
          ? 'ON LEAVE'
          : attendance?.checkOutTime ? 'CHECKED OUT' : attendance?.checkInTime ? 'CHECKED IN' : 'NOT CHECKED IN',
        onLeaveType: onLeave?.leaveType || null,
      };
    }),
  });
});

function analyticsRange(req) {
  return [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30;
}

router.get('/analytics', async (req, res) => {
  const analytics = await buildAnalytics(visibilityWhere(req.user), analyticsRange(req));
  res.json(analytics);
});

router.get('/analytics/export', async (req, res) => {
  const analytics = await buildAnalytics(visibilityWhere(req.user), analyticsRange(req));
  const format = req.query.format === 'pdf' ? 'pdf' : 'csv';
  const fromLabel = analytics.from.toISOString().slice(0, 10);
  const toLabel = analytics.to.toISOString().slice(0, 10);
  const filename = `attendance-analytics-${fromLabel}-to-${toLabel}`;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(analyticsToCsv(analytics));
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(16).fillColor('#111').text('Attendance & Leave Analytics');
  doc.fontSize(10).fillColor('#555').text(
    `${fromLabel} to ${toLabel} · ${analytics.workingDays} working day(s) · Generated ${new Date().toLocaleString()}`
  );
  doc.moveDown(1.2);

  const columns = [
    { key: 'name', label: 'Name', width: 115 },
    { key: 'role', label: 'Role', width: 80 },
    { key: 'presentDays', label: 'Present', width: 50 },
    { key: 'attendancePercent', label: 'Attend %', width: 55 },
    { key: 'punctualityPercent', label: 'Punct %', width: 55 },
    { key: 'availableLeaveDays', label: 'Leave Bal', width: 60 },
  ];
  const startX = doc.x;
  let y = doc.y;

  const drawRow = (values, { bold = false, color = '#222' } = {}) => {
    doc.fontSize(9).fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    columns.forEach((col, i) => {
      const x = startX + columns.slice(0, i).reduce((sum, c) => sum + c.width, 0);
      doc.text(String(values[i]), x, y, { width: col.width });
    });
  };

  drawRow(columns.map((col) => col.label), { bold: true, color: '#111' });
  y += 16;
  doc.moveTo(startX, y).lineTo(startX + columns.reduce((sum, c) => sum + c.width, 0), y).strokeColor('#ccc').stroke();
  y += 6;

  for (const row of analytics.employees) {
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
    drawRow([
      row.name,
      row.role.replaceAll('_', ' '),
      row.presentDays,
      `${row.attendancePercent}%`,
      row.punctualityPercent == null ? '—' : `${row.punctualityPercent}%`,
      row.availableLeaveDays,
    ]);
    y += 16;
  }

  doc.end();
});

router.get('/users', requireRoles('HEAD_MANAGER'), async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { department: true, team: true, managedTeam: true, supervisor: true },
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
  });
  res.json({ users: users.map(publicUser) });
});

const optionalTeamName = z.preprocess((value) => (value === '' ? undefined : value), z.string().trim().min(2).max(80).optional().nullable());

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).default('password-123'),
  employeeId: z.string().trim().min(2).max(40),
  phone: z.string().trim().max(30).optional().nullable(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HEAD_MANAGER']),
  jobTitle: z.string().trim().min(2).max(100),
  departmentId: z.string().min(1),
  // For EMPLOYEE: the Manager they report to (team is derived from this).
  // For MANAGER: the Head Manager they report to.
  // For HEAD_MANAGER: unused.
  supervisorId: z.string().optional().nullable(),
  // Required only for MANAGER/HEAD_MANAGER: creates the new team this
  // person will lead, atomically with their account.
  newTeamName: optionalTeamName,
  availableLeaveDays: z.number().min(0).max(365).optional(),
  reportIds: z.array(z.string()).optional().default([]),
});

router.post('/users', requireRoles('HEAD_MANAGER'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Enter valid user details.' });
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();

  if (!email.endsWith('@dev.com')) {
    return res.status(400).json({ message: 'Head-created accounts use @dev.com. A Gmail user must use Sign Up and verify the OTP sent to that mailbox.' });
  }

  // Department is always independently selected - never derived from
  // Manager/Team. Manager <-> Team stays in sync because Team is always
  // derived from the chosen supervisor (Employee) or created fresh
  // (Manager/Head Manager), never independently supplied by the client.
  let supervisor = null;
  if (data.role === 'EMPLOYEE') {
    if (!data.supervisorId) return res.status(400).json({ message: 'Select a Manager.' });
    supervisor = await prisma.user.findUnique({ where: { id: data.supervisorId } });
    if (!supervisor || !supervisor.isActive || supervisor.role !== 'MANAGER') return res.status(400).json({ message: 'Selected manager is unavailable.' });
  } else if (data.role === 'MANAGER') {
    if (!data.supervisorId) return res.status(400).json({ message: 'Select a Head Manager.' });
    supervisor = await prisma.user.findUnique({ where: { id: data.supervisorId } });
    if (!supervisor || !supervisor.isActive || supervisor.role !== 'HEAD_MANAGER') return res.status(400).json({ message: 'Selected Head Manager is unavailable.' });
    if (!data.newTeamName) return res.status(400).json({ message: 'Enter a name for the new team this Manager will lead.' });
  } else if (!data.newTeamName) {
    return res.status(400).json({ message: 'Enter a name for this Head Manager’s team.' });
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email,
          emailVerified: true,
          passwordHash,
          employeeId: data.employeeId.trim(),
          phone: data.phone || null,
          role: data.role,
          jobTitle: data.jobTitle,
          departmentId: data.departmentId,
          teamId: data.role === 'EMPLOYEE' ? supervisor.teamId : null,
          supervisorId: data.role === 'HEAD_MANAGER' ? null : supervisor.id,
          availableLeaveDays: data.availableLeaveDays ?? (data.role === 'HEAD_MANAGER' ? 25 : data.role === 'MANAGER' ? 22 : 20),
        },
      });

      let ownTeamId = null;
      if (data.role !== 'EMPLOYEE') {
        const team = await tx.team.create({ data: { name: data.newTeamName.trim(), managerId: created.id } });
        ownTeamId = team.id;
        await tx.user.update({ where: { id: created.id }, data: { teamId: team.id } });
      }

      if (data.reportIds.length && data.role === 'HEAD_MANAGER') {
        await tx.user.updateMany({ where: { id: { in: data.reportIds }, role: 'MANAGER' }, data: { supervisorId: created.id } });
      }
      if (data.reportIds.length && data.role === 'MANAGER') {
        await tx.user.updateMany({ where: { id: { in: data.reportIds }, role: 'EMPLOYEE' }, data: { supervisorId: created.id, teamId: ownTeamId } });
      }

      return tx.user.findUnique({ where: { id: created.id }, include: { department: true, team: true, managedTeam: true, supervisor: true } });
    });

    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: 'CREATE_USER', targetType: 'User', targetId: user.id, details: `${user.name} (${user.role})` },
    });
    res.status(201).json({ message: 'Account created successfully.', user: publicUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      if (Array.isArray(error.meta?.target) && error.meta.target.includes('name')) {
        return res.status(409).json({ message: 'That team name is already taken.' });
      }
      return res.status(409).json({ message: 'Duplicate accounts are not allowed. Email and employee ID must be unique.' });
    }
    throw error;
  }
});

const assignmentSchema = z.object({
  supervisorId: z.string().optional().nullable(),
  departmentId: z.string().min(1),
  jobTitle: z.string().trim().min(2).max(100),
});

router.patch('/users/:id/assignment', requireRoles('HEAD_MANAGER'), async (req, res) => {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Department and job title are required.' });
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ message: 'User not found.' });

  // Department is independent and always just whatever was selected. Team
  // is never accepted from the client - for an Employee it is re-derived
  // from the chosen Manager; a Manager/Head Manager keeps the team they
  // already own (reassigning who leads a team isn't done from here).
  let supervisorId = null;
  let teamId = target.teamId;
  if (target.role !== 'HEAD_MANAGER') {
    let supervisor;
    try {
      supervisor = await validateSupervisorForRole(target.role, parsed.data.supervisorId, target.id);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    supervisorId = supervisor.id;
    if (target.role === 'EMPLOYEE') teamId = supervisor.teamId;
  }

  const user = await prisma.user.update({
    where: { id: target.id },
    data: { supervisorId, departmentId: parsed.data.departmentId, teamId, jobTitle: parsed.data.jobTitle },
    include: { department: true, team: true, managedTeam: true, supervisor: true },
  });

  await prisma.auditLog.create({
    data: { actorId: req.user.id, action: 'REASSIGN_USER', targetType: 'User', targetId: target.id, details: `Supervisor changed to ${user.supervisor?.name || 'none'}` },
  });
  res.json({ message: `${user.name} was reassigned successfully.`, user: publicUser(user) });
});

const roleSchema = z.object({
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HEAD_MANAGER']),
  supervisorId: z.string().optional().nullable(),
  // Required only when promoting someone into MANAGER/HEAD_MANAGER who
  // doesn't already own a team.
  newTeamName: optionalTeamName,
});

router.patch('/users/:id/role', requireRoles('HEAD_MANAGER'), async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Choose a valid role.' });
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { directReports: { where: { isActive: true }, select: { id: true, role: true, name: true } }, managedTeam: true },
  });
  if (!target) return res.status(404).json({ message: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ message: 'Use another Head Manager account to change your own role.' });

  if (target.role === 'HEAD_MANAGER' && parsed.data.role !== 'HEAD_MANAGER') {
    const activeHeads = await prisma.user.count({ where: { role: 'HEAD_MANAGER', isActive: true } });
    if (activeHeads <= 1) return res.status(400).json({ message: 'At least one active Head Manager must remain.' });
  }

  if (parsed.data.role === 'EMPLOYEE' && target.directReports.length) {
    return res.status(400).json({ message: 'Reassign this person’s direct reports before changing the role to Employee.' });
  }
  if (parsed.data.role === 'MANAGER' && target.directReports.some((report) => report.role !== 'EMPLOYEE')) {
    return res.status(400).json({ message: 'A Manager can only supervise Employees. Reassign Manager/Head reports first.' });
  }

  const becomingManagerRole = parsed.data.role === 'MANAGER' || parsed.data.role === 'HEAD_MANAGER';
  const alreadyOwnsTeam = !!target.managedTeam;
  if (becomingManagerRole && !alreadyOwnsTeam && !parsed.data.newTeamName) {
    return res.status(400).json({ message: `Enter a name for the new team this ${parsed.data.role === 'MANAGER' ? 'Manager' : 'Head Manager'} will lead.` });
  }

  let supervisor = null;
  if (parsed.data.role !== 'HEAD_MANAGER') {
    try {
      supervisor = await validateSupervisorForRole(parsed.data.role, parsed.data.supervisorId, target.id);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      // Demoted away from Manager/Head Manager: the team they led is retired.
      if (!becomingManagerRole && target.managedTeam) {
        await tx.team.delete({ where: { id: target.managedTeam.id } });
      }

      const updated = await tx.user.update({
        where: { id: target.id },
        data: {
          role: parsed.data.role,
          supervisorId: parsed.data.role === 'HEAD_MANAGER' ? null : supervisor.id,
          teamId: parsed.data.role === 'EMPLOYEE' ? supervisor.teamId : becomingManagerRole && alreadyOwnsTeam ? target.teamId : null,
        },
      });

      if (becomingManagerRole && !alreadyOwnsTeam) {
        const team = await tx.team.create({ data: { name: parsed.data.newTeamName.trim(), managerId: updated.id } });
        await tx.user.update({ where: { id: updated.id }, data: { teamId: team.id } });
      }

      return tx.user.findUnique({ where: { id: updated.id }, include: { department: true, team: true, managedTeam: true, supervisor: true } });
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'CHANGE_ROLE',
        targetType: 'User',
        targetId: target.id,
        details: `${target.role} -> ${user.role}; supervisor: ${user.supervisor?.name || 'none'}`,
      },
    });
    res.json({ message: `${user.name}'s role changed to ${user.role.replaceAll('_', ' ')}.`, user: publicUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'That team name is already taken.' });
    }
    throw error;
  }
});

router.patch('/users/:id/status', requireRoles('HEAD_MANAGER'), async (req, res) => {
  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'isActive must be true or false.' });
  if (req.params.id === req.user.id && !parsed.data.isActive) return res.status(400).json({ message: 'You cannot deactivate your own account.' });

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ message: 'User not found.' });
  if (target.role === 'HEAD_MANAGER' && !parsed.data.isActive) {
    const activeHeads = await prisma.user.count({ where: { role: 'HEAD_MANAGER', isActive: true } });
    if (activeHeads <= 1) return res.status(400).json({ message: 'At least one active Head Manager must remain.' });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: parsed.data.isActive },
    include: { department: true, team: true, managedTeam: true, supervisor: true },
  });
  res.json({ message: parsed.data.isActive ? 'Account activated.' : 'Account deactivated.', user: publicUser(user) });
});

router.get('/leaves/pending', async (req, res) => {
  let ownerWhere;

  if (req.user.role === 'MANAGER') {
    ownerWhere = { role: 'EMPLOYEE', isActive: true, supervisorId: req.user.id };
  } else {
    ownerWhere = {
      isActive: true,
      id: { not: req.user.id },
      OR: [
        { role: 'MANAGER', supervisorId: req.user.id },
        { role: 'EMPLOYEE', supervisor: { supervisorId: req.user.id } },
        { role: 'HEAD_MANAGER' },
      ],
    };
  }

  const requests = await prisma.leaveRequest.findMany({
    where: { status: 'PENDING', user: ownerWhere },
    include: { user: true, reviewedBy: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ requests: requests.map(leaveDto) });
});

router.patch('/leaves/:id', async (req, res) => {
  const parsed = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Status must be APPROVED or REJECTED.' });

  const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!leave) return res.status(404).json({ message: 'Leave request not found.' });
  if (leave.userId === req.user.id) return res.status(403).json({ message: 'You cannot review your own leave request.' });

  let canReview = false;
  let otherApproverIds = [];

  if (leave.user.role === 'EMPLOYEE') {
    const managerId = leave.user.supervisorId;
    let headId = null;
    if (managerId) {
      const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { supervisorId: true } });
      headId = manager?.supervisorId || null;
    }
    canReview = (req.user.role === 'MANAGER' && managerId === req.user.id)
      || (req.user.role === 'HEAD_MANAGER' && headId === req.user.id);
    otherApproverIds = [managerId, headId].filter((id) => id && id !== req.user.id);
  } else if (leave.user.role === 'MANAGER') {
    const headId = leave.user.supervisorId;
    canReview = req.user.role === 'HEAD_MANAGER' && headId === req.user.id;
  } else if (leave.user.role === 'HEAD_MANAGER') {
    canReview = req.user.role === 'HEAD_MANAGER' && req.user.id !== leave.userId;
    if (canReview) {
      const peers = await prisma.user.findMany({
        where: { role: 'HEAD_MANAGER', isActive: true, id: { notIn: [req.user.id, leave.userId] } },
        select: { id: true },
      });
      otherApproverIds = peers.map((peer) => peer.id);
    }
  }

  if (!canReview) return res.status(403).json({ message: 'You cannot review this leave request.' });
  if (parsed.data.status === 'APPROVED' && leave.days > leave.user.availableLeaveDays) {
    return res.status(400).json({ message: 'The requester no longer has enough leave balance.' });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.leaveRequest.updateMany({
        where: { id: leave.id, status: 'PENDING' },
        data: { status: parsed.data.status, reviewedById: req.user.id, reviewedAt: new Date() },
      });
      if (claim.count !== 1) throw new Error('ALREADY_REVIEWED');

      if (parsed.data.status === 'APPROVED') {
        await tx.user.update({ where: { id: leave.userId }, data: { availableLeaveDays: { decrement: leave.days } } });
      }

      await tx.notification.create({
        data: {
          recipientId: leave.userId,
          title: `Leave ${parsed.data.status.toLowerCase()}`,
          message: `${req.user.name} ${parsed.data.status.toLowerCase()} your ${leave.days}-day ${leave.leaveType.toLowerCase()} leave request.`,
          type: 'LEAVE_DECISION',
          entityId: leave.id,
        },
      });

      if (otherApproverIds.length) {
        await tx.notification.createMany({
          data: otherApproverIds.map((recipientId) => ({
            recipientId,
            title: 'Leave request already decided',
            message: `${req.user.name} ${parsed.data.status.toLowerCase()} ${leave.user.name}'s leave request. That first decision is final.`,
            type: 'LEAVE_DECISION',
            entityId: leave.id,
          })),
        });
      }

      return tx.leaveRequest.findUnique({ where: { id: leave.id }, include: { user: true, reviewedBy: true } });
    });

    res.json({
      message: `Leave request ${parsed.data.status.toLowerCase()}. This first decision is final.`,
      request: leaveDto(updated),
    });
  } catch (error) {
    if (error.message === 'ALREADY_REVIEWED') {
      return res.status(409).json({ message: 'This leave request was already decided. The first authorized decision is final.' });
    }
    throw error;
  }
});

export default router;
