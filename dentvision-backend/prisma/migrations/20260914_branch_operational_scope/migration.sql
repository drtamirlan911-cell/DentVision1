-- Branch is an organization boundary with legacy clinic linkage retained during migration.
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
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "clinic_id" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "settings" JSONB;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill organization ownership where the unified organization maps a Clinic.
UPDATE "branches" b
SET "organization_id" = o."id"
FROM "organizations" o
WHERE b."organization_id" IS NULL
  AND b."clinic_id" IS NOT NULL
  AND o."original_type" = 'Clinic'
  AND o."original_id" = b."clinic_id";

ALTER TABLE "clinic_members" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

CREATE INDEX IF NOT EXISTS "branches_organization_id_idx" ON "branches"("organization_id");
CREATE INDEX IF NOT EXISTS "branches_organization_id_active_idx" ON "branches"("organization_id", "active");
CREATE INDEX IF NOT EXISTS "branches_clinic_id_idx" ON "branches"("clinic_id");
CREATE UNIQUE INDEX IF NOT EXISTS "branches_organization_id_code_key" ON "branches"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "clinic_members_branch_id_idx" ON "clinic_members"("branch_id");
CREATE INDEX IF NOT EXISTS "patients_branch_id_idx" ON "patients"("branch_id");
CREATE INDEX IF NOT EXISTS "appointments_branch_id_date_idx" ON "appointments"("branch_id", "date");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_name='branches_organization_id_fkey') THEN
    ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_name='branches_clinic_id_fkey') THEN
    ALTER TABLE "branches" ADD CONSTRAINT "branches_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_name='clinic_members_branch_id_fkey') THEN
    ALTER TABLE "clinic_members" ADD CONSTRAINT "clinic_members_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_name='patients_branch_id_fkey') THEN
    ALTER TABLE "patients" ADD CONSTRAINT "patients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_name='appointments_branch_id_fkey') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
