-- Lecturer.speciality and Lecturer.userId relation are only applicable when the
-- Academy lecturer table exists at this point in the migration chain. Keep the
-- migration deploy-safe for databases whose schema is bootstrapped later.
DO $$
BEGIN
  IF to_regclass('public.lecturers') IS NOT NULL THEN
    ALTER TABLE "lecturers"
      ADD COLUMN IF NOT EXISTS "speciality" TEXT;

    IF to_regclass('public.users') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM pg_constraint
         WHERE conname = 'lecturers_userId_fkey'
       ) THEN
      ALTER TABLE "lecturers"
        ADD CONSTRAINT "lecturers_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
