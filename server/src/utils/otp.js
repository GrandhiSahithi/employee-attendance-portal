/**
 * OTP (One-Time Password) Utility
 * ==============================
 * Handles OTP generation, sending, and verification for:
 * - Password recovery (via Gmail)
 * - Email verification
 * Features:
 * - 6-digit code generation
 * - Code hashing with bcrypt
 * - Expiration tracking
 * - Attempt limiting (max 6 wrong attempts)
 * - Email sending via Gmail SMTP
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { sendOtpEmail } from './email.js';

// Maximum incorrect OTP attempts before blocking
const MAX_ATTEMPTS = 6;

/**
 * Generate random 6-digit OTP code
 * @returns {string} 6-digit code as string
 */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Normalize email to lowercase and trim whitespace
 * @param {string} email - Email address
 * @returns {string} Normalized email
 */
export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Check if email is a company email (@dev.com)
 * @param {string} email - Email address
 * @returns {boolean}
 */
export function isDevEmail(email) {
  return normalizeEmail(email).endsWith('@dev.com');
}

/**
 * Check if email is a Gmail account (@gmail.com)
 * @param {string} email - Email address
 * @returns {boolean}
 */
export function isGmailEmail(email) {
  return normalizeEmail(email).endsWith('@gmail.com');
}

/**
 * Check if email is allowed (@dev.com or @gmail.com)
 * @param {string} email - Email address
 * @returns {boolean}
 */
export function isAllowedEmail(email) {
  return isDevEmail(email) || isGmailEmail(email);
}

/**
 * Issue and send OTP code
 * - Generates 6-digit code
 * - Hashes code with bcrypt
 * - Stores hashed code in database with expiration
 * - Sends code via email
 * - Deletes previous unused OTP codes
 *
 * @param {string} email - Email to send code to
 * @param {string} purpose - Purpose of OTP (e.g., 'PASSWORD_RESET', 'VERIFY_EMAIL')
 * @returns {object} {expiresAt} - When the code expires
 * @throws {object} Error with code if email sending fails
 */
export async function issueOtp(email, purpose) {
  const normalized = normalizeEmail(email);
  // Generate 6-digit code
  const code = generateCode();
  // Hash code with bcrypt (10 rounds)
  const codeHash = await bcrypt.hash(code, 10);
  // Calculate expiration time (default 10 minutes, min 2 minutes)
  const minutes = Math.max(2, Number(process.env.OTP_EXPIRY_MINUTES || 10));
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  // Delete previous unused OTP codes for this email/purpose and expired codes
  await prisma.otpCode.deleteMany({ 
    where: { 
      OR: [
        { email: normalized, purpose, usedAt: null },  // Previous unused codes
        { expiresAt: { lt: new Date() } }              // Expired codes
      ] 
    } 
  });
  
  // Create new OTP record in database
  const record = await prisma.otpCode.create({ 
    data: { email: normalized, purpose, codeHash, expiresAt } 
  });
  
  try {
    // Send OTP code via email
    await sendOtpEmail({ to: normalized, code, purpose });
  } catch (error) {
    // Delete OTP record if email sending fails
    await prisma.otpCode.delete({ where: { id: record.id } }).catch(() => {});
    throw error;
  }
  
  return { expiresAt };
}

/**
 * Verify OTP code
 * - Retrieves latest unused OTP record
 * - Checks expiration
 * - Checks attempt limit
 * - Compares code with stored hash
 * - Increments attempt counter on failure
 * - Marks as used on success (if consume=true)
 *
 * @param {string} email - Email to verify code for
 * @param {string} purpose - Purpose of OTP
 * @param {string} code - User-provided code to verify
 * @param {object} options - {consume: boolean} - Mark as used if true
 * @returns {object} {ok: boolean, message: string, record?: object}
 */
export async function verifyOtp(email, purpose, code, { consume = true } = {}) {
  const normalized = normalizeEmail(email);
  
  // Get the latest unused OTP for this email and purpose
  const record = await prisma.otpCode.findFirst({
    where: { email: normalized, purpose, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  // No OTP found
  if (!record) return { ok: false, message: 'Request a new verification code.' };
  
  // Code has expired
  if (record.expiresAt < new Date()) return { ok: false, message: 'The verification code has expired. Request a new one.' };
  
  // Too many incorrect attempts
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, message: 'Too many incorrect attempts. Request a new verification code.' };

  // Compare provided code with stored hash
  const ok = await bcrypt.compare(String(code || '').trim(), record.codeHash);
  if (!ok) {
    // Increment attempt counter on wrong code
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, message: 'Incorrect verification code.' };
  }

  // Mark code as used if consume=true
  if (consume) await prisma.otpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  
  return { ok: true, record };
}
