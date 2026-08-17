-- Patient-consented, cross-clinic access to medical history.
--
-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CrossClinicAccessStatus') THEN
    CREATE TYPE "CrossClinicAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'REVOKED', 'EXPIRED');
  END IF;
END $$;

-- AlterTable: patients.iinHash (deterministic blind index — iin itself is
-- encrypted with a random IV, so it can never be looked up by equality).
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "iinHash" VARCHAR(64);
CREATE INDEX IF NOT EXISTS "patients_iinHash_idx" ON "patients"("iinHash");

-- CreateTable
CREATE TABLE IF NOT EXISTS "cross_clinic_access_grants" (
  "id" TEXT NOT NULL,
  "patientUserId" TEXT NOT NULL,
  "sourceClinicId" TEXT NOT NULL,
  "sourcePatientId" TEXT NOT NULL,
  "receivingClinicId" TEXT NOT NULL,
  "receivingPatientId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" "CrossClinicAccessStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "cross_clinic_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cross_clinic_access_grants_patientUserId_sourceClinicId_re_key"
  ON "cross_clinic_access_grants"("patientUserId", "sourceClinicId", "receivingClinicId");
CREATE INDEX IF NOT EXISTS "cross_clinic_access_grants_patientUserId_status_idx"
  ON "cross_clinic_access_grants"("patientUserId", "status");
CREATE INDEX IF NOT EXISTS "cross_clinic_access_grants_receivingClinicId_status_idx"
  ON "cross_clinic_access_grants"("receivingClinicId", "status");
CREATE INDEX IF NOT EXISTS "cross_clinic_access_grants_receivingPatientId_idx"
  ON "cross_clinic_access_grants"("receivingPatientId");
CREATE INDEX IF NOT EXISTS "cross_clinic_access_grants_sourceClinicId_idx"
  ON "cross_clinic_access_grants"("sourceClinicId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cross_clinic_access_grants_patientUserId_fkey') THEN
    ALTER TABLE "cross_clinic_access_grants" ADD CONSTRAINT "cross_clinic_access_grants_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cross_clinic_access_grants_sourceClinicId_fkey') THEN
    ALTER TABLE "cross_clinic_access_grants" ADD CONSTRAINT "cross_clinic_access_grants_sourceClinicId_fkey" FOREIGN KEY ("sourceClinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cross_clinic_access_grants_sourcePatientId_fkey') THEN
    ALTER TABLE "cross_clinic_access_grants" ADD CONSTRAINT "cross_clinic_access_grants_sourcePatientId_fkey" FOREIGN KEY ("sourcePatientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cross_clinic_access_grants_receivingClinicId_fkey') THEN
    ALTER TABLE "cross_clinic_access_grants" ADD CONSTRAINT "cross_clinic_access_grants_receivingClinicId_fkey" FOREIGN KEY ("receivingClinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cross_clinic_access_grants_receivingPatientId_fkey') THEN
    ALTER TABLE "cross_clinic_access_grants" ADD CONSTRAINT "cross_clinic_access_grants_receivingPatientId_fkey" FOREIGN KEY ("receivingPatientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cross_clinic_access_grants_requestedByUserId_fkey') THEN
    ALTER TABLE "cross_clinic_access_grants" ADD CONSTRAINT "cross_clinic_access_grants_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "cross_clinic_access_logs" (
  "id" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "accessedByUserId" TEXT NOT NULL,
  "dataCategory" TEXT NOT NULL,
  "recordCount" INTEGER,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cross_clinic_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cross_clinic_access_logs_grantId_createdAt_idx"
  ON "cross_clinic_access_logs"("grantId", "createdAt");
CREATE INDEX IF NOT EXISTS "cross_clinic_access_logs_accessedByUserId_idx"
  ON "cross_clinic_access_logs"("accessedByUserId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cross_clinic_access_logs_grantId_fkey') THEN
    ALTER TABLE "cross_clinic_access_logs" ADD CONSTRAINT "cross_clinic_access_logs_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "cross_clinic_access_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cross_clinic_access_logs_accessedByUserId_fkey') THEN
    ALTER TABLE "cross_clinic_access_logs" ADD CONSTRAINT "cross_clinic_access_logs_accessedByUserId_fkey" FOREIGN KEY ("accessedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
