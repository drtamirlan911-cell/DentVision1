-- Database-level integrity for clinic finance records.
-- Authorization remains application-level; these constraints stop direct or
-- legacy writes from attaching a clinic financial record to another branch.

CREATE OR REPLACE FUNCTION enforce_finance_branch_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  branch_clinic_id TEXT;
BEGIN
  IF NEW.branch_id IS NULL THEN
    SELECT b.id
      INTO NEW.branch_id
    FROM branches b
    WHERE b.clinic_id = NEW.clinic_id
      AND b.active = true
      AND b.is_default = true
    ORDER BY b.created_at ASC
    LIMIT 1;
  END IF;

  IF NEW.branch_id IS NOT NULL THEN
    SELECT b.clinic_id
      INTO branch_clinic_id
    FROM branches b
    WHERE b.id = NEW.branch_id
      AND b.active = true;

    IF branch_clinic_id IS NULL OR branch_clinic_id <> NEW.clinic_id THEN
      RAISE EXCEPTION 'finance record branch does not belong to clinic';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_branch_consistency ON invoices;
CREATE TRIGGER invoices_branch_consistency
BEFORE INSERT OR UPDATE OF clinic_id, branch_id
ON invoices
FOR EACH ROW
EXECUTE FUNCTION enforce_finance_branch_consistency();

DROP TRIGGER IF EXISTS expenses_branch_consistency ON expenses;
CREATE TRIGGER expenses_branch_consistency
BEFORE INSERT OR UPDATE OF clinic_id, branch_id
ON expenses
FOR EACH ROW
EXECUTE FUNCTION enforce_finance_branch_consistency();
