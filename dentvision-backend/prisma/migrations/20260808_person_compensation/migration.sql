-- Payroll configuration in the unified model.
--
-- commissionPercent / baseSalary / payType lived only on clinic_members, so
-- staff represented purely as a Person had no payroll configuration: my-payroll
-- answered 404 for them and the clinic payroll run left them out entirely.
--
-- Anchored on persons: since the multi-org migration there is exactly one
-- Person per (user, organization), which is what a membership is.
CREATE TABLE IF NOT EXISTS "person_compensation" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "commissionPercent" INTEGER NOT NULL DEFAULT 30,
    "baseSalary" INTEGER NOT NULL DEFAULT 0,
    "payType" TEXT NOT NULL DEFAULT 'commission',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_compensation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "person_compensation_personId_key"
  ON "person_compensation"("personId");

DO $$
BEGIN
  IF to_regclass('public.persons') IS NULL THEN
    RAISE NOTICE 'persons table absent — foreign key skipped';
    RETURN;
  END IF;

  -- Postgres has no ADD CONSTRAINT IF NOT EXISTS.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'person_compensation_personId_fkey'
  ) THEN
    ALTER TABLE "person_compensation"
      ADD CONSTRAINT "person_compensation_personId_fkey"
      FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
