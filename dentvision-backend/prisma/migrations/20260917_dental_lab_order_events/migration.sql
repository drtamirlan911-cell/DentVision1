-- Audit trail for dental-lab order status transitions.
-- The API records every clinic-scoped status change here; keep the table
-- independent from LabOrder so deleting an order does not erase the audit row.
CREATE TABLE IF NOT EXISTS "dental_lab_order_events" (
  "id" TEXT NOT NULL,
  "labOrderId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dental_lab_order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dental_lab_order_events_labOrderId_createdAt_idx"
  ON "dental_lab_order_events"("labOrderId", "createdAt");

CREATE INDEX IF NOT EXISTS "dental_lab_order_events_clinicId_createdAt_idx"
  ON "dental_lab_order_events"("clinicId", "createdAt");

CREATE INDEX IF NOT EXISTS "dental_lab_order_events_actorUserId_createdAt_idx"
  ON "dental_lab_order_events"("actorUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dental_lab_order_events_labOrderId_fkey'
  ) THEN
    ALTER TABLE "dental_lab_order_events"
      ADD CONSTRAINT "dental_lab_order_events_labOrderId_fkey"
      FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dental_lab_order_events_clinicId_fkey'
  ) THEN
    ALTER TABLE "dental_lab_order_events"
      ADD CONSTRAINT "dental_lab_order_events_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dental_lab_order_events_actorUserId_fkey'
  ) THEN
    ALTER TABLE "dental_lab_order_events"
      ADD CONSTRAINT "dental_lab_order_events_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
