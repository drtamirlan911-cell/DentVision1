-- Complete the notification_preferences -> users foreign key after the
-- legacy init_full_schema migration has created users.
DO $$
BEGIN
  IF to_regclass('public.notification_preferences') IS NOT NULL
     AND to_regclass('public.users') IS NOT NULL
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
