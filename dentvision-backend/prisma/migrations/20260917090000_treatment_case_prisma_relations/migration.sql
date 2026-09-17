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
