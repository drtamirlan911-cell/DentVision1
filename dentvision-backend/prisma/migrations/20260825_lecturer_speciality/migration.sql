-- Lecturer.speciality was a required field in the Academy tab's create-lecturer
-- form and displayed in three places in the UI, but had no backing column.
-- Production already contained this column, so keep the migration idempotent.
ALTER TABLE "lecturers" ADD COLUMN IF NOT EXISTS "speciality" TEXT;

-- Lecturer.userId (String @unique) existed with no declared relation to User.
-- Add the FK only when it is not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lecturers_userId_fkey'
      AND conrelid = 'lecturers'::regclass
  ) THEN
    ALTER TABLE "lecturers" ADD CONSTRAINT "lecturers_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
