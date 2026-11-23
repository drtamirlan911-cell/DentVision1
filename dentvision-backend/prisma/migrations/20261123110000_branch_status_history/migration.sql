-- Establish a non-retroactive baseline for partner branch billing.
CREATE TABLE IF NOT EXISTS "branch_status_history_baselines" (
  "organization_id" TEXT NOT NULL,
  "initialized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branch_status_history_baselines_pkey" PRIMARY KEY ("organization_id")
);
DO $$ BEGIN
  ALTER TABLE "branch_status_history_baselines"
    ADD CONSTRAINT "branch_status_history_baselines_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "branch_status_events" (
  "id" BIGSERIAL NOT NULL,
  "branch_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branch_status_events_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "branch_status_events"
    ADD CONSTRAINT "branch_status_events_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "branch_status_events"
    ADD CONSTRAINT "branch_status_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "branch_status_events_baseline_unique_idx"
  ON "branch_status_events"("branch_id") WHERE "source" = 'baseline';

CREATE INDEX IF NOT EXISTS "branch_status_events_branch_effective_idx"
  ON "branch_status_events"("branch_id", "effective_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "branch_status_events_organization_effective_idx"
  ON "branch_status_events"("organization_id", "effective_at" DESC);

INSERT INTO "branch_status_history_baselines" ("organization_id", "initialized_at")
SELECT o."id", CURRENT_TIMESTAMP
FROM "organizations" o
WHERE o."type" IN ('DIAGNOSTIC_CENTER', 'LABORATORY')
ON CONFLICT ("organization_id") DO NOTHING;

INSERT INTO "branch_status_events"
  ("branch_id", "organization_id", "active", "effective_at", "source", "actor_user_id")
SELECT b."id", b."organization_id", b."active", h."initialized_at", 'baseline', NULL
FROM "branches" b
JOIN "branch_status_history_baselines" h ON h."organization_id" = b."organization_id"
WHERE b."organization_id" IS NOT NULL
ON CONFLICT DO NOTHING;
