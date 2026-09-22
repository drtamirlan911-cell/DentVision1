ALTER TABLE "branch_members"
ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "branch_members_branchId_active_idx"
ON "branch_members"("branchId", "active");
