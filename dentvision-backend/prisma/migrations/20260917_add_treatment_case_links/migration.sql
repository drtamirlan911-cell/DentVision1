-- Canonical TreatmentCase graph links.
-- Existing rows remain NULL: there is no safe historical attribution to a case.
-- All links are nullable so the migration is lossless and existing workflows keep working.

ALTER TABLE "appointments"
  ADD COLUMN "treatmentCaseId" TEXT;

ALTER TABLE "lab_orders"
  ADD COLUMN "treatmentCaseId" TEXT;

ALTER TABLE "invoices"
  ADD COLUMN "treatmentCaseId" TEXT;

ALTER TABLE "treatment_plans"
  ADD COLUMN "treatmentCaseId" TEXT;

ALTER TABLE "referrals"
  ADD COLUMN "treatmentCaseId" TEXT;

ALTER TABLE "visits"
  ADD COLUMN "treatmentCaseId" TEXT;

CREATE INDEX "appointments_treatmentCaseId_idx" ON "appointments"("treatmentCaseId");
CREATE INDEX "lab_orders_treatmentCaseId_idx" ON "lab_orders"("treatmentCaseId");
CREATE INDEX "invoices_treatmentCaseId_idx" ON "invoices"("treatmentCaseId");
CREATE INDEX "treatment_plans_treatmentCaseId_idx" ON "treatment_plans"("treatmentCaseId");
CREATE INDEX "referrals_treatmentCaseId_idx" ON "referrals"("treatmentCaseId");
CREATE INDEX "visits_treatmentCaseId_idx" ON "visits"("treatmentCaseId");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_treatmentCaseId_fkey"
  FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lab_orders"
  ADD CONSTRAINT "lab_orders_treatmentCaseId_fkey"
  FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_treatmentCaseId_fkey"
  FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "treatment_plans"
  ADD CONSTRAINT "treatment_plans_treatmentCaseId_fkey"
  FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "referrals"
  ADD CONSTRAINT "referrals_treatmentCaseId_fkey"
  FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visits"
  ADD CONSTRAINT "visits_treatmentCaseId_fkey"
  FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
