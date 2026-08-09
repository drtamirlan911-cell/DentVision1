-- Invite codes for non-clinic organizations (diagnostic centres, laboratories).
--
-- Idempotent throughout: `prisma migrate deploy` stops at the first failing
-- migration and blocks every migration behind it, which has already cost this
-- repository a deploy chain.
CREATE TABLE IF NOT EXISTS "organization_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "usedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_invitations_code_key" ON "organization_invitations"("code");
CREATE INDEX IF NOT EXISTS "organization_invitations_organizationId_idx" ON "organization_invitations"("organizationId");

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so the foreign key is guarded
-- on constraint existence; re-running would otherwise fail with 42710.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND constraint_name = 'organization_invitations_organizationId_fkey'
  ) THEN
    ALTER TABLE "organization_invitations"
      ADD CONSTRAINT "organization_invitations_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
