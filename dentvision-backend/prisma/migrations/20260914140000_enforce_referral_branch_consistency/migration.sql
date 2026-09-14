-- Database boundary for clinic-originated diagnostics referrals.
-- Route authorization remains responsible for who may act; this trigger prevents
-- direct/legacy writes from attaching a referral to the wrong clinic branch.

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

-- Keep clinic-originated referrals aligned when a patient's branch changes.
CREATE OR REPLACE FUNCTION sync_referral_branch_on_patient_move()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    UPDATE referrals
    SET branch_id = NEW.branch_id
    WHERE patient_id = NEW.id
      AND clinic_id = NEW.clinic_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patients_sync_referral_branch ON patients;

CREATE TRIGGER patients_sync_referral_branch
AFTER UPDATE OF branch_id
ON patients
FOR EACH ROW
EXECUTE FUNCTION sync_referral_branch_on_patient_move();
