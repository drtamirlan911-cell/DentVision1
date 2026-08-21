-- Agentic OS governance kernel: activity ledger + evidence.
--
-- `agent_activities` is written by every call into `ai/os/kernel.ts::runAiAction`
-- — allowed, denied, or executed — so the four non-negotiables (audit,
-- evidence, visibility, human-in-the-loop) have somewhere to write to.
-- `actorUserId` carries no FK to `users`: the ai-admin surface acts under a
-- synthetic id with no row in that table.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

CREATE TABLE IF NOT EXISTS "agent_activities" (
  "id" TEXT NOT NULL,
  "traceId" TEXT,
  "surface" TEXT NOT NULL,
  "agentId" TEXT,
  "tool" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "clinicId" TEXT,
  "organizationId" TEXT,
  "patientId" TEXT,
  "teamKey" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'clinic',
  "sensitivity" TEXT NOT NULL DEFAULT 'standard',
  "status" TEXT NOT NULL,
  "denyReason" TEXT,
  "argsRedacted" JSONB,
  "resultSummary" TEXT,
  "durationMs" INTEGER,
  "approvalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "agent_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_activities_clinicId_createdAt_idx" ON "agent_activities"("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_activities_actorUserId_createdAt_idx" ON "agent_activities"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_activities_teamKey_createdAt_idx" ON "agent_activities"("teamKey", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_activities_organizationId_createdAt_idx" ON "agent_activities"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_activities_patientId_idx" ON "agent_activities"("patientId");

CREATE TABLE IF NOT EXISTS "action_evidence" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "access" TEXT,
  "clinicId" TEXT,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "action_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "action_evidence_activityId_idx" ON "action_evidence"("activityId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'action_evidence_activityId_fkey') THEN
    ALTER TABLE "action_evidence" ADD CONSTRAINT "action_evidence_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "agent_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
