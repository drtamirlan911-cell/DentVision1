-- Academy course publication lifecycle.
-- Existing courses stay published for backwards compatibility; archived courses
-- remain available to entitled learners but cannot be discovered or purchased anew.
ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "publicationStatus" TEXT NOT NULL DEFAULT 'published';

UPDATE "courses"
SET "publicationStatus" = 'published'
WHERE "publicationStatus" IS NULL OR "publicationStatus" = '';

ALTER TABLE "courses"
  ALTER COLUMN "publicationStatus" SET DEFAULT 'published',
  ALTER COLUMN "publicationStatus" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "courses_publicationStatus_format_createdAt_idx"
  ON "courses"("publicationStatus", "format", "createdAt");
