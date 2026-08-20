/**
 * Date-Only Helpers
 * =================
 * Attendance/leave records are keyed by a calendar date (no time-of-day),
 * always stored as a UTC-midnight Date so a "workDate" or leave day means
 * the same calendar date everywhere regardless of server/client timezone.
 * These helpers create, parse, and do simple arithmetic on that shape.
 */

/**
 * Parse a "YYYY-MM-DD" string into a UTC-midnight Date.
 * @param {string} value - Date string in YYYY-MM-DD format
 * @returns {Date|null} UTC-midnight Date, or null if the input isn't valid
 */
export function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Today's calendar date (server local Y/M/D) as a UTC-midnight Date.
 * @returns {Date}
 */
export function currentDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Derive the UTC-midnight work date from a captured timestamp (e.g. a
 * check-in's capturedAt), defaulting to now if none is given.
 * @param {string|undefined} capturedAt - ISO timestamp string
 * @returns {Date|null} UTC-midnight Date, or null if capturedAt is invalid
 */
export function dateOnlyFromCapturedAt(capturedAt) {
  const date = capturedAt ? new Date(capturedAt) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Number of calendar days spanned by [from, to], inclusive of both ends.
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
export function inclusiveDays(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
}

/**
 * Return a new UTC-midnight date `days` before the given date.
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
export function subtractDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}
