ALTER TABLE "branch_members"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "branch_members_branchId_active_idx" ON "branch_members"("branchId", "active");
