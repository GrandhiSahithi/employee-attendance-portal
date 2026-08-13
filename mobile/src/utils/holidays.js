/**
 * US Federal Holidays
 * ====================
 * Computed programmatically for any year (no hardcoded year list, no
 * external API/network dependency) so the leave calendar always has
 * correct holiday dates, including the "nth weekday of month" ones
 * that shift every year (e.g. Thanksgiving, Labor Day).
 */

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** nth (1-based) occurrence of a weekday (0=Sun..6=Sat) in a given month (0-indexed). */
function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(year, month, 1);
  const day = 1 + ((7 + weekday - first.getDay()) % 7) + (n - 1) * 7;
  return toDateString(new Date(year, month, day));
}

/** last occurrence of a weekday (0=Sun..6=Sat) in a given month (0-indexed). */
function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(year, month + 1, 0);
  const day = last.getDate() - ((7 + last.getDay() - weekday) % 7);
  return toDateString(new Date(year, month, day));
}

export function getUSFederalHolidays(year) {
  return [
    { date: `${year}-01-01`, name: "New Year's Day" },
    { date: nthWeekdayOfMonth(year, 0, 1, 3), name: 'Martin Luther King Jr. Day' },
    { date: nthWeekdayOfMonth(year, 1, 1, 3), name: "Presidents' Day" },
    { date: lastWeekdayOfMonth(year, 4, 1), name: 'Memorial Day' },
    { date: `${year}-06-19`, name: 'Juneteenth' },
    { date: `${year}-07-04`, name: 'Independence Day' },
    { date: nthWeekdayOfMonth(year, 8, 1, 1), name: 'Labor Day' },
    { date: nthWeekdayOfMonth(year, 9, 1, 2), name: 'Columbus Day' },
    { date: `${year}-11-11`, name: 'Veterans Day' },
    { date: nthWeekdayOfMonth(year, 10, 4, 4), name: 'Thanksgiving Day' },
    { date: `${year}-12-25`, name: 'Christmas Day' },
  ];
}

/** Map of "YYYY-MM-DD" -> holiday name, for every year from startYear to endYear inclusive. */
export function getHolidayMap(startYear, endYear) {
  const map = {};
  for (let year = startYear; year <= endYear; year += 1) {
    for (const holiday of getUSFederalHolidays(year)) map[holiday.date] = holiday.name;
  }
  return map;
}
