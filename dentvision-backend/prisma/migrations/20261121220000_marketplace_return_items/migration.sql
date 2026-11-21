ALTER TABLE "disputes"
  ADD COLUMN IF NOT EXISTS "requesterUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "clientRequestKey" TEXT,
  ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "disputes_clientRequestKey_key"
  ON "disputes"("clientRequestKey");

CREATE TABLE IF NOT EXISTS "marketplace_return_items" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "lineIndex" INTEGER NOT NULL,
  "productId" TEXT NOT NULL,
  "supplierId" TEXT,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplace_return_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketplace_return_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "marketplace_return_items_unitPrice_check" CHECK ("unitPrice" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_return_items_disputeId_lineIndex_key"
  ON "marketplace_return_items"("disputeId", "lineIndex");
CREATE INDEX IF NOT EXISTS "marketplace_return_items_orderId_lineIndex_idx"
  ON "marketplace_return_items"("orderId", "lineIndex");
CREATE INDEX IF NOT EXISTS "marketplace_return_items_supplierId_createdAt_idx"
  ON "marketplace_return_items"("supplierId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "marketplace_return_items" ADD CONSTRAINT "marketplace_return_items_disputeId_fkey"
    FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "marketplace_return_items" ADD CONSTRAINT "marketplace_return_items_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
