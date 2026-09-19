CREATE TABLE IF NOT EXISTS "branch_members" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branch_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branch_members_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "branch_members_personId_branchId_key" ON "branch_members" ("personId", "branchId");
CREATE INDEX IF NOT EXISTS "branch_members_branchId_idx" ON "branch_members" ("branchId");
CREATE INDEX IF NOT EXISTS "branch_members_personId_idx" ON "branch_members" ("personId");
