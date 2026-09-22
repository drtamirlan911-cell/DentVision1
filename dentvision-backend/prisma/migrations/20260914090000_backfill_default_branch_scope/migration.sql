-- Existing clinic-scoped data must not become invisible to branch-scoped
-- staff after the IAM rollout. Assign legacy records to the clinic's default
-- branch (or earliest active branch) deterministically. New writes are then
-- required to carry an explicit branch context by the route layer.

-- These columns are canonicalized as branch_id. Keeping the migration
-- self-provisioning makes it safe when an older database was created before
-- the branch-scope columns were introduced by Prisma schema synchronization.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE clinic_members ADD COLUMN IF NOT EXISTS branch_id TEXT;

WITH chosen_branch AS (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    id AS branch_id
  FROM branches
  WHERE clinic_id IS NOT NULL
    AND active = true
  ORDER BY clinic_id, "is_default" DESC, "created_at" ASC, id ASC
)
UPDATE patients p
SET branch_id = chosen_branch.branch_id,
    "updated_at" = CURRENT_TIMESTAMP
FROM chosen_branch
WHERE p."clinicId" = chosen_branch.clinic_id
  AND p.branch_id IS NULL;

WITH chosen_branch AS (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    id AS branch_id
  FROM branches
  WHERE clinic_id IS NOT NULL
    AND active = true
  ORDER BY clinic_id, "is_default" DESC, "created_at" ASC, id ASC
)
UPDATE appointments a
SET branch_id = chosen_branch.branch_id,
    "updated_at" = CURRENT_TIMESTAMP
FROM chosen_branch
WHERE a."clinicId" = chosen_branch.clinic_id
  AND a.branch_id IS NULL;

WITH chosen_branch AS (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    id AS branch_id
  FROM branches
  WHERE clinic_id IS NOT NULL
    AND active = true
  ORDER BY clinic_id, "is_default" DESC, "created_at" ASC, id ASC
)
UPDATE clinic_members cm
SET branch_id = chosen_branch.branch_id
FROM chosen_branch
WHERE cm."clinicId" = chosen_branch.clinic_id
  AND cm.branch_id IS NULL;
