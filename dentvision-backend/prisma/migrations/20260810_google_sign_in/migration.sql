-- Google sign-in.
--
-- This migration is deploy-safe for databases where the legacy users table has
-- not been created yet. The schema migration remains the source of truth for
-- creating users; this migration only adds Google identity support when users
-- already exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");
  END IF;
END $$;
