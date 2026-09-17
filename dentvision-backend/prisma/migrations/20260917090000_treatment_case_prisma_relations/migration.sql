-- Canonical TreatmentCase foreign-key graph.
-- The columns are nullable so legacy CRM records remain valid.
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;
ALTER TABLE "treatment_plans" ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;

CREATE INDEX IF NOT EXISTS "appointments_treatmentCaseId_idx" ON "appointments"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "visits_treatmentCaseId_idx" ON "visits"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "treatment_plans_treatmentCaseId_idx" ON "treatment_plans"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "referrals_treatmentCaseId_idx" ON "referrals"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "lab_orders_treatmentCaseId_idx" ON "lab_orders"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "invoices_treatmentCaseId_idx" ON "invoices"("treatmentCaseId");

DO $$ BEGIN
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_treatmentCaseId_fkey"
    FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "visits" ADD CONSTRAINT "visits_treatmentCaseId_fkey"
    FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_treatmentCaseId_fkey"
    FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_treatmentCaseId_fkey"
    FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_treatmentCaseId_fkey"
    FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_treatmentCaseId_fkey"
    FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Writer-independent automatic inheritance. The database is the final guard,
-- so Prisma, legacy REST and partner/worker code receive identical behavior.
CREATE OR REPLACE FUNCTION dentvision_inherit_treatment_case()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_patient_id TEXT;
  v_clinic_id TEXT;
  v_case_id TEXT;
  v_case_count INTEGER;
BEGIN
  v_patient_id := NEW."patientId";
  IF TG_TABLE_NAME IN ('appointments','treatment_plans','referrals','lab_orders','invoices') THEN
    v_clinic_id := NEW."clinicId";
  ELSIF TG_TABLE_NAME = 'visits' THEN
    SELECT p."clinicId" INTO v_clinic_id FROM "patients" p WHERE p."id" = v_patient_id;
  END IF;

  IF NEW."treatmentCaseId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM "treatment_cases" c
      WHERE c."id" = NEW."treatmentCaseId"
        AND c."patientId" = v_patient_id
        AND c."clinicId" = v_clinic_id
    ) THEN
      RAISE EXCEPTION 'TREATMENT_CASE_NOT_FOUND';
    END IF;
    RETURN NEW;
  END IF;

  IF v_patient_id IS NULL OR v_clinic_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*), min(c."id") INTO v_case_count, v_case_id
  FROM "treatment_cases" c
  WHERE c."patientId" = v_patient_id
    AND c."clinicId" = v_clinic_id
    AND c."status" IN ('active', 'on_hold')
    AND c."deletedAt" IS NULL;

  IF v_case_count = 1 THEN NEW."treatmentCaseId" := v_case_id; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "appointments_treatment_case_inherit" ON "appointments";
CREATE TRIGGER "appointments_treatment_case_inherit" BEFORE INSERT ON "appointments" FOR EACH ROW EXECUTE FUNCTION dentvision_inherit_treatment_case();
DROP TRIGGER IF EXISTS "visits_treatment_case_inherit" ON "visits";
CREATE TRIGGER "visits_treatment_case_inherit" BEFORE INSERT ON "visits" FOR EACH ROW EXECUTE FUNCTION dentvision_inherit_treatment_case();
DROP TRIGGER IF EXISTS "treatment_plans_treatment_case_inherit" ON "treatment_plans";
CREATE TRIGGER "treatment_plans_treatment_case_inherit" BEFORE INSERT ON "treatment_plans" FOR EACH ROW EXECUTE FUNCTION dentvision_inherit_treatment_case();
DROP TRIGGER IF EXISTS "referrals_treatment_case_inherit" ON "referrals";
CREATE TRIGGER "referrals_treatment_case_inherit" BEFORE INSERT ON "referrals" FOR EACH ROW EXECUTE FUNCTION dentvision_inherit_treatment_case();
DROP TRIGGER IF EXISTS "lab_orders_treatment_case_inherit" ON "lab_orders";
CREATE TRIGGER "lab_orders_treatment_case_inherit" BEFORE INSERT ON "lab_orders" FOR EACH ROW EXECUTE FUNCTION dentvision_inherit_treatment_case();
DROP TRIGGER IF EXISTS "invoices_treatment_case_inherit" ON "invoices";
CREATE TRIGGER "invoices_treatment_case_inherit" BEFORE INSERT ON "invoices" FOR EACH ROW EXECUTE FUNCTION dentvision_inherit_treatment_case();
