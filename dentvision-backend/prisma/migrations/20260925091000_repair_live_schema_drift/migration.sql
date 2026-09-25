-- Production schema drift repair.
-- The deployed Prisma schema references these nullable columns, but the live
-- database predates the corresponding schema changes. Keep this migration
-- additive so existing patient/clinic data is preserved.

ALTER TABLE "clinic_members"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

ALTER TABLE "treatment_plans"
  ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;

CREATE INDEX IF NOT EXISTS "clinic_members_clinicId_idx"
  ON "clinic_members" ("clinicId");

CREATE INDEX IF NOT EXISTS "appointments_branch_id_idx"
  ON "appointments" ("branch_id");

CREATE INDEX IF NOT EXISTS "treatment_plans_treatmentCaseId_idx"
  ON "treatment_plans" ("treatmentCaseId");
