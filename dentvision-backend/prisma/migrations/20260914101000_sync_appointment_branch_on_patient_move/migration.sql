-- Keep existing appointments aligned when an authorized patient branch move occurs.
-- Patient branch assignment is the source of truth for appointment branch scope.

CREATE OR REPLACE FUNCTION sync_patient_appointment_branches()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    UPDATE appointments
    SET branch_id = NEW.branch_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE patient_id = NEW.id
      AND clinic_id = NEW.clinic_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patients_sync_appointment_branches ON patients;

CREATE TRIGGER patients_sync_appointment_branches
AFTER UPDATE OF branch_id
ON patients
FOR EACH ROW
EXECUTE FUNCTION sync_patient_appointment_branches();
