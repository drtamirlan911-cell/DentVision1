-- The PATIENT_JOURNEY link the schema was missing: a plan's appointments and
-- invoices were only reachable through the plan's `items.stages[]` JSON blob
-- (each stage already carries its own `appointmentId`/`invoiceId`, written by
-- `PATCH /crm/treatment-plans/:id/stages/:stageId`), which no `WHERE` clause
-- can join on. This is the plan-level anchor a funnel or reporting query
-- needs — not a replacement for the per-stage JSON link, which stays as the
-- source of truth for "which stage" a visit or bill belongs to.
--
-- Both columns are nullable and additive. Backfilled from the JSON stages
-- that already recorded the association, so nothing here is invented: an
-- appointment or invoice only gets a treatmentPlanId if some stage already
-- named it.
--
-- Idempotent throughout; mirrored as a runOnceMigration block in src/index.ts,
-- because `prisma migrate deploy` has not reliably reached production here.

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "treatmentPlanId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "treatmentPlanId" TEXT;

-- Backfill from the JSON stages, one plan at a time, before the indexes so
-- they're built once over final data. `WHERE ... IS NULL` keeps a re-run from
-- touching rows a newer writer has already set to something else.
UPDATE "appointments" AS a
SET "treatmentPlanId" = tp."id"
FROM "treatment_plans" AS tp,
     LATERAL jsonb_array_elements(COALESCE(tp."items"->'stages', '[]'::jsonb)) AS stage
WHERE a."treatmentPlanId" IS NULL
  AND stage->>'appointmentId' = a."id";

UPDATE "invoices" AS i
SET "treatmentPlanId" = tp."id"
FROM "treatment_plans" AS tp,
     LATERAL jsonb_array_elements(COALESCE(tp."items"->'stages', '[]'::jsonb)) AS stage
WHERE i."treatmentPlanId" IS NULL
  AND stage->>'invoiceId' = i."id";

CREATE INDEX IF NOT EXISTS "appointments_treatmentPlanId_idx" ON "appointments"("treatmentPlanId");
CREATE INDEX IF NOT EXISTS "invoices_treatmentPlanId_idx" ON "invoices"("treatmentPlanId");

-- ON DELETE SET NULL on both: deleting a plan must not take its appointments
-- or invoices with it. Guarded so a re-run does not fail on an existing
-- constraint.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_treatmentPlanId_fkey') THEN
    ALTER TABLE "appointments"
      ADD CONSTRAINT "appointments_treatmentPlanId_fkey"
      FOREIGN KEY ("treatmentPlanId") REFERENCES "treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_treatmentPlanId_fkey') THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_treatmentPlanId_fkey"
      FOREIGN KEY ("treatmentPlanId") REFERENCES "treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
