-- The Doctor Approval Layer: a treatment plan frozen at the moment a named
-- doctor signed it off.
--
-- Keep deployment safe on legacy installations where treatment_plans/patients
-- have not been created by the older migration chain yet. The release table
-- remains available; patient/plan/user FKs are attached only when targets exist.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanReleaseStatus') THEN
    CREATE TYPE "PlanReleaseStatus" AS ENUM ('approved', 'superseded', 'withdrawn');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "treatment_plan_releases" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "PlanReleaseStatus" NOT NULL DEFAULT 'approved',
  "snapshot" JSONB NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "approvedByUserId" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvalNote" TEXT,
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "withdrawnByUserId" TEXT,
  "withdrawReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "treatment_plan_releases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "treatment_plan_releases_planId_version_key"
  ON "treatment_plan_releases"("planId", "version");
CREATE INDEX IF NOT EXISTS "treatment_plan_releases_clinicId_status_approvedAt_idx"
  ON "treatment_plan_releases"("clinicId", "status", "approvedAt");
CREATE INDEX IF NOT EXISTS "treatment_plan_releases_patientId_status_idx"
  ON "treatment_plan_releases"("patientId", "status");

DO $$
BEGIN
  IF to_regclass('public.treatment_plans') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plan_releases_planId_fkey') THEN
      ALTER TABLE "treatment_plan_releases"
        ADD CONSTRAINT "treatment_plan_releases_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.clinics') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plan_releases_clinicId_fkey') THEN
      ALTER TABLE "treatment_plan_releases"
        ADD CONSTRAINT "treatment_plan_releases_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.patients') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plan_releases_patientId_fkey') THEN
      ALTER TABLE "treatment_plan_releases"
        ADD CONSTRAINT "treatment_plan_releases_patientId_fkey"
        FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plan_releases_approvedByUserId_fkey') THEN
      ALTER TABLE "treatment_plan_releases"
        ADD CONSTRAINT "treatment_plan_releases_approvedByUserId_fkey"
        FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
