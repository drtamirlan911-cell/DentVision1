-- Links a Patient to a platform User account.
--
-- Every statement is guarded and idempotent. The previous version created both
-- "Patient_userId_idx" and "patients_userId_idx" unconditionally, outside the
-- table-name guard — only one of those tables can exist, so the migration
-- failed with 42P01 in every database, and a failed migration blocks every
-- migration after it.
DO $$
DECLARE
  patient_table text;
  user_table    text;
BEGIN
  SELECT table_name INTO patient_table FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('Patient', 'patients') LIMIT 1;

  IF patient_table IS NULL THEN
    RAISE NOTICE 'patient table absent — nothing to do';
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "userId" TEXT', patient_table);
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I ("userId")',
    patient_table || '_userId_idx', patient_table
  );

  SELECT table_name INTO user_table FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('User', 'users') LIMIT 1;

  IF user_table IS NULL THEN
    RETURN;
  END IF;

  -- Postgres has no ADD CONSTRAINT IF NOT EXISTS.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = patient_table || '_userId_fkey'
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY ("userId") REFERENCES public.%I("id") ON DELETE SET NULL ON UPDATE CASCADE',
      patient_table, patient_table || '_userId_fkey', user_table
    );
  END IF;
END $$;
