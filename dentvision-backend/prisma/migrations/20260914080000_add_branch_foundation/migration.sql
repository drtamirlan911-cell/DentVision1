-- DentVision branch foundation.
-- This migration intentionally introduces the branch boundary without
-- backfilling branch_id across every operational table. That propagation is
-- staged to avoid a high-risk all-domain migration.

CREATE TABLE IF NOT EXISTS "Branch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Branch_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Branch_organizationId_code_key"
  ON "Branch"("organizationId", "code");

CREATE INDEX IF NOT EXISTS "Branch_organizationId_active_idx"
  ON "Branch"("organizationId", "active");

-- Separate assignment table allows one person to work in multiple branches
-- without changing the existing ClinicMember uniqueness contract.
CREATE TABLE IF NOT EXISTS "BranchMember" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BranchMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BranchMember_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BranchMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BranchMember_branchId_userId_key"
  ON "BranchMember"("branchId", "userId");

CREATE INDEX IF NOT EXISTS "BranchMember_userId_active_idx"
  ON "BranchMember"("userId", "active");

CREATE INDEX IF NOT EXISTS "BranchMember_branchId_active_idx"
  ON "BranchMember"("branchId", "active");
