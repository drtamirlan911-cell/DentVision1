-- Retry counter for failed Workflow Studio runs.
--
-- `src/jobs/workflowRetry.ts` polls `workflow_runs` with status='failed' and
-- attempts<3, same durable-polling pattern as `aiApprovalSweeper.ts`.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

ALTER TABLE IF EXISTS "workflow_runs" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "workflow_runs_status_attempts_idx" ON "workflow_runs"("status", "attempts");
