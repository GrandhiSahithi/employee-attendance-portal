import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { currentDateOnly, dateOnlyFromCapturedAt, parseDateOnly, subtractDays } from '../utils/date.js';
import { attendanceDto } from '../utils/serializers.js';

const router = Router();

router.use(
      requireAuth,
      requireRoles('EMPLOYEE', 'MANAGER', 'HEAD_MANAGER')
 );


const markSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capturedAt: z.string().datetime().optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function resolveWorkDate(payload) {
  return payload.workDate ? parseDateOnly(payload.workDate) : dateOnlyFromCapturedAt(payload.capturedAt);
}

router.get('/today', async (req, res) => {
  const attendance = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: req.user.id, workDate: currentDateOnly() } },
  });
  res.json({ attendance: attendanceDto(attendance) });
});

router.post('/check-in', async (req, res) => {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Valid GPS latitude/longitude are required.' });

  const workDate = resolveWorkDate(parsed.data);
  const checkInTime = parsed.data.capturedAt ? new Date(parsed.data.capturedAt) : new Date();
  if (!workDate || Number.isNaN(checkInTime.getTime())) return res.status(400).json({ message: 'Invalid attendance date/time.' });

  try {
    const attendance = await prisma.attendance.create({
      data: {
        userId: req.user.id,
        workDate,
        checkInTime,
        checkInLatitude: parsed.data.latitude,
        checkInLongitude: parsed.data.longitude,
      },
    });
    res.status(201).json({ message: 'Check-in recorded successfully.', attendance: attendanceDto(attendance) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'You have already checked in for this date.' });
    }
    throw error;
  }
});

router.post('/check-out', async (req, res) => {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Valid GPS latitude/longitude are required.' });

  const workDate = resolveWorkDate(parsed.data);
  const checkOutTime = parsed.data.capturedAt ? new Date(parsed.data.capturedAt) : new Date();
  if (!workDate || Number.isNaN(checkOutTime.getTime())) return res.status(400).json({ message: 'Invalid attendance date/time.' });

  const existing = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: req.user.id, workDate } },
  });
  if (!existing) return res.status(400).json({ message: 'You must check in before checking out.' });
  if (existing.checkOutTime) return res.status(409).json({ message: 'You have already checked out for this date.' });
  if (checkOutTime < existing.checkInTime) return res.status(400).json({ message: 'Check-out time cannot be before check-in time.' });

  const attendance = await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOutTime,
      checkOutLatitude: parsed.data.latitude,
      checkOutLongitude: parsed.data.longitude,
    },
  });

  res.json({ message: 'Check-out recorded successfully.', attendance: attendanceDto(attendance) });
});

router.get('/history', async (req, res) => {
  let from;
  let to;

  if (req.query.from || req.query.to) {
    from = parseDateOnly(req.query.from);
    to = parseDateOnly(req.query.to);
    if (!from || !to || from > to) return res.status(400).json({ message: 'Enter a valid custom date range.' });
    if (to > currentDateOnly()) return res.status(400).json({ message: 'Attendance history cannot include future dates.' });
  } else {
    const range = req.query.range === '30' ? 30 : 7;
    to = currentDateOnly();
    from = subtractDays(to, range - 1);
  }

  const records = await prisma.attendance.findMany({
    where: { userId: req.user.id, workDate: { gte: from, lte: to } },
    orderBy: { workDate: 'desc' },
  });

  res.json({ records: records.map(attendanceDto), from, to });
});

export default router;
