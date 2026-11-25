ALTER TABLE "medical_lab_orders"
  ADD COLUMN IF NOT EXISTS "accessionRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "medical_lab_specimens" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "accessionNumber" TEXT NOT NULL,
  "parentSpecimenId" TEXT,
  "specimenType" TEXT NOT NULL,
  "containerType" TEXT,
  "volume" DECIMAL(12,3),
  "volumeUnit" TEXT,
  "status" TEXT NOT NULL DEFAULT 'collected',
  "location" TEXT,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "receivedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "medical_lab_specimens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "medical_lab_specimens_accessionNumber_key" ON "medical_lab_specimens"("accessionNumber");
CREATE INDEX IF NOT EXISTS "medical_lab_specimens_orderId_createdAt_idx" ON "medical_lab_specimens"("orderId","createdAt");
CREATE INDEX IF NOT EXISTS "medical_lab_specimens_labId_status_idx" ON "medical_lab_specimens"("labId","status");
CREATE INDEX IF NOT EXISTS "medical_lab_specimens_parentSpecimenId_idx" ON "medical_lab_specimens"("parentSpecimenId");

DO $$ BEGIN
  ALTER TABLE "medical_lab_specimens" ADD CONSTRAINT "medical_lab_specimens_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "medical_lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_specimens" ADD CONSTRAINT "medical_lab_specimens_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "laboratories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_specimens" ADD CONSTRAINT "medical_lab_specimens_parentSpecimenId_fkey"
    FOREIGN KEY ("parentSpecimenId") REFERENCES "medical_lab_specimens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_specimens" ADD CONSTRAINT "medical_lab_specimens_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_specimens" ADD CONSTRAINT "medical_lab_specimens_receivedByUserId_fkey"
    FOREIGN KEY ("receivedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "medical_lab_specimen_events" (
  "id" TEXT NOT NULL,
  "specimenId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "location" TEXT,
  "note" TEXT,
  "actorUserId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medical_lab_specimen_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "medical_lab_specimen_events_specimenId_createdAt_idx" ON "medical_lab_specimen_events"("specimenId","createdAt");
CREATE INDEX IF NOT EXISTS "medical_lab_specimen_events_orderId_createdAt_idx" ON "medical_lab_specimen_events"("orderId","createdAt");
DO $$ BEGIN
  ALTER TABLE "medical_lab_specimen_events" ADD CONSTRAINT "medical_lab_specimen_events_specimenId_fkey"
    FOREIGN KEY ("specimenId") REFERENCES "medical_lab_specimens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_specimen_events" ADD CONSTRAINT "medical_lab_specimen_events_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "medical_lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_specimen_events" ADD CONSTRAINT "medical_lab_specimen_events_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "laboratories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_specimen_events" ADD CONSTRAINT "medical_lab_specimen_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;