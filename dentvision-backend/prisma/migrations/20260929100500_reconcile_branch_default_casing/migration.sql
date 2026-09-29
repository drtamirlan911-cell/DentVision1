-- Production schema reconciliation: Prisma Branch.isDefault is a camel-case
-- physical column (there is no @map on the canonical model). The previous
-- reconciliation added an unused snake_case column; keep it for compatibility
-- but create the actual Prisma column required by the generated client.
ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "branches_one_isDefault_per_organization"
  ON "branches" ("organization_id")
  WHERE "isDefault" = true AND "organization_id" IS NOT NULL;
