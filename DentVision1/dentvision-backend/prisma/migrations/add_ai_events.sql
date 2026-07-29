DO $$ BEGIN
  CREATE TYPE "AIEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ai_events" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "AIEventStatus" NOT NULL DEFAULT 'PENDING',
  "retries" INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "processedAt" TIMESTAMPTZ,
  CONSTRAINT "ai_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_events_clinicId_idx" ON "ai_events"("clinicId");
CREATE INDEX IF NOT EXISTS "ai_events_status_idx" ON "ai_events"("status");
CREATE INDEX IF NOT EXISTS "ai_events_type_idx" ON "ai_events"("type");
CREATE INDEX IF NOT EXISTS "ai_events_createdAt_idx" ON "ai_events"("createdAt");
