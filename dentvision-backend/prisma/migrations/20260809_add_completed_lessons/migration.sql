-- Add completedLessons field to SchoolEnrollment.
-- Some historical databases were created without the optional school_enrollments
-- table. Keep this migration deploy-safe instead of failing the entire chain.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'school_enrollments'
  ) THEN
    ALTER TABLE "school_enrollments"
      ADD COLUMN IF NOT EXISTS "completedLessons" JSONB;
  END IF;
END $$;
