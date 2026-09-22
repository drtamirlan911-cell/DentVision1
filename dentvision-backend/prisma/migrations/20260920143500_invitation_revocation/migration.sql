ALTER TABLE "organization_invitations"
ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "revokedBy" TEXT;

CREATE INDEX IF NOT EXISTS "organization_invitations_organizationId_revokedAt_idx"
ON "organization_invitations"("organizationId", "revokedAt");
