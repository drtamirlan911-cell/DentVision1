-- Production schema reconciliation: Branch.isDefault is canonical in Prisma
-- and required by organization/academy bootstrap. Some production databases
-- were created from an earlier branch migration whose state was later marked
-- rolled back, leaving the physical column absent while Prisma reported no
-- pending migrations.
ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "branches_one_default_per_organization"
  ON "branches" ("organization_id")
  WHERE "is_default" = true AND "organization_id" IS NOT NULL;
