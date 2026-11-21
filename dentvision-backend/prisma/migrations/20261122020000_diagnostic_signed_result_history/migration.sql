-- Preserve each signed diagnostic report as an immutable version.
CREATE TABLE IF NOT EXISTS "diagnostic_result_versions" (
  "id" TEXT NOT NULL,
  "diagnosticResultId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "reportText" TEXT,
  "conclusion" TEXT,
  "signedBy" TEXT,
  "signedAt" TIMESTAMP(3),
  "changeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "diagnostic_result_versions_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnostic_result_versions_diagnosticResultId_fkey'
  ) THEN
    ALTER TABLE "diagnostic_result_versions"
      ADD CONSTRAINT "diagnostic_result_versions_diagnosticResultId_fkey"
      FOREIGN KEY ("diagnosticResultId") REFERENCES "diagnostic_results"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "diagnostic_result_versions_diagnosticResultId_version_key"
  ON "diagnostic_result_versions"("diagnosticResultId", "version");
CREATE INDEX IF NOT EXISTS "diagnostic_result_versions_signedBy_signedAt_idx"
  ON "diagnostic_result_versions"("signedBy", "signedAt");

-- Backfill legacy signed reports as version 1 before the new write path is enabled.
INSERT INTO "diagnostic_result_versions" (
  "id", "diagnosticResultId", "version", "reportText", "conclusion",
  "signedBy", "signedAt", "changeReason", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  result."id",
  1,
  result."reportText",
  result."conclusion",
  result."signedBy",
  result."signedAt",
  NULL,
  COALESCE(result."signedAt", result."createdAt")
FROM "diagnostic_results" AS result
WHERE result."signedAt" IS NOT NULL
ON CONFLICT ("diagnosticResultId", "version") DO NOTHING;
