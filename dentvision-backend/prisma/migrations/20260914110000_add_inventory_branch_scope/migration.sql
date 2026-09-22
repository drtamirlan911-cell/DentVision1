-- Inventory becomes branch-aware while retaining clinicId for tenant compatibility.
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

CREATE INDEX IF NOT EXISTS "inventory_branch_id_idx"
  ON "inventory"("branch_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND constraint_name='inventory_branch_id_fkey'
  ) THEN
    ALTER TABLE "inventory"
      ADD CONSTRAINT "inventory_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Legacy inventory belongs to the clinic's deterministic default branch.
WITH chosen_branch AS (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    id AS branch_id
  FROM branches
  WHERE clinic_id IS NOT NULL AND active = true
  ORDER BY clinic_id, is_default DESC, created_at ASC, id ASC
)
UPDATE inventory i
SET branch_id = chosen_branch.branch_id,
    updated_at = CURRENT_TIMESTAMP
FROM chosen_branch
WHERE i.clinic_id = chosen_branch.clinic_id
  AND i.branch_id IS NULL;
