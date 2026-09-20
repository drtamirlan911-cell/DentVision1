-- Universal branch memberships must not outlive or point at a missing branch.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'branch_members_branchId_fkey'
  ) THEN
    ALTER TABLE "branch_members"
      ADD CONSTRAINT "branch_members_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "branch_members_personId_idx" ON "branch_members"("personId");
