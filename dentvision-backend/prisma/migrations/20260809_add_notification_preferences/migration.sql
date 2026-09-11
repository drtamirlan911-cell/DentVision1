-- Add NotificationPreference model.
--
-- This migration can run before the legacy `init_full_schema` migration, so the
-- users table may not exist yet. The table/indexes are safe to create early;
-- the foreign key is deferred to a post-init compatibility migration when the
-- users table is guaranteed to exist.
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_type_key" ON "notification_preferences"("userId", "type");
CREATE INDEX IF NOT EXISTS "notification_preferences_userId_idx" ON "notification_preferences"("userId");

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS. If users already exists, add
-- the FK now; otherwise the post-init migration will add it later.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND constraint_name = 'notification_preferences_userId_fkey'
     ) THEN
    ALTER TABLE "notification_preferences"
      ADD CONSTRAINT "notification_preferences_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
