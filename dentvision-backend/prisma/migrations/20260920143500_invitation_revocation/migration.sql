ALTER TABLE "organization_invitations"
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "revokedBy" TEXT;

CREATE INDEX "organization_invitations_organizationId_revokedAt_idx"
ON "organization_invitations"("organizationId", "revokedAt");
