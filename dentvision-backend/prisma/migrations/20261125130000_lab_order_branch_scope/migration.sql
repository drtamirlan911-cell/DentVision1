-- Persist the clinic branch on every dental-lab order, including orders
-- created from a name-only patient entry. Patient.branch_id remains a useful
-- legacy fallback, but it is not a complete ownership key for LabOrder.
ALTER TABLE "lab_orders"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

CREATE INDEX IF NOT EXISTS "lab_orders_branch_id_idx"
  ON "lab_orders"("branch_id");

CREATE INDEX IF NOT EXISTS "lab_orders_clinic_branch_created_idx"
  ON "lab_orders"("clinicId", "branch_id", "createdAt" DESC);

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lab_orders_branch_id_fkey'
      AND conrelid = 'lab_orders'::regclass
  ) THEN
    ALTER TABLE "lab_orders"
      ADD CONSTRAINT "lab_orders_branch_id_fkey"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$;

-- Backfill only where the existing patient record proves the order's branch.
-- Patientless orders are intentionally left NULL: their historical branch
-- cannot be reconstructed safely from the old schema.
UPDATE "lab_orders" lo
SET "branch_id" = p.branch_id
FROM "patients" p
WHERE lo."patientId" = p.id
  AND lo."clinicId" = p."clinicId"
  AND lo."branch_id" IS NULL
  AND p.branch_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_lab_order_branch_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  patient_clinic_id TEXT;
  patient_branch_id TEXT;
  branch_clinic_id TEXT;
  branch_organization_id TEXT;
  branch_is_active BOOLEAN;
BEGIN
  IF NEW."patientId" IS NOT NULL THEN
    SELECT p."clinicId", p.branch_id
      INTO patient_clinic_id, patient_branch_id
    FROM "patients" p
    WHERE p.id = NEW."patientId";

    IF patient_clinic_id IS NULL OR patient_clinic_id IS DISTINCT FROM NEW."clinicId" THEN
      RAISE EXCEPTION 'lab order patient belongs to another clinic';
    END IF;

    IF NEW."branch_id" IS NULL THEN
      NEW."branch_id" := patient_branch_id;
    ELSIF patient_branch_id IS NOT NULL AND NEW."branch_id" IS DISTINCT FROM patient_branch_id THEN
      RAISE EXCEPTION 'lab order branch does not match patient branch';
    END IF;
  END IF;

  IF NEW."branch_id" IS NOT NULL THEN
    SELECT b.clinic_id, b.organization_id, b.active
      INTO branch_clinic_id, branch_organization_id, branch_is_active
    FROM "branches" b
    WHERE b.id = NEW."branch_id";

    IF NOT FOUND OR branch_is_active IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'lab order branch is missing or inactive';
    END IF;

    IF branch_organization_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM "organizations" o
        WHERE o.id = branch_organization_id
          AND o.type = 'CLINIC'
          AND o."originalId" = NEW."clinicId"
          AND o."archivedAt" IS NULL
      ) THEN
        RAISE EXCEPTION 'lab order branch does not belong to clinic organization';
      END IF;
    ELSIF branch_clinic_id IS DISTINCT FROM NEW."clinicId" THEN
      RAISE EXCEPTION 'lab order branch does not belong to clinic';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lab_orders_branch_consistency ON "lab_orders";

CREATE TRIGGER lab_orders_branch_consistency
BEFORE INSERT OR UPDATE OF "patientId", "clinicId", "branch_id"
ON "lab_orders"
FOR EACH ROW
EXECUTE FUNCTION enforce_lab_order_branch_consistency();