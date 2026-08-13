-- Decouple Team from Department: a Team is now owned by exactly one
-- Manager/Head Manager (managerId), independent of Department. Every
-- existing team already has exactly one MANAGER/HEAD_MANAGER member, so
-- that person is promoted to be its explicit manager.

ALTER TABLE "Team" ADD COLUMN "managerId" TEXT;

UPDATE "Team" t
SET "managerId" = u.id
FROM "User" u
WHERE u."teamId" = t.id AND u.role IN ('MANAGER', 'HEAD_MANAGER');

ALTER TABLE "Team" ADD CONSTRAINT "Team_managerId_key" UNIQUE ("managerId");
ALTER TABLE "Team" ADD CONSTRAINT "Team_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_departmentId_fkey";
DROP INDEX IF EXISTS "Team_departmentId_idx";
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_departmentId_name_key";
ALTER TABLE "Team" DROP COLUMN "departmentId";

-- Team names are now global (no longer scoped per department).
ALTER TABLE "Team" ADD CONSTRAINT "Team_name_key" UNIQUE ("name");
