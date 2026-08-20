/**
 * Profile Photo Upload Middleware
 * ===============================
 * Configures Multer to store uploaded profile photos on local disk (in
 * ./uploads, served statically by index.js at /uploads) with a filename
 * unique per user/upload, a 5MB size limit, and an image-only file filter.
 */

import fs from 'fs';
import path from 'path';
import multer from 'multer';

const uploadDir = path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

/**
 * Multer middleware for a single profile-photo upload field.
 * Usage: router.post('/photo', requireAuth, profilePhotoUpload.single('photo'), handler)
 * Rejects non-image files and files over 5MB (handled by errorHandler).
 */
export const profilePhotoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
});
