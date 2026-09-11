-- Finalize Google sign-in fields after the legacy init_full_schema migration.
-- The dated migration 20260810_google_sign_in runs before init_full_schema on a
-- fresh database, so users may not exist yet. This compatibility migration is
-- intentionally idempotent and applies the schema changes once users exists.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");
  END IF;
END $$;
