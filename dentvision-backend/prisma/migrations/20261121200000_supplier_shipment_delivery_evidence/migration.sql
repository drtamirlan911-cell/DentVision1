CREATE TABLE IF NOT EXISTS "supplier_shipments" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "supplierId" TEXT NOT NULL,
  "carrier" TEXT NOT NULL, "trackingNumber" TEXT NOT NULL, "trackingUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'shipped', "shippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3), "proofOfDeliveryUrl" TEXT, "recipientName" TEXT,
  "deliveryNote" TEXT, "createdByUserId" TEXT NOT NULL, "deliveredByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "supplier_shipments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_shipments_supplierId_orderId_key" ON "supplier_shipments"("supplierId", "orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_shipments_supplierId_trackingNumber_key" ON "supplier_shipments"("supplierId", "trackingNumber");
CREATE INDEX IF NOT EXISTS "supplier_shipments_supplierId_status_shippedAt_idx" ON "supplier_shipments"("supplierId", "status", "shippedAt");
CREATE INDEX IF NOT EXISTS "supplier_shipments_orderId_createdAt_idx" ON "supplier_shipments"("orderId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "supplier_shipments" ADD CONSTRAINT "supplier_shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "supplier_shipments" ADD CONSTRAINT "supplier_shipments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "supplier_shipment_events" (
  "id" TEXT NOT NULL, "shipmentId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "supplierId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL, "fromStatus" TEXT, "toStatus" TEXT, "note" TEXT,
  "actorUserId" TEXT NOT NULL, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_shipment_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "supplier_shipment_events_shipmentId_createdAt_idx" ON "supplier_shipment_events"("shipmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "supplier_shipment_events_supplierId_createdAt_idx" ON "supplier_shipment_events"("supplierId", "createdAt");
CREATE INDEX IF NOT EXISTS "supplier_shipment_events_orderId_createdAt_idx" ON "supplier_shipment_events"("orderId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "supplier_shipment_events" ADD CONSTRAINT "supplier_shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "supplier_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "supplier_shipment_events" ADD CONSTRAINT "supplier_shipment_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "supplier_shipment_events" ADD CONSTRAINT "supplier_shipment_events_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
