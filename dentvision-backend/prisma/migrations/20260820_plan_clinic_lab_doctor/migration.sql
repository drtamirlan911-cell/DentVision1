-- Two links the data was missing, both additive.
--
-- The base V2 schema is not created by this migration chain in every deployment
-- topology, so all changes are guarded by table existence. This keeps migrate
-- deploy safe on a fresh database while preserving the additive migration for
-- installations where the V2 tables already exist.

DO $$
BEGIN
  IF to_regclass('public.treatment_plans') IS NOT NULL THEN
    ALTER TABLE "treatment_plans" ADD COLUMN IF NOT EXISTS "clinicId" TEXT;

    IF to_regclass('public.patients') IS NOT NULL THEN
      UPDATE "treatment_plans" AS tp
      SET "clinicId" = p."clinicId"
      FROM "patients" AS p
      WHERE tp."patientId" = p."id" AND tp."clinicId" IS NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS "treatment_plans_clinicId_idx"
      ON "treatment_plans"("clinicId");

    IF to_regclass('public.clinics') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = 'treatment_plans_clinicId_fkey'
       ) THEN
      ALTER TABLE "treatment_plans"
        ADD CONSTRAINT "treatment_plans_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "clinics"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.lab_orders') IS NOT NULL THEN
    ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "doctorId" TEXT;

    CREATE INDEX IF NOT EXISTS "lab_orders_doctorId_idx"
      ON "lab_orders"("doctorId");

    IF to_regclass('public.users') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = 'lab_orders_doctorId_fkey'
       ) THEN
      ALTER TABLE "lab_orders"
        ADD CONSTRAINT "lab_orders_doctorId_fkey"
        FOREIGN KEY ("doctorId") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
