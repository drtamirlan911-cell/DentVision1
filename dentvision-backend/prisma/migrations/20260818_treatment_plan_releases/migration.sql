-- The Doctor Approval Layer: a treatment plan frozen at the moment a named
-- doctor signed it off.
--
-- `treatment_plans.items` is a mutable JSON blob with several writers, so it
-- cannot answer "what was this patient told, by whom, on what date". A release
-- can. Nothing patient-facing reads `treatment_plans` any more — only a release
-- that is 'approved' and carries a publishedAt.
--
-- Idempotent throughout: this file is also mirrored as a runOnceMigration block
-- in src/index.ts, because `prisma migrate deploy` has not reliably reached
-- production in this project.

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanReleaseStatus') THEN
    CREATE TYPE "PlanReleaseStatus" AS ENUM ('approved', 'superseded', 'withdrawn');
  END IF;
END $$;

-- CreateTable
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

-- One row per (plan, version). This is what makes `version = max + 1` safe
-- under concurrency: the loser of a race hits this constraint instead of
-- silently writing a second release with the same version.
CREATE UNIQUE INDEX IF NOT EXISTS "treatment_plan_releases_planId_version_key"
  ON "treatment_plan_releases"("planId", "version");
CREATE INDEX IF NOT EXISTS "treatment_plan_releases_clinicId_status_approvedAt_idx"
  ON "treatment_plan_releases"("clinicId", "status", "approvedAt");
CREATE INDEX IF NOT EXISTS "treatment_plan_releases_patientId_status_idx"
  ON "treatment_plan_releases"("patientId", "status");

-- Foreign keys, each guarded so a re-run does not fail on an existing constraint.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plan_releases_planId_fkey') THEN
    ALTER TABLE "treatment_plan_releases"
      ADD CONSTRAINT "treatment_plan_releases_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plan_releases_clinicId_fkey') THEN
    ALTER TABLE "treatment_plan_releases"
      ADD CONSTRAINT "treatment_plan_releases_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plan_releases_patientId_fkey') THEN
    ALTER TABLE "treatment_plan_releases"
      ADD CONSTRAINT "treatment_plan_releases_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_plan_releases_approvedByUserId_fkey') THEN
    ALTER TABLE "treatment_plan_releases"
      ADD CONSTRAINT "treatment_plan_releases_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
