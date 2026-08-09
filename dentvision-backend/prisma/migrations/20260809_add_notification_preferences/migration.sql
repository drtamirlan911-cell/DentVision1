-- Add NotificationPreference model.
--
-- Written idempotently on purpose. `prisma migrate deploy` stops at the first
-- failing migration and every later one is blocked until the chain is unwedged
-- by hand — this repository has already lost a deploy chain that way (see the
-- 20260731_* migrations). A plain CREATE TABLE fails with 42P07 the moment the
-- table exists for any reason, so the whole file is guarded.
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_type_key" ON "notification_preferences"("userId", "type");
CREATE INDEX IF NOT EXISTS "notification_preferences_userId_idx" ON "notification_preferences"("userId");

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so the foreign key is guarded
-- on constraint existence; re-running would otherwise fail with 42710.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND constraint_name = 'notification_preferences_userId_fkey'
  ) THEN
    ALTER TABLE "notification_preferences"
      ADD CONSTRAINT "notification_preferences_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
