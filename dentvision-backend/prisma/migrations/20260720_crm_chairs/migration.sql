-- Clinic chairs for schedule resource conflicts

CREATE TABLE IF NOT EXISTS "chairs" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chairs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chairs_clinicId_active_idx" ON "chairs"("clinicId", "active");

DO $$ BEGIN
  ALTER TABLE "chairs" ADD CONSTRAINT "chairs_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
