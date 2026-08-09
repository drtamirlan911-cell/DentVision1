-- Add completedLessons field to SchoolEnrollment
ALTER TABLE "school_enrollments" ADD COLUMN "completedLessons" JSONB;
