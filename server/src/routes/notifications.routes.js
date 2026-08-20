/**
 * Notification Routes
 * ====================
 * In-app notifications for the current user (e.g. new leave requests,
 * leave approval/rejection decisions - created elsewhere, such as
 * leave.routes.js and management.routes.js).
 * Handles listing recent notifications and marking them as read.
 */

import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /
 * Return the current user's 50 most recent notifications, plus an unread count.
 */
router.get('/', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({ where: { recipientId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ notifications, unread: notifications.filter((n) => !n.isRead).length });
});

/**
 * PATCH /:id/read
 * Mark a single notification (must belong to the current user) as read.
 */
router.patch('/:id/read', requireAuth, async (req, res) => {
  const found = await prisma.notification.findFirst({ where: { id: req.params.id, recipientId: req.user.id } });
  if (!found) return res.status(404).json({ message: 'Notification not found.' });
  const notification = await prisma.notification.update({ where: { id: found.id }, data: { isRead: true } });
  res.json({ notification });
});

/**
 * PATCH /read-all
 * Mark all of the current user's unread notifications as read.
 */
router.patch('/read-all', requireAuth, async (req, res) => {
  await prisma.notification.updateMany({ where: { recipientId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ message: 'Notifications marked as read.' });
});
export default router;
