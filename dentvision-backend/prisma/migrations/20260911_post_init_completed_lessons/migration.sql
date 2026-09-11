-- Compatibility follow-up for 20260809_add_completed_lessons.
-- init_full_schema is applied lexically after dated migrations, so the original
-- migration must be safe before the base table exists; this applies the schema
-- change once the legacy base schema is guaranteed to be present.
ALTER TABLE "school_enrollments"
  ADD COLUMN IF NOT EXISTS "completedLessons" JSONB;
