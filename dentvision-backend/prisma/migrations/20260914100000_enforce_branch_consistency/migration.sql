-- Enforce branch integrity at the database boundary so legacy or direct API
-- appointment writes cannot silently cross branch boundaries.
--
-- The application route remains responsible for authorization. This trigger is
-- the last line of defence: an appointment always inherits its patient's
-- branch when the caller omits branch_id, and an explicit branch_id must match
-- both the patient and clinic.

CREATE OR REPLACE FUNCTION enforce_appointment_branch_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  patient_branch_id TEXT;
  patient_clinic_id TEXT;
  branch_clinic_id TEXT;
BEGIN
  SELECT p.branch_id, p."clinicId"
    INTO patient_branch_id, patient_clinic_id
  FROM patients p
  WHERE p.id = NEW."patientId";

  IF patient_clinic_id IS NULL OR patient_clinic_id <> NEW."clinicId" THEN
    RAISE EXCEPTION 'appointment patient belongs to another clinic';
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := patient_branch_id;
  ELSIF patient_branch_id IS NOT NULL AND NEW.branch_id <> patient_branch_id THEN
    RAISE EXCEPTION 'appointment branch does not match patient branch';
  END IF;

  IF NEW.branch_id IS NOT NULL THEN
    SELECT b.clinic_id
      INTO branch_clinic_id
    FROM branches b
    WHERE b.id = NEW.branch_id
      AND b.active = true;

    IF branch_clinic_id IS NULL OR branch_clinic_id <> NEW."clinicId" THEN
      RAISE EXCEPTION 'appointment branch does not belong to clinic';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_branch_consistency ON appointments;

CREATE TRIGGER appointments_branch_consistency
BEFORE INSERT OR UPDATE OF "patientId", "clinicId", branch_id
ON appointments
FOR EACH ROW
EXECUTE FUNCTION enforce_appointment_branch_consistency();
