-- The PATIENT_JOURNEY link the schema was missing: a plan's appointments and
-- invoices were only reachable through the plan's `items.stages[]` JSON blob.
--
-- The V2 bootstrap can be supplied separately from this additive migration
-- chain, so none of the base tables are assumed to exist at this point.
-- When the tables are present, columns, backfill, indexes and foreign keys are
-- applied idempotently. When they are not present, this migration is a safe
-- no-op and the later bootstrap can provide the base schema.

DO $$
BEGIN
  IF to_regclass('public.appointments') IS NOT NULL THEN
    ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "treatmentPlanId" TEXT;
    CREATE INDEX IF NOT EXISTS "appointments_treatmentPlanId_idx"
      ON "appointments"("treatmentPlanId");

    IF to_regclass('public.treatment_plans') IS NOT NULL THEN
      UPDATE "appointments" AS a
      SET "treatmentPlanId" = tp."id"
      FROM "treatment_plans" AS tp,
           LATERAL jsonb_array_elements(COALESCE(tp."items"->'stages', '[]'::jsonb)) AS stage
      WHERE a."treatmentPlanId" IS NULL
        AND stage->>'appointmentId' = a."id";

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'appointments_treatmentPlanId_fkey'
      ) THEN
        ALTER TABLE "appointments"
          ADD CONSTRAINT "appointments_treatmentPlanId_fkey"
          FOREIGN KEY ("treatmentPlanId") REFERENCES "treatment_plans"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.invoices') IS NOT NULL THEN
    ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "treatmentPlanId" TEXT;
    CREATE INDEX IF NOT EXISTS "invoices_treatmentPlanId_idx"
      ON "invoices"("treatmentPlanId");

    IF to_regclass('public.treatment_plans') IS NOT NULL THEN
      UPDATE "invoices" AS i
      SET "treatmentPlanId" = tp."id"
      FROM "treatment_plans" AS tp,
           LATERAL jsonb_array_elements(COALESCE(tp."items"->'stages', '[]'::jsonb)) AS stage
      WHERE i."treatmentPlanId" IS NULL
        AND stage->>'invoiceId' = i."id";

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'invoices_treatmentPlanId_fkey'
      ) THEN
        ALTER TABLE "invoices"
          ADD CONSTRAINT "invoices_treatmentPlanId_fkey"
          FOREIGN KEY ("treatmentPlanId") REFERENCES "treatment_plans"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END IF;
  END IF;
END $$;
