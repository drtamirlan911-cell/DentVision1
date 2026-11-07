-- Reconcile historic dental_lab_order_events table shapes: first assignment has no prior status and writes a note.
CREATE TABLE IF NOT EXISTS "dental_lab_order_events" (
  "id" TEXT NOT NULL, "labOrderId" TEXT NOT NULL, "clinicId" TEXT NOT NULL,
  "fromStatus" TEXT, "toStatus" TEXT NOT NULL, "note" TEXT,
  "actorUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dental_lab_order_events_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "dental_lab_order_events" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "dental_lab_order_events" ALTER COLUMN "fromStatus" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "dental_lab_order_events_labOrderId_createdAt_idx" ON "dental_lab_order_events" ("labOrderId", "createdAt");
CREATE INDEX IF NOT EXISTS "dental_lab_order_events_clinicId_createdAt_idx" ON "dental_lab_order_events" ("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS "dental_lab_order_events_actorUserId_createdAt_idx" ON "dental_lab_order_events" ("actorUserId", "createdAt");
