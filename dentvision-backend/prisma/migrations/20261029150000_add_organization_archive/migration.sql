-- Soft-archive state for canonical Organization contexts. This intentionally
-- does not change the source entity (e.g. Clinic.active) or delete related data.
ALTER TABLE "organizations" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "organizations_archivedAt_idx" ON "organizations"("archivedAt");
