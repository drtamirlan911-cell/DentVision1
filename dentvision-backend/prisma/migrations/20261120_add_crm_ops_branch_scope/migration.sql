-- Persist a stable branch boundary for patient waiting-list rows and online bookings.
-- Legacy rows are backfilled only when the source patient/appointment/staff mapping
-- identifies exactly one branch. Ambiguous and unassigned rows remain NULL and
-- are visible only in an unselected organization-wide workspace.

ALTER TABLE "waiting_list"
  ADD COLUMN IF NOT EXISTS branch_id TEXT;

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS branch_id TEXT;

CREATE INDEX IF NOT EXISTS "waiting_list_clinic_branch_created_idx"
  ON "waiting_list" ("clinicId", branch_id, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "bookings_clinic_branch_date_idx"
  ON "bookings" ("clinicId", branch_id, date);

-- Waiting-list rows linked to a patient inherit that patient's persisted branch.
UPDATE "waiting_list" wl
SET branch_id = p.branch_id
FROM patients p
WHERE wl."patientId" = p.id
  AND wl."clinicId" = p."clinicId"
  AND wl.branch_id IS NULL
  AND p.branch_id IS NOT NULL;

-- Confirmed bookings with a linked appointment inherit the branch used by the
-- appointment-created event payload (meta.bookingId).
UPDATE "bookings" b
SET branch_id = a.branch_id
FROM appointments a
WHERE a."clinicId" = b."clinicId"
  AND a."meta"->>'bookingId' = b.id
  AND a.branch_id IS NOT NULL
  AND b.branch_id IS NULL;

-- Legacy clinics: backfill only when the clinician has one distinct active
-- ClinicMember branch. Multiple branch rows are deliberately left unresolved.
WITH unique_legacy_doctor_branch AS (
  SELECT cm."clinicId", cm."userId", MIN(cm.branch_id) AS branch_id
  FROM clinic_members cm
  JOIN branches br
    ON br.id = cm.branch_id
   AND br.clinic_id = cm."clinicId"
   AND br.active = true
  WHERE cm.branch_id IS NOT NULL
    AND UPPER(cm.role::text) = 'DOCTOR'
  GROUP BY cm."clinicId", cm."userId"
  HAVING COUNT(DISTINCT cm.branch_id) = 1
)
UPDATE "bookings" b
SET branch_id = d.branch_id
FROM unique_legacy_doctor_branch d
WHERE b."clinicId" = d."clinicId"
  AND b."doctorId" = d."userId"
  AND b.branch_id IS NULL;

-- Canonical clinic IAM: backfill only doctors with exactly one active
-- BranchMember in that clinic Organization. No branch is inferred for a doctor
-- who is active in multiple branches.
WITH unique_canonical_doctor_branch AS (
  SELECT
    o."originalId" AS clinic_id,
    p."userId" AS doctor_id,
    MIN(bm."branchId") AS branch_id
  FROM organizations o
  JOIN persons p
    ON p.organization_id = o.id
   AND p."userId" IS NOT NULL
  JOIN person_roles pr
    ON pr."personId" = p.id
   AND pr."scopeType" = 'organization'
   AND pr."scopeId" = o.id
  JOIN roles r
    ON r.id = pr."roleId"
   AND LOWER(r.key) = 'doctor'
  JOIN branch_members bm
    ON bm."personId" = p.id
   AND bm.active = true
  JOIN branches br
    ON br.id = bm."branchId"
   AND br.organization_id = o.id
   AND br.active = true
  WHERE o.type = 'CLINIC'
    AND o."originalType" = 'Clinic'
    AND o."originalId" IS NOT NULL
    AND o."archivedAt" IS NULL
  GROUP BY o."originalId", p."userId"
  HAVING COUNT(DISTINCT bm."branchId") = 1
)
UPDATE "bookings" b
SET branch_id = d.branch_id
FROM unique_canonical_doctor_branch d
WHERE b."clinicId" = d.clinic_id
  AND b."doctorId" = d.doctor_id
  AND b.branch_id IS NULL;
