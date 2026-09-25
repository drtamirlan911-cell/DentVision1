-- DentVision branch foundation
-- Branches are clinic-local operating units. Existing clinics receive one
-- default branch so introducing the model never leaves legacy records without
-- an addressable scope.

CREATE TABLE IF NOT EXISTS "branches" (
  "id" TEXT NOT NULL,
  "clinic_id" TEXT NOT NULL,
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
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branches_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "branches_clinic_id_code_key"
  ON "branches"("clinic_id", "code");
CREATE INDEX IF NOT EXISTS "branches_clinic_id_idx"
  ON "branches"("clinic_id");
CREATE INDEX IF NOT EXISTS "branches_clinic_id_active_idx"
  ON "branches"("clinic_id", "active");

ALTER TABLE "clinic_members"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

CREATE INDEX IF NOT EXISTS "clinic_members_branch_id_idx"
  ON "clinic_members"("branch_id");

DO $$
DECLARE
  c RECORD;
  branch_id TEXT;
BEGIN
  FOR c IN SELECT "id", "name", "city", "address", "phone" FROM "clinics" LOOP
    SELECT "id" INTO branch_id
      FROM "branches"
      WHERE "clinic_id" = c."id" AND "is_default" = true
      LIMIT 1;

    IF branch_id IS NULL THEN
      branch_id := gen_random_uuid()::text;
      INSERT INTO "branches" (
        "id", "clinic_id", "code", "name", "city", "address", "phone", "active", "is_default", "updated_at"
      ) VALUES (
        branch_id, c."id", 'MAIN', c."name", c."city", c."address", c."phone", true, true, CURRENT_TIMESTAMP
      );
    END IF;

    UPDATE "clinic_members"
      SET "branch_id" = branch_id
      WHERE "clinic_id" = c."id" AND "branch_id" IS NULL;
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinic_members_branch_id_fkey') THEN
    ALTER TABLE "clinic_members"
      ADD CONSTRAINT "clinic_members_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "branches_one_default_per_clinic"
  ON "branches"("clinic_id") WHERE "is_default" = true;
