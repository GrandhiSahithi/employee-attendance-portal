/**
 * Attendance Routes
 * =================
 * Handles employee attendance for the current logged-in user:
 * - Today's attendance status
 * - GPS-based check-in / check-out
 * - Attendance history over a date range
 */

import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { currentDateOnly, dateOnlyFromCapturedAt, parseDateOnly, subtractDays } from '../utils/date.js';
import { resolveTimezoneFromCoordinates } from '../utils/timezone.js';
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

/**
 * Determine which calendar work date a check-in/check-out applies to:
 * an explicit workDate if given, otherwise derived from capturedAt (or now).
 * @param {object} payload - Parsed request body (markSchema shape)
 * @returns {Date|null} UTC-midnight work date, or null if unparseable
 */
function resolveWorkDate(payload) {
  return payload.workDate ? parseDateOnly(payload.workDate) : dateOnlyFromCapturedAt(payload.capturedAt);
}

/**
 * GET /today
 * Return the current user's attendance record for today, if any.
 */
router.get('/today', async (req, res) => {
  const attendance = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: req.user.id, workDate: currentDateOnly() } },
  });
  res.json({ attendance: attendanceDto(attendance) });
});

/**
 * POST /check-in
 * Record a GPS check-in for the current user. Resolves and stores the
 * employee's IANA timezone from their coordinates (used later for the
 * automatic-checkout cutoff). Fails with 409 if already checked in today.
 */
router.post('/check-in', async (req, res) => {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Valid GPS latitude/longitude are required.' });

  const workDate = resolveWorkDate(parsed.data);
  const checkInTime = parsed.data.capturedAt ? new Date(parsed.data.capturedAt) : new Date();
  if (!workDate || Number.isNaN(checkInTime.getTime())) return res.status(400).json({ message: 'Invalid attendance date/time.' });

  const checkInTimezone = resolveTimezoneFromCoordinates(parsed.data.latitude, parsed.data.longitude);

  try {
    const attendance = await prisma.attendance.create({
      data: {
        userId: req.user.id,
        workDate,
        checkInTime,
        checkInLatitude: parsed.data.latitude,
        checkInLongitude: parsed.data.longitude,
        checkInTimezone,
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

/**
 * POST /check-out
 * Record a GPS check-out for the current user's open attendance record.
 * Uses a conditional update so a concurrent automatic-checkout sweep
 * (see jobs/autoCheckout.js) can't be raced/overwritten.
 */
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

  // Conditional update guards against a race with the automatic-checkout
  // sweep: if that already closed the record, this affects 0 rows instead
  // of overwriting it.
  const result = await prisma.attendance.updateMany({
    where: { id: existing.id, checkOutTime: null },
    data: {
      checkOutTime,
      checkOutLatitude: parsed.data.latitude,
      checkOutLongitude: parsed.data.longitude,
      checkoutType: 'MANUAL',
    },
  });
  if (result.count === 0) return res.status(409).json({ message: 'You have already checked out for this date.' });

  const attendance = await prisma.attendance.findUnique({ where: { id: existing.id } });
  res.json({ message: 'Check-out recorded successfully.', attendance: attendanceDto(attendance) });
});

/**
 * GET /history
 * Return the current user's attendance records over a date range.
 * Accepts an explicit ?from=&to= range, or a ?range=7|30 trailing-days
 * shortcut (defaults to 7). Future dates are rejected.
 */
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
