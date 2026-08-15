-- D-3: foreign keys on audit_logs / ai_events that the original schema lacked.
-- FKs are added NOT VALID so legacy rows referencing already-deleted users or
-- clinics do not block deployment; new rows are always enforced.
DO $$
BEGIN
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
END $$;

-- D-4: missing indexes for audit_logs / ai_events.
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_events_userId_idx" ON "ai_events"("userId");
