/**
 * Dashboard Route
 * ===============
 * Single endpoint that powers the employee home screen: profile summary,
 * unread notification count, and today's attendance status, all in one
 * response to avoid multiple round-trips on app launch.
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { currentDateOnly } from '../utils/date.js';
import { attendanceDto } from '../utils/serializers.js';

const router = Router();

/**
 * GET /
 * Return the current user's dashboard summary: employee profile fields,
 * unread notification count, and today's attendance status/record.
 */
router.get('/', requireAuth, async (req, res) => {
  const attendance = await prisma.attendance.findUnique({ where: { userId_workDate: { userId: req.user.id, workDate: currentDateOnly() } } });
  const unreadNotifications = await prisma.notification.count({ where: { recipientId: req.user.id, isRead: false } });
  const status = attendance?.checkOutTime ? 'CHECKED OUT' : attendance?.checkInTime ? 'CHECKED IN' : 'NOT CHECKED IN';
  res.json({
    employee: {
      name: req.user.name, employeeId: req.user.employeeId, role: req.user.role, jobTitle: req.user.jobTitle,
      department: req.user.department?.name || null, team: req.user.team?.name || null,
      supervisorName: req.user.supervisor?.name || null, availableLeaveDays: req.user.availableLeaveDays,
    },
    unreadNotifications,
    todayAttendance: { status, record: attendanceDto(attendance) },
  });
});
export default router;
