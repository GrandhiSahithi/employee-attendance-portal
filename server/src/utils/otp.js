import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { sendOtpEmail } from './email.js';

const MAX_ATTEMPTS = 6;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isDevEmail(email) {
  return normalizeEmail(email).endsWith('@dev.com');
}

export function isGmailEmail(email) {
  return normalizeEmail(email).endsWith('@gmail.com');
}

export function isAllowedEmail(email) {
  return isDevEmail(email) || isGmailEmail(email);
}

export async function issueOtp(email, purpose) {
  const normalized = normalizeEmail(email);
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const minutes = Math.max(2, Number(process.env.OTP_EXPIRY_MINUTES || 10));
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  await prisma.otpCode.deleteMany({ where: { OR: [{ email: normalized, purpose, usedAt: null }, { expiresAt: { lt: new Date() } }] } });
  const record = await prisma.otpCode.create({ data: { email: normalized, purpose, codeHash, expiresAt } });
  try {
    await sendOtpEmail({ to: normalized, code, purpose });
  } catch (error) {
    await prisma.otpCode.delete({ where: { id: record.id } }).catch(() => {});
    throw error;
  }
  return { expiresAt };
}

export async function verifyOtp(email, purpose, code, { consume = true } = {}) {
  const normalized = normalizeEmail(email);
  const record = await prisma.otpCode.findFirst({
    where: { email: normalized, purpose, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return { ok: false, message: 'Request a new verification code.' };
  if (record.expiresAt < new Date()) return { ok: false, message: 'The verification code has expired. Request a new one.' };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, message: 'Too many incorrect attempts. Request a new verification code.' };

  const ok = await bcrypt.compare(String(code || '').trim(), record.codeHash);
  if (!ok) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, message: 'Incorrect verification code.' };
  }

  if (consume) await prisma.otpCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return { ok: true, record };
}
