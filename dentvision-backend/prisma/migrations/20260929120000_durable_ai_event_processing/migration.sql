ALTER TABLE "ai_events" ADD COLUMN IF NOT EXISTS "processingAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ai_events_status_processingAt_idx" ON "ai_events"("status", "processingAt");
