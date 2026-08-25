-- Lecturer.speciality was a required field in the Academy tab's create-lecturer
-- form and displayed in three places in the UI, but had no backing column —
-- POST /api/lecturers silently dropped it. This is a nullable add, no backfill.
ALTER TABLE "lecturers" ADD COLUMN "speciality" TEXT;

-- Lecturer.userId (String @unique) existed with no declared relation to User,
-- so GET /lecturers could never include the lecturer's name/email — the
-- Academy tab's UI has always shown a placeholder instead. Adds the missing
-- FK; userId is already unique and non-null, so no backfill is needed.
ALTER TABLE "lecturers" ADD CONSTRAINT "lecturers_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
