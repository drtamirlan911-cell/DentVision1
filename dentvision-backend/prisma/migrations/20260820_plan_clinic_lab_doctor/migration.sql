-- Two links the data was missing, both additive.
--
-- 1. `treatment_plans.clinicId` — a plan knew only its patient, so the clinic
--    was reachable only by joining through `patients`. `treatment_plan_releases`
--    already denormalises `clinicId` for precisely this reason; the plan itself
--    should not be the one row in that chain that cannot say where it belongs.
--
-- 2. `lab_orders.doctorId` — the dental-lab workflow starts at the doctor, and
--    that first step was recorded nowhere.
--
-- Both columns are nullable and neither drops or rewrites anything. Only the
-- plan's clinic is backfilled: it is derivable from the patient and therefore
-- recoverable. A lab order's doctor is not derivable from anything, so old rows
-- stay NULL rather than being given an invented attribution for clinical work.
--
-- Idempotent throughout; mirrored as a runOnceMigration block in src/index.ts,
-- because `prisma migrate deploy` has not reliably reached production here.

ALTER TABLE "treatment_plans" ADD COLUMN IF NOT EXISTS "clinicId" TEXT;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "doctorId" TEXT;

-- Backfill before the index, so the index is built once over final data.
-- `WHERE "clinicId" IS NULL` keeps a re-run from touching rows already set —
-- including any a newer writer set to something other than the patient's clinic.
UPDATE "treatment_plans" AS tp
SET "clinicId" = p."clinicId"
FROM "patients" AS p
WHERE tp."patientId" = p."id" AND tp."clinicId" IS NULL;

CREATE INDEX IF NOT EXISTS "treatment_plans_clinicId_idx" ON "treatment_plans"("clinicId");
CREATE INDEX IF NOT EXISTS "lab_orders_doctorId_idx" ON "lab_orders"("doctorId");

-- ON DELETE SET NULL on both: deleting a clinic or a user must not take
-- treatment plans or lab orders with it. Guarded so a re-run does not fail on
-- an existing constraint.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plans_clinicId_fkey') THEN
    ALTER TABLE "treatment_plans"
      ADD CONSTRAINT "treatment_plans_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lab_orders_doctorId_fkey') THEN
    ALTER TABLE "lab_orders"
      ADD CONSTRAINT "lab_orders_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
