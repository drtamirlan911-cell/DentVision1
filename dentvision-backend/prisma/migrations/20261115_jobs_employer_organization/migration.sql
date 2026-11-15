-- Make each employer vacancy belong to a verified Organization workspace.
-- Existing clinic-linked vacancies retain clinicId; legacy rows remain unchanged.
ALTER TABLE "job_vacancies"
  ADD COLUMN IF NOT EXISTS "employerOrganizationId" TEXT;

CREATE INDEX IF NOT EXISTS "job_vacancies_employerOrganizationId_idx"
  ON "job_vacancies" ("employerOrganizationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_vacancies_employerOrganizationId_fkey'
  ) THEN
    ALTER TABLE "job_vacancies"
      ADD CONSTRAINT "job_vacancies_employerOrganizationId_fkey"
      FOREIGN KEY ("employerOrganizationId")
      REFERENCES "organizations"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
