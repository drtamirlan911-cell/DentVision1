-- Password reset tokens.
--
-- The table-name probes used double quotes ("User"), which Postgres reads as a
-- column identifier rather than a string literal — the migration failed with
-- 42703 in every database, and a failed migration blocks every migration after
-- it. The foreign key is also guarded by constraint existence: Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS, so re-running used to fail with 42710.
CREATE TABLE IF NOT EXISTS "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "password_resets_userId_idx" ON "password_resets"("userId");
CREATE INDEX IF NOT EXISTS "password_resets_token_idx" ON "password_resets"("token");

DO $$
DECLARE
  user_table text;
BEGIN
  SELECT table_name INTO user_table FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('User', 'users') LIMIT 1;

  IF user_table IS NULL THEN
    RAISE NOTICE 'user table absent — foreign key skipped';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'password_resets_userId_fkey'
  ) THEN
    EXECUTE format(
      'ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.%I("id") ON DELETE CASCADE ON UPDATE CASCADE',
      user_table
    );
  END IF;
END $$;
