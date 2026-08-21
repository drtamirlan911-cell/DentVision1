-- Human-in-the-loop approval queue for high-risk kernel actions.
--
-- A row here survives a page refresh and can be acted on by any authorized
-- colleague, not only the browser tab that triggered it — unlike the old
-- `needsConfirmation` round-trip, which lived only in client state.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

CREATE TABLE IF NOT EXISTS "ai_approvals" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT,
  "organizationId" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "agentId" TEXT,
  "tool" TEXT NOT NULL,
  "params" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "requiredPermission" TEXT,
  "riskLevel" TEXT NOT NULL DEFAULT 'standard',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "resultActivityId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "ai_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_approvals_clinicId_status_createdAt_idx" ON "ai_approvals"("clinicId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_approvals_status_expiresAt_idx" ON "ai_approvals"("status", "expiresAt");
