/**
 * Profile Routes
 * ==============
 * Lets the current user view and edit their own profile:
 * - Fetching their profile
 * - Updating name/phone
 * - Uploading a profile photo
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { profilePhotoUpload } from '../middleware/upload.js';
import { publicUser } from '../utils/serializers.js';

const router = Router();

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must contain at least 2 characters.').max(100),
  phone: z.union([
    z.string().trim().regex(/^[+()\-\s\d]{7,20}$/, 'Enter a valid phone number.'),
    z.literal(''),
  ]),
});

/**
 * GET /
 * Return the current user's own profile.
 */
router.get('/', requireAuth, async (req, res) => {
  res.json({ profile: publicUser(req.user) });
});

/**
 * PUT /
 * Update the current user's name and/or phone number.
 */
router.put('/', requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Enter valid profile details.' });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
    },
    include: { department: true, team: true, managedTeam: true, supervisor: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'UPDATE_PROFILE',
      targetType: 'User',
      targetId: req.user.id,
      details: 'Updated profile name and/or phone number',
    },
  });

  res.json({ message: 'Profile updated successfully.', profile: publicUser(user) });
});

/**
 * POST /photo
 * Upload/replace the current user's profile photo. See middleware/upload.js
 * for storage config (size limit, image-only filter).
 */
router.post('/photo', requireAuth, profilePhotoUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Select an image to upload.' });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { profilePicture: `/uploads/${req.file.filename}` },
    include: { department: true, team: true, managedTeam: true, supervisor: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'UPDATE_PROFILE_PHOTO',
      targetType: 'User',
      targetId: req.user.id,
      details: 'Updated profile picture',
    },
  });

  res.json({ message: 'Profile picture updated successfully.', profile: publicUser(user) });
});

export default router;
