/**
 * Attendance & Leave Analytics
 * ============================
 * Shared computation used by both the JSON analytics endpoint and the
 * CSV/PDF export, so the numbers are always identical between what a
 * manager sees on screen and what they download.
 */

import { DateTime } from 'luxon';
import { prisma } from '../db.js';
import { currentDateOnly, subtractDays } from './date.js';

// A check-in at or before this local hour counts as "on time." No shift
// scheduling exists yet in this app, so this is a single global default —
// adjust here if the business wants a different cutoff.
const PUNCTUALITY_CUTOFF_HOUR = 9;

function isWeekday(date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function countWeekdays(from, to) {
  let count = 0;
  for (const cursor = new Date(from); cursor <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (isWeekday(cursor)) count += 1;
  }
  return count;
}

function leaveBalanceStatus(employee) {
  const annualBase = { HEAD_MANAGER: 25, MANAGER: 22, EMPLOYEE: 20 }[employee.role] ?? 20;
  if (employee.availableLeaveDays < 3) return 'LOW';
  if (employee.availableLeaveDays > annualBase) return 'HIGH';
  return 'NORMAL';
}

/**
 * @param {object} visibilityWhereClause Prisma where-clause scoping which
 *   users are visible (Manager -> direct reports, Head Manager -> everyone).
 * @param {number} rangeDays how many trailing days (including today) to analyze
 */
export async function buildAnalytics(visibilityWhereClause, rangeDays) {
  const to = currentDateOnly();
  const from = subtractDays(to, rangeDays - 1);
  const workingDays = countWeekdays(from, to);

  const employees = await prisma.user.findMany({
    where: visibilityWhereClause,
    include: {
      department: true,
      team: true,
      attendances: { where: { workDate: { gte: from, lte: to } } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  const rows = employees.map((employee) => {
    const records = employee.attendances;
    const presentDays = records.length;
    const onTimeDays = records.filter((record) => {
      const zone = record.checkInTimezone || 'Etc/UTC';
      const local = DateTime.fromJSDate(record.checkInTime).setZone(zone);
      return local.hour < PUNCTUALITY_CUTOFF_HOUR || (local.hour === PUNCTUALITY_CUTOFF_HOUR && local.minute === 0);
    }).length;

    return {
      id: employee.id,
      name: employee.name,
      employeeId: employee.employeeId,
      role: employee.role,
      department: employee.department?.name || null,
      team: employee.team?.name || null,
      presentDays,
      attendancePercent: workingDays ? Math.round((presentDays / workingDays) * 1000) / 10 : 0,
      punctualityPercent: presentDays ? Math.round((onTimeDays / presentDays) * 1000) / 10 : null,
      availableLeaveDays: Math.round(employee.availableLeaveDays * 100) / 100,
      leaveBalanceStatus: leaveBalanceStatus(employee),
    };
  });

  return { from, to, workingDays, employees: rows };
}

export function analyticsToCsv(analytics) {
  const header = [
    'Name', 'Employee ID', 'Role', 'Department', 'Team',
    'Present Days', 'Working Days', 'Attendance %', 'Punctuality %',
    'Leave Balance', 'Leave Status',
  ];
  const lines = [header.join(',')];

  for (const row of analytics.employees) {
    const cells = [
      row.name, row.employeeId, row.role, row.department || '', row.team || '',
      row.presentDays, analytics.workingDays, row.attendancePercent,
      row.punctualityPercent ?? '', row.availableLeaveDays, row.leaveBalanceStatus,
    ].map((cell) => {
      const value = String(cell);
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    });
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}
