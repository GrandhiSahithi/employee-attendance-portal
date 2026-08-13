/**
 * Monthly Leave Accrual
 * =====================
 * Replaces the old flat yearly leave balance with monthly accrual: every
 * active user earns a fraction of their annual allotment each month,
 * capped so unused balance can't grow forever (carryover limit).
 *
 * Annual base amounts match the existing per-role defaults used at account
 * creation (see management.routes.js / auth.routes.js): HEAD_MANAGER 25,
 * MANAGER 22, EMPLOYEE 20. Carryover cap is 1.5x the annual base — a
 * common real-world policy (use-it-mostly-or-lose-the-excess). Adjust
 * ANNUAL_BASE_DAYS / CARRYOVER_MULTIPLIER below if the business wants
 * different numbers.
 */

import cron from 'node-cron';
import { prisma } from '../db.js';

const ANNUAL_BASE_DAYS = { HEAD_MANAGER: 25, MANAGER: 22, EMPLOYEE: 20 };
const CARRYOVER_MULTIPLIER = 1.5;

function monthlyRate(role) {
  return Math.round((ANNUAL_BASE_DAYS[role] / 12) * 100) / 100;
}

function carryoverCap(role) {
  return ANNUAL_BASE_DAYS[role] * CARRYOVER_MULTIPLIER;
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Grants this month's accrual to every active user who hasn't already
 * received it this calendar month. Idempotent: safe to run more than once
 * in the same month (later calls are no-ops for already-accrued users).
 * @returns {Promise<number>} number of users granted accrual
 */
export async function runMonthlyAccrual() {
  const monthStart = startOfCurrentMonth();

  const dueUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ lastAccrualAt: null }, { lastAccrualAt: { lt: monthStart } }],
    },
    select: { id: true, role: true, availableLeaveDays: true, lastAccrualAt: true },
  });

  let granted = 0;
  for (const user of dueUsers) {
    const newBalance = Math.min(
      Math.round((user.availableLeaveDays + monthlyRate(user.role)) * 100) / 100,
      carryoverCap(user.role)
    );

    // Conditional update guards against double-granting if this job somehow
    // overlaps with itself (matches the atomic-update pattern used elsewhere
    // in this codebase, e.g. attendance auto-checkout).
    const result = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ lastAccrualAt: null }, { lastAccrualAt: { lt: monthStart } }] },
      data: { availableLeaveDays: newBalance, lastAccrualAt: new Date() },
    });
    if (result.count === 1) granted += 1;
  }

  return granted;
}

export function startLeaveAccrualScheduler() {
  // 00:05 on the 1st of every month. Exact time doesn't need to be precise
  // (unlike the 5pm attendance cutoff) since correctness comes from the
  // lastAccrualAt guard above, not from exact scheduling.
  cron.schedule('5 0 1 * *', async () => {
    try {
      const granted = await runMonthlyAccrual();
      if (granted > 0) console.log(`Leave accrual: granted monthly leave to ${granted} employee(s).`);
    } catch (error) {
      console.error('Leave accrual job failed:', error);
    }
  });
}
