-- Existing clinic-scoped data must not become invisible to branch-scoped
-- staff after the IAM rollout. Assign legacy records to the clinic's default
-- branch (or earliest active branch) deterministically. New writes are then
-- required to carry an explicit branch context by the route layer.

WITH chosen_branch AS (
  SELECT DISTINCT ON (clinic_id)
    clinic_id,
    id AS branch_id
  FROM branches
  WHERE clinic_id IS NOT NULL
    AND active = true
  ORDER BY clinic_id, "isDefault" DESC, "createdAt" ASC, id ASC
)
UPDATE patients p
SET branch_id = chosen_branch.branch_id,
    "updatedAt" = CURRENT_TIMESTAMP
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
  ORDER BY clinic_id, "isDefault" DESC, "createdAt" ASC, id ASC
)
UPDATE appointments a
SET branch_id = chosen_branch.branch_id,
    "updatedAt" = CURRENT_TIMESTAMP
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
  ORDER BY clinic_id, "isDefault" DESC, "createdAt" ASC, id ASC
)
UPDATE clinic_members cm
SET branch_id = chosen_branch.branch_id
FROM chosen_branch
WHERE cm."clinicId" = chosen_branch.clinic_id
  AND cm.branch_id IS NULL;