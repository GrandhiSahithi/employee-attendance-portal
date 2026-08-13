-- AlterTable: widen availableLeaveDays from INTEGER to DOUBLE PRECISION so
-- monthly accrual can grant fractional days (e.g. 1.67/month). Safe widening
-- conversion, no data loss for existing whole-number balances.
ALTER TABLE "User" ALTER COLUMN "availableLeaveDays" TYPE DOUBLE PRECISION USING "availableLeaveDays"::double precision;

-- AlterTable: track the last month accrual was granted, so the monthly job
-- is idempotent (never double-grants if it runs more than once in a month).
ALTER TABLE "User" ADD COLUMN "lastAccrualAt" TIMESTAMP(3);
