-- Enforce branch integrity for diagnostic referrals at the database boundary.
-- The application authorization layer remains responsible for access control.
-- This trigger guarantees that a referral cannot silently lose or cross its
-- clinic/patient branch context when a caller omits branch_id.

CREATE OR REPLACE FUNCTION enforce_referral_branch_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  patient_branch_id TEXT;
  patient_clinic_id TEXT;
  branch_clinic_id TEXT;
BEGIN
  IF NEW.patient_id IS NOT NULL THEN
    SELECT p.branch_id, p.clinic_id
      INTO patient_branch_id, patient_clinic_id
    FROM patients p
    WHERE p.id = NEW.patient_id;

    IF patient_clinic_id IS NULL OR patient_clinic_id <> NEW.clinic_id THEN
      RAISE EXCEPTION 'referral patient belongs to another clinic';
    END IF;

    IF NEW.branch_id IS NULL THEN
      NEW.branch_id := patient_branch_id;
    ELSIF patient_branch_id IS NOT NULL AND NEW.branch_id <> patient_branch_id THEN
      RAISE EXCEPTION 'referral branch does not match patient branch';
    END IF;
  END IF;

  IF NEW.branch_id IS NOT NULL THEN
    SELECT b.clinic_id
      INTO branch_clinic_id
    FROM branches b
    WHERE b.id = NEW.branch_id
      AND b.active = true;

    IF branch_clinic_id IS NULL OR branch_clinic_id <> NEW.clinic_id THEN
      RAISE EXCEPTION 'referral branch does not belong to clinic';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referrals_branch_consistency ON referrals;

CREATE TRIGGER referrals_branch_consistency
BEFORE INSERT OR UPDATE OF patient_id, clinic_id, branch_id
ON referrals
FOR EACH ROW
EXECUTE FUNCTION enforce_referral_branch_consistency();
