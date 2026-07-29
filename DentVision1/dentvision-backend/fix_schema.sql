-- Add missing updatedAt columns
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
ALTER TABLE "clinic_members" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Add missing status column to clinic_members (optional, used by auth middleware)
ALTER TABLE "clinic_members" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'active';

-- Create _prisma_migrations table if not exists
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- Mark initial migration as applied
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES ('init', 'baseline', now(), '0_init', 'baseline existing database', NULL, now(), 1)
ON CONFLICT ("id") DO NOTHING;