-- Add completedLessons field to SchoolEnrollment.
-- The legacy init schema may be applied later in the migration ordering, so
-- this migration must remain safe on a fresh database where the table does
-- not exist yet. A later compatibility migration can add the field after the
-- base schema is present.
DO $$
BEGIN
  IF to_regclass('public.school_enrollments') IS NOT NULL THEN
    ALTER TABLE "school_enrollments" ADD COLUMN IF NOT EXISTS "completedLessons" JSONB;
  END IF;
END $$;
