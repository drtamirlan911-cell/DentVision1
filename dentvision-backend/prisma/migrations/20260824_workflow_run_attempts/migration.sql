-- Retry counter for failed Workflow Studio runs.
--
-- `src/jobs/workflowRetry.ts` polls `workflow_runs` with status='failed' and
-- attempts<3, same durable-polling pattern as `aiApprovalSweeper.ts`.
--
-- The V2 workflow tables may be bootstrapped separately in some deployment
-- topologies. Keep this migration deploy-safe when workflow_runs is absent.
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

DO $$
BEGIN
  IF to_regclass('public.workflow_runs') IS NOT NULL THEN
    ALTER TABLE "workflow_runs"
      ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS "workflow_runs_status_attempts_idx"
      ON "workflow_runs"("status", "attempts");
  END IF;
END $$;
