-- CreateEnum
CREATE TYPE "CheckoutType" AS ENUM ('MANUAL', 'AUTOMATIC');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "checkInTimezone" TEXT,
ADD COLUMN "checkoutType" "CheckoutType";

-- CreateIndex
CREATE INDEX "Attendance_checkOutTime_idx" ON "Attendance"("checkOutTime");

-- Backfill: derive checkInTimezone for existing rows from their stored check-in
-- coordinates isn't possible in pure SQL (needs a timezone-boundary lookup), so
-- existing open/closed rows are backfilled by a one-off script (see
-- server/prisma/backfillTimezones.js) run once after this migration. New rows
-- always populate checkInTimezone at check-in time going forward.
