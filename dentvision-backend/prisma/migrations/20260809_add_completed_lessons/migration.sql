-- Add completedLessons field to SchoolEnrollment.
--
-- IF NOT EXISTS for the same reason as the notification-preferences migration:
-- a bare ADD COLUMN fails with 42701 on a re-run and a failed migration blocks
-- every migration after it in the chain.
ALTER TABLE "school_enrollments" ADD COLUMN IF NOT EXISTS "completedLessons" JSONB;
