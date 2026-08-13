/**
 * One-off backfill: derive checkInTimezone for Attendance rows created
 * before the timezone column existed, using their stored check-in
 * coordinates. Safe to re-run; only touches rows where checkInTimezone
 * is still null.
 *
 * Run once after applying the add_attendance_timezone_and_checkout_type
 * migration:
 *   node prisma/backfillTimezones.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { resolveTimezoneFromCoordinates } from '../src/utils/timezone.js';

const prisma = new PrismaClient();

const rows = await prisma.attendance.findMany({
  where: { checkInTimezone: null },
  select: { id: true, checkInLatitude: true, checkInLongitude: true },
});

let updated = 0;
for (const row of rows) {
  const timezone = resolveTimezoneFromCoordinates(row.checkInLatitude, row.checkInLongitude);
  await prisma.attendance.update({ where: { id: row.id }, data: { checkInTimezone: timezone } });
  updated += 1;
}

console.log(`Backfilled checkInTimezone for ${updated} of ${rows.length} row(s).`);
await prisma.$disconnect();
