-- Compatibility marker: TreatmentCase columns/FKs and the inheritance
-- trigger are owned by 20260917_add_treatment_case_links. Keeping this
-- migration as a no-op avoids a second competing trigger definition.
SELECT 1;
