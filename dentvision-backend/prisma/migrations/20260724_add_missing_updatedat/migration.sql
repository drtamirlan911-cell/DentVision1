-- Add missing updatedAt columns to match Prisma schema

ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "clinic_members" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;