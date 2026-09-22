-- DentVision IAM v2: Organization -> Branch foundation.
-- Transitional compatibility: clinic_id remains nullable while operational
-- records are migrated from clinic scope to branch scope incrementally.

CREATE TABLE IF NOT EXISTS "branches" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "clinic_id" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "settings" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "clinic_id" TEXT;

-- If the earlier clinic-owned bootstrap created branches, derive the owning
-- Organization through Organization.originalId for legacy clinic mappings.
UPDATE "branches" b
SET "organization_id" = o."id"
FROM "organizations" o
WHERE b."organization_id" IS NULL
  AND b."clinic_id" IS NOT NULL
  AND o."original_id" = b."clinic_id"
  AND o."original_type" = 'Clinic';

-- branch_id is the canonical physical column. The Prisma model maps
-- ClinicMember.branchId to it with @map("branch_id").
ALTER TABLE "clinic_members"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

CREATE INDEX IF NOT EXISTS "branches_organization_id_idx"
  ON "branches" ("organization_id");

CREATE INDEX IF NOT EXISTS "branches_organization_id_active_idx"
  ON "branches" ("organization_id", "active");

CREATE INDEX IF NOT EXISTS "branches_clinic_id_idx"
  ON "branches" ("clinic_id");

CREATE UNIQUE INDEX IF NOT EXISTS "branches_organization_id_code_key"
  ON "branches" ("organization_id", "code");

CREATE INDEX IF NOT EXISTS "clinic_members_branch_id_idx"
  ON "clinic_members" ("branch_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'branches_organization_id_fkey'
  ) THEN
    ALTER TABLE "branches"
      ADD CONSTRAINT "branches_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'branches_clinic_id_fkey'
  ) THEN
    ALTER TABLE "branches"
      ADD CONSTRAINT "branches_clinic_id_fkey"
      FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinic_members_branch_id_fkey'
  ) THEN
    ALTER TABLE "clinic_members"
      ADD CONSTRAINT "clinic_members_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
