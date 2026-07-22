-- Lecturer sellables: courses can also be webinars / textbooks / office.
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "format" TEXT NOT NULL DEFAULT 'course';
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "seats" INTEGER;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "meta" JSONB;

CREATE INDEX IF NOT EXISTS "courses_format_idx" ON "courses"("format");
