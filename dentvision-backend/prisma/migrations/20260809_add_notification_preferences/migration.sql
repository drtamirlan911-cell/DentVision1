-- Add NotificationPreference model.
--
-- Keep this migration deploy-safe for databases that do not yet contain the
-- legacy `users` table. The notification table can be created independently;
-- the FK is added only when its referenced table exists.
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_type_key" ON "notification_preferences"("userId", "type");
CREATE INDEX IF NOT EXISTS "notification_preferences_userId_idx" ON "notification_preferences"("userId");

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so guard both the constraint
-- and the referenced table. If `users` is introduced by a later migration,
-- that migration remains responsible for establishing its own relationship.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND constraint_name = 'notification_preferences_userId_fkey'
  ) THEN
    ALTER TABLE "notification_preferences"
      ADD CONSTRAINT "notification_preferences_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
