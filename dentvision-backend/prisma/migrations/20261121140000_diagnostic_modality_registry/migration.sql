CREATE TABLE IF NOT EXISTS "diagnostic_modalities" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "room" TEXT,
    "aeTitle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastMaintenanceAt" TIMESTAMP(3),
    "nextMaintenanceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "diagnostic_modalities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "diagnostic_modalities_centerId_serialNumber_key"
  ON "diagnostic_modalities"("centerId", "serialNumber");
CREATE INDEX IF NOT EXISTS "diagnostic_modalities_centerId_status_idx"
  ON "diagnostic_modalities"("centerId", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagnostic_modalities_centerId_fkey') THEN
    ALTER TABLE "diagnostic_modalities"
      ADD CONSTRAINT "diagnostic_modalities_centerId_fkey"
      FOREIGN KEY ("centerId") REFERENCES "diagnostic_centers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "modalityId" TEXT;
CREATE INDEX IF NOT EXISTS "referrals_modalityId_idx" ON "referrals"("modalityId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_modalityId_fkey') THEN
    ALTER TABLE "referrals"
      ADD CONSTRAINT "referrals_modalityId_fkey"
      FOREIGN KEY ("modalityId") REFERENCES "diagnostic_modalities"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
