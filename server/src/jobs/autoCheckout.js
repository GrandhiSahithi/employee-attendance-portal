/**
 * Automatic Checkout Job
 * =======================
 * Employees who check in but never check out are automatically checked
 * out at 5:00 PM in *their* local time (the IANA timezone resolved from
 * their check-in coordinates), not server time and not a fixed offset.
 *
 * Runs in-process on a schedule (no separate worker service exists for
 * this project). Safe to run on a single instance; the conditional
 * `updateMany` below makes each sweep idempotent even if two sweeps
 * somehow overlap, so no distributed lock is needed.
 */

import cron from 'node-cron';
import { DateTime } from 'luxon';
import { prisma } from '../db.js';

const LOCAL_CUTOFF_HOUR = 17; // 5:00 PM

/**
 * The UTC instant that corresponds to 5:00 PM local time, on the given
 * workday, in the given IANA timezone. `workDate` is stored as a UTC
 * midnight Date (see utils/date.js parseDateOnly), so its UTC Y/M/D
 * components are the intended calendar date regardless of timezone.
 * @param {Date} workDate
 * @param {string} timezone IANA zone name, e.g. "America/Los_Angeles"
 * @returns {Date}
 */
export function localCutoffToUtc(workDate, timezone) {
  const cutoff = DateTime.fromObject(
    {
      year: workDate.getUTCFullYear(),
      month: workDate.getUTCMonth() + 1,
      day: workDate.getUTCDate(),
      hour: LOCAL_CUTOFF_HOUR,
      minute: 0,
      second: 0,
      millisecond: 0,
    },
    { zone: timezone }
  );
  return cutoff.isValid ? cutoff.toUTC().toJSDate() : null;
}

/**
 * Finds attendance records still checked in whose local 5pm cutoff has
 * passed, and automatically checks them out at exactly that cutoff
 * instant (not "now"), regardless of when the sweep actually runs.
 * @returns {Promise<number>} number of records automatically checked out
 */
export async function runAutoCheckoutSweep() {
  const now = new Date();

  const openRecords = await prisma.attendance.findMany({
    where: { checkOutTime: null, checkInTimezone: { not: null } },
    select: { id: true, workDate: true, checkInTimezone: true, checkInLatitude: true, checkInLongitude: true },
  });

  let checkedOut = 0;
  for (const record of openRecords) {
    const cutoffUtc = localCutoffToUtc(record.workDate, record.checkInTimezone);
    if (!cutoffUtc || cutoffUtc > now) continue;

    // No real GPS reading exists for an automatic checkout, so it reuses
    // the check-in coordinates: this keeps checkOutGPS populated (instead
    // of blank) and doubles as a visible signal, alongside checkoutType,
    // that the checkout wasn't a manually captured location.
    //
    // Conditional update: only applies if the record is still open, so a
    // concurrent manual checkout or another sweep can never be overwritten
    // or double-processed (Postgres row-level locking makes this atomic).
    const result = await prisma.attendance.updateMany({
      where: { id: record.id, checkOutTime: null },
      data: {
        checkOutTime: cutoffUtc,
        checkoutType: 'AUTOMATIC',
        checkOutLatitude: record.checkInLatitude,
        checkOutLongitude: record.checkInLongitude,
      },
    });
    if (result.count === 1) checkedOut += 1;
  }

  return checkedOut;
}

let sweepInFlight = false;

export function startAutoCheckoutScheduler() {
  // Every minute: cheap query (at most a handful of open records for a
  // small org), and precise enough that "ran a few minutes late" still
  // reports the correct 5:00 PM cutoff rather than the run time.
  cron.schedule('* * * * *', async () => {
    if (sweepInFlight) return;
    sweepInFlight = true;
    try {
      const count = await runAutoCheckoutSweep();
      if (count > 0) console.log(`Auto-checkout: checked out ${count} employee(s).`);
    } catch (error) {
      console.error('Auto-checkout sweep failed:', error);
    } finally {
      sweepInFlight = false;
    }
  });
}
