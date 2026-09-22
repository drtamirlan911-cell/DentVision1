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
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "patientId" = NEW."id"
      AND "clinicId" = NEW."clinicId";
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
