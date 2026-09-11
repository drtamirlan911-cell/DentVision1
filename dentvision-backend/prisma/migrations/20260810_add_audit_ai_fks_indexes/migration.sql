-- D-3/D-4: harden optional audit/AI integrity additions.
-- Some deployments intentionally do not have the legacy audit_logs / ai_events
-- tables yet. This migration must remain deployable on a clean database.
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'audit_logs'
        AND constraint_name = 'audit_logs_userId_fkey'
    ) THEN
      ALTER TABLE "audit_logs"
        ADD CONSTRAINT "audit_logs_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL NOT VALID;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'audit_logs'
        AND constraint_name = 'audit_logs_clinicId_fkey'
    ) THEN
      ALTER TABLE "audit_logs"
        ADD CONSTRAINT "audit_logs_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL NOT VALID;
    END IF;
    CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
    CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
    CREATE INDEX IF NOT EXISTS "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");
  END IF;

  IF to_regclass('public.ai_events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'ai_events'
        AND constraint_name = 'ai_events_userId_fkey'
    ) THEN
      ALTER TABLE "ai_events"
        ADD CONSTRAINT "ai_events_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE NOT VALID;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'ai_events'
        AND constraint_name = 'ai_events_clinicId_fkey'
    ) THEN
      ALTER TABLE "ai_events"
        ADD CONSTRAINT "ai_events_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE NOT VALID;
    END IF;
    CREATE INDEX IF NOT EXISTS "ai_events_userId_idx" ON "ai_events"("userId");
  END IF;
END $$;
