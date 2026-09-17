-- Canonical TreatmentCase graph: every clinical record may point to one case.
-- This migration is additive and safe for historical rows.

CREATE INDEX IF NOT EXISTS "appointments_treatmentCaseId_idx" ON "appointments" ("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "lab_orders_treatmentCaseId_idx" ON "lab_orders" ("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "invoices_treatmentCaseId_idx" ON "invoices" ("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "treatment_plans_treatmentCaseId_idx" ON "treatment_plans" ("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "referrals_treatmentCaseId_idx" ON "referrals" ("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "visits_treatmentCaseId_idx" ON "visits" ("treatmentCaseId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_treatmentCaseId_fkey') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lab_orders_treatmentCaseId_fkey') THEN
    ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_treatmentCaseId_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plans_treatmentCaseId_fkey') THEN
    ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_treatmentCaseId_fkey') THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visits_treatmentCaseId_fkey') THEN
    ALTER TABLE "visits" ADD CONSTRAINT "visits_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Every create writer inherits the case at the database boundary. This covers
-- Prisma, legacy REST, partner endpoints, jobs and future services equally.
-- Automatic inheritance happens only when there is exactly one active/on-hold
-- case for the patient. Multiple concurrent cases are never guessed.
-- Explicit caseId is validated against the patient's clinic and patient.
CREATE OR REPLACE FUNCTION "dentvision_inherit_treatment_case"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_id text;
  v_clinic_id text;
  v_case_count integer;
  v_case_id text;
  v_requested_case text;
  v_case_patient text;
  v_case_clinic text;
BEGIN
  v_patient_id := NEW."patientId";
  v_requested_case := NEW."treatmentCaseId";
  IF v_patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p."clinicId" INTO v_clinic_id
    FROM "patients" p
   WHERE p."id" = v_patient_id AND p."deletedAt" IS NULL
   LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_requested_case IS NOT NULL THEN
    SELECT tc."patientId", tc."clinicId"
      INTO v_case_patient, v_case_clinic
      FROM "treatment_cases" tc
     WHERE tc."id" = v_requested_case AND tc."deletedAt" IS NULL
     LIMIT 1;
    IF v_case_patient IS NULL THEN
      RAISE EXCEPTION 'TreatmentCase % not found or archived', v_requested_case USING ERRCODE = '23503';
    END IF;
    IF v_case_patient <> v_patient_id OR v_case_clinic <> v_clinic_id THEN
      RAISE EXCEPTION 'TreatmentCase % does not belong to patient % and clinic %', v_requested_case, v_patient_id, v_clinic_id USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT COUNT(*), MIN(tc."id")
    INTO v_case_count, v_case_id
    FROM "treatment_cases" tc
   WHERE tc."clinicId" = v_clinic_id
     AND tc."patientId" = v_patient_id
     AND tc."deletedAt" IS NULL
     AND tc."status" IN ('active', 'on_hold');

  IF v_case_count = 1 THEN
    NEW."treatmentCaseId" := v_case_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "appointments_inherit_treatment_case" ON "appointments";
CREATE TRIGGER "appointments_inherit_treatment_case" BEFORE INSERT ON "appointments"
FOR EACH ROW EXECUTE FUNCTION "dentvision_inherit_treatment_case"();

DROP TRIGGER IF EXISTS "lab_orders_inherit_treatment_case" ON "lab_orders";
CREATE TRIGGER "lab_orders_inherit_treatment_case" BEFORE INSERT ON "lab_orders"
FOR EACH ROW EXECUTE FUNCTION "dentvision_inherit_treatment_case"();

DROP TRIGGER IF EXISTS "invoices_inherit_treatment_case" ON "invoices";
CREATE TRIGGER "invoices_inherit_treatment_case" BEFORE INSERT ON "invoices"
FOR EACH ROW EXECUTE FUNCTION "dentvision_inherit_treatment_case"();

DROP TRIGGER IF EXISTS "treatment_plans_inherit_treatment_case" ON "treatment_plans";
CREATE TRIGGER "treatment_plans_inherit_treatment_case" BEFORE INSERT ON "treatment_plans"
FOR EACH ROW EXECUTE FUNCTION "dentvision_inherit_treatment_case"();

DROP TRIGGER IF EXISTS "referrals_inherit_treatment_case" ON "referrals";
CREATE TRIGGER "referrals_inherit_treatment_case" BEFORE INSERT ON "referrals"
FOR EACH ROW EXECUTE FUNCTION "dentvision_inherit_treatment_case"();

DROP TRIGGER IF EXISTS "visits_inherit_treatment_case" ON "visits";
CREATE TRIGGER "visits_inherit_treatment_case" BEFORE INSERT ON "visits"
FOR EACH ROW EXECUTE FUNCTION "dentvision_inherit_treatment_case"();
