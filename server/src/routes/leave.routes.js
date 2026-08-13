import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { currentDateOnly, inclusiveDays, parseDateOnly } from '../utils/date.js';
import { leaveDto } from '../utils/serializers.js';

const router = Router();
router.use(requireAuth);

const leaveSchema = z.object({
  leaveType: z.enum(['CASUAL', 'SICK', 'VACATION']),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string().trim().min(1, 'Reason is mandatory.').max(1000),
});

async function approvalRecipients(user) {
  const ids = new Set();

  if (user.role === 'EMPLOYEE') {
    if (!user.supervisorId) return [];
    ids.add(user.supervisorId);
    const manager = await prisma.user.findUnique({
      where: { id: user.supervisorId },
      select: { role: true, supervisorId: true },
    });
    if (manager?.role === 'MANAGER' && manager.supervisorId) ids.add(manager.supervisorId);
  } else if (user.role === 'MANAGER') {
    if (user.supervisorId) ids.add(user.supervisorId);
  } else if (user.role === 'HEAD_MANAGER') {
    const peers = await prisma.user.findMany({
      where: { role: 'HEAD_MANAGER', isActive: true, id: { not: user.id } },
      select: { id: true },
    });
    peers.forEach((peer) => ids.add(peer.id));
  }

  return [...ids];
}

function recipientMessage(user, count) {
  if (user.role === 'EMPLOYEE') return count ? 'Your Manager and Head Manager were notified.' : 'No approver is currently assigned to your account.';
  if (user.role === 'MANAGER') return count ? 'Your Head Manager was notified.' : 'No Head Manager is currently assigned to your account.';
  return count ? 'Other active Head Managers were notified.' : 'No other active Head Manager is available to review your leave request.';
}

router.post('/', async (req, res) => {
  const parsed = leaveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Invalid leave request.' });

  const fromDate = parseDateOnly(parsed.data.fromDate);
  const toDate = parseDateOnly(parsed.data.toDate);
  const today = currentDateOnly();

  if (!fromDate || !toDate) return res.status(400).json({ message: 'Enter valid leave dates.' });
  if (fromDate < today || toDate < today) return res.status(400).json({ message: 'Past dates are not allowed.' });
  if (fromDate > toDate) return res.status(400).json({ message: 'From Date should not exceed To Date.' });

  const days = inclusiveDays(fromDate, toDate);
  if (days > req.user.availableLeaveDays) {
    return res.status(400).json({ message: `You only have ${req.user.availableLeaveDays} paid leave day(s) available.` });
  }

  const recipients = await approvalRecipients(req.user);
  if (req.user.role === 'HEAD_MANAGER' && recipients.length === 0) {
    return res.status(400).json({ message: 'Another active Head Manager is required to review a Head Manager leave request.' });
  }

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      userId: req.user.id,
      status: { in: ['PENDING', 'APPROVED'] },
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
    },
  });
  if (overlap) return res.status(409).json({ message: 'A pending or approved leave request already overlaps these dates.' });

  const request = await prisma.leaveRequest.create({
    data: {
      userId: req.user.id,
      leaveType: parsed.data.leaveType,
      fromDate,
      toDate,
      reason: parsed.data.reason.trim(),
      days,
    },
  });

  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((recipientId) => ({
        recipientId,
        title: 'New leave request',
        message: `${req.user.name} submitted ${days} day(s) of ${parsed.data.leaveType.toLowerCase()} leave. The first authorized decision is final.`,
        type: 'LEAVE_REQUEST',
        entityId: request.id,
      })),
    });
  }

  res.status(201).json({
    message: `Leave request submitted successfully. ${recipientMessage(req.user, recipients.length)}`,
    request: leaveDto(request),
  });
});

router.get('/me', async (req, res) => {
  const requests = await prisma.leaveRequest.findMany({
    where: { userId: req.user.id },
    include: { reviewedBy: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ requests: requests.map(leaveDto) });
});

/**
 * Team leave calendar: pending/approved leave for the viewer's own team
 * only (not company-wide), so anyone can see who else is out before
 * requesting their own dates. Defaults to a 2-month forward-looking window
 * (current month + next) since that's what's useful for planning ahead.
 *
 * A Head Manager isn't a working member of any single team the way an
 * Employee or Manager is, so "their team" would otherwise mean just the
 * one-person team created alongside their account. For a Head Manager this
 * scope is broadened to everyone in the organization instead.
 */
router.get('/team-calendar', async (req, res) => {
  const isHead = req.user.role === 'HEAD_MANAGER';
  if (!isHead && !req.user.teamId) {
    return res.json({ requests: [], message: 'You are not assigned to a team yet.' });
  }

  let from;
  let to;
  if (req.query.from || req.query.to) {
    from = parseDateOnly(req.query.from);
    to = parseDateOnly(req.query.to);
    if (!from || !to || from > to) return res.status(400).json({ message: 'Enter a valid date range.' });
  } else {
    const today = currentDateOnly();
    from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 0));
  }

  const requests = await prisma.leaveRequest.findMany({
    where: {
      status: { in: ['PENDING', 'APPROVED'] },
      user: isHead ? { isActive: true, id: { not: req.user.id } } : { teamId: req.user.teamId, isActive: true },
      fromDate: { lte: to },
      toDate: { gte: from },
    },
    include: { user: { include: { team: true } } },
    orderBy: { fromDate: 'asc' },
  });

  res.json({
    requests: requests.map(leaveDto),
    from,
    to,
    teamName: isHead ? 'the organization' : req.user.team?.name || null,
    scope: isHead ? 'ORG' : 'TEAM',
  });
});

export default router;
