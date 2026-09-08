-- AI-only patient scope (Stage 6, env.AI_PATIENT_SCOPE — off by default).
--
-- Backfilled idempotently from distinct (clinicId, patientId, doctorId)
-- triples already recorded on Appointment when that table exists. Human REST/UI
-- access to patients is deliberately left unaffected; only the kernel's
-- patient-scope check reads this table.
--
-- The V2 bootstrap may be supplied separately in some environments, so this
-- migration must remain deploy-safe when appointments is not present yet.
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

CREATE TABLE IF NOT EXISTS "patient_assignments" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "clinicId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "patient_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patient_assignments_patientId_userId_role_key" ON "patient_assignments"("patientId", "userId", "role");
CREATE INDEX IF NOT EXISTS "patient_assignments_clinicId_userId_active_idx" ON "patient_assignments"("clinicId", "userId", "active");
CREATE INDEX IF NOT EXISTS "patient_assignments_patientId_active_idx" ON "patient_assignments"("patientId", "active");

DO $$
BEGIN
  IF to_regclass('public.appointments') IS NOT NULL THEN
    INSERT INTO "patient_assignments" ("id", "clinicId", "patientId", "userId", "role", "active", "createdAt")
    SELECT gen_random_uuid()::text, a."clinicId", a."patientId", a."doctorId", 'treating_doctor', true, now()
    FROM (SELECT DISTINCT "clinicId", "patientId", "doctorId" FROM "appointments") a
    WHERE a."doctorId" IS NOT NULL
    ON CONFLICT ("patientId", "userId", "role") DO NOTHING;
  END IF;
END $$;
