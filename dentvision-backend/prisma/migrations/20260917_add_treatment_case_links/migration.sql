-- Canonical TreatmentCase graph.
-- The Prisma model existed in schema.prisma but the deployed migration history
-- did not materialize treatment_cases. This migration closes that gap first,
-- then adds nullable links from the existing clinical records.

DO $$
BEGIN
  CREATE TYPE "CaseStatus" AS ENUM ('active', 'on_hold', 'completed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "treatment_cases" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "CaseStatus" NOT NULL DEFAULT 'active',
  "chiefComplaint" TEXT,
  "diagnosisCodes" JSONB,
  "metadata" JSONB,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "treatment_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "treatment_cases_clinicId_idx" ON "treatment_cases"("clinicId");
CREATE INDEX IF NOT EXISTS "treatment_cases_patientId_idx" ON "treatment_cases"("patientId");
CREATE INDEX IF NOT EXISTS "treatment_cases_status_idx" ON "treatment_cases"("status");

DO $$
BEGIN
  ALTER TABLE "treatment_cases"
    ADD CONSTRAINT "treatment_cases_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "treatment_cases"
    ADD CONSTRAINT "treatment_cases_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;

ALTER TABLE "lab_orders"
  ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;

ALTER TABLE "treatment_plans"
  ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;

ALTER TABLE "referrals"
  ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;

ALTER TABLE "visits"
  ADD COLUMN IF NOT EXISTS "treatmentCaseId" TEXT;

CREATE INDEX IF NOT EXISTS "appointments_treatmentCaseId_idx" ON "appointments"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "lab_orders_treatmentCaseId_idx" ON "lab_orders"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "invoices_treatmentCaseId_idx" ON "invoices"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "treatment_plans_treatmentCaseId_idx" ON "treatment_plans"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "referrals_treatmentCaseId_idx" ON "referrals"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "visits_treatmentCaseId_idx" ON "visits"("treatmentCaseId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_treatmentCaseId_fkey') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lab_orders_treatmentCaseId_fkey') THEN
    ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_treatmentCaseId_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plans_treatmentCaseId_fkey') THEN
    ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_treatmentCaseId_fkey') THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visits_treatmentCaseId_fkey') THEN
    ALTER TABLE "visits" ADD CONSTRAINT "visits_treatmentCaseId_fkey"
      FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
