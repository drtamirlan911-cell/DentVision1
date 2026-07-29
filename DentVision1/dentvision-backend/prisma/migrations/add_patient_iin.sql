ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "iin" TEXT;

CREATE INDEX IF NOT EXISTS "patient_iin_idx" ON "Patient"("iin");
