-- The LLM-rewritten wording for a release, reviewed by a doctor before a
-- patient can see it — Phase 5 of the concierge presentation.
--
-- `script` carries the full PresentationScript JSON. `generatorByBeat`
-- records, per beat id, whether the line is 'template', 'llm', or 'doctor'.
-- `validationReport` is the last ScriptReview from applyRewrite, null until
-- the first generation.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientPresentationStatus') THEN
    CREATE TYPE "PatientPresentationStatus" AS ENUM ('draft', 'published');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "patient_presentations" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'ru',
  "status" "PatientPresentationStatus" NOT NULL DEFAULT 'draft',
  "script" JSONB NOT NULL,
  "generatorByBeat" JSONB NOT NULL,
  "validationReport" JSONB,
  "generatedByUserId" TEXT,
  "generatedAt" TIMESTAMP(3),
  "publishedByUserId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "patient_presentations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patient_presentations_releaseId_locale_key" ON "patient_presentations"("releaseId", "locale");
CREATE INDEX IF NOT EXISTS "patient_presentations_clinicId_status_idx" ON "patient_presentations"("clinicId", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'patient_presentations_releaseId_fkey') THEN
    ALTER TABLE "patient_presentations" ADD CONSTRAINT "patient_presentations_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "treatment_plan_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'patient_presentations_clinicId_fkey') THEN
    ALTER TABLE "patient_presentations" ADD CONSTRAINT "patient_presentations_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
