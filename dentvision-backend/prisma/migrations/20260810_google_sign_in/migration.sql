-- Google sign-in.
--
-- This migration can run before the legacy `init_full_schema` migration on a
-- fresh database. The users table may therefore not exist yet; the final
-- schema changes are applied by 20260912_finalize_google_sign_in after the
-- base schema exists.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");
  END IF;
END $$;
