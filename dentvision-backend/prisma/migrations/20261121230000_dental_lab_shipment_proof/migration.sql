-- Dental laboratory dispatch, pickup and proof-of-delivery records.
-- Delivery is an operational handoff; commercial commission remains settlement-driven.
CREATE TABLE IF NOT EXISTS "dental_lab_shipments" (
  "id" TEXT NOT NULL,
  "labOrderId" TEXT NOT NULL,
  "laboratoryId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "carrier" TEXT,
  "trackingNumber" TEXT,
  "trackingUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'dispatched',
  "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "proofUrl" TEXT,
  "recipientName" TEXT,
  "deliveryNote" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "deliveredByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dental_lab_shipments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_shipments_labOrderId_key"
  ON "dental_lab_shipments"("labOrderId");
CREATE INDEX IF NOT EXISTS "dental_lab_shipments_laboratoryId_status_dispatchedAt_idx"
  ON "dental_lab_shipments"("laboratoryId", "status", "dispatchedAt");

DO $$ BEGIN
  ALTER TABLE "dental_lab_shipments" ADD CONSTRAINT "dental_lab_shipments_labOrderId_fkey"
    FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dental_lab_shipments" ADD CONSTRAINT "dental_lab_shipments_laboratoryId_fkey"
    FOREIGN KEY ("laboratoryId") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "dental_lab_shipment_events" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "note" TEXT,
  "actorUserId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dental_lab_shipment_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dental_lab_shipment_events_shipmentId_createdAt_idx"
  ON "dental_lab_shipment_events"("shipmentId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "dental_lab_shipment_events" ADD CONSTRAINT "dental_lab_shipment_events_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "dental_lab_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
