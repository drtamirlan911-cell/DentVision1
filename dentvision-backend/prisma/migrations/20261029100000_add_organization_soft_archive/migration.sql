-- Soft-archive canonical organization contexts without deleting the
-- linked clinic, branches, memberships, clinical records, or audit history.
ALTER TABLE "organizations"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "organizations_archivedAt_idx"
  ON "organizations"("archivedAt");
