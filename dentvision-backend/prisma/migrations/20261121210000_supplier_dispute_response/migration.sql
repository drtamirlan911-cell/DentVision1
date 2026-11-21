CREATE TABLE IF NOT EXISTS "supplier_dispute_responses" (
  "id" TEXT NOT NULL, "disputeId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "supplierId" TEXT NOT NULL,
  "responseType" TEXT NOT NULL, "note" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_dispute_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_dispute_responses_disputeId_supplierId_key" ON "supplier_dispute_responses"("disputeId", "supplierId");
CREATE INDEX IF NOT EXISTS "supplier_dispute_responses_supplierId_createdAt_idx" ON "supplier_dispute_responses"("supplierId", "createdAt");
CREATE INDEX IF NOT EXISTS "supplier_dispute_responses_orderId_createdAt_idx" ON "supplier_dispute_responses"("orderId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "supplier_dispute_responses" ADD CONSTRAINT "supplier_dispute_responses_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "supplier_dispute_responses" ADD CONSTRAINT "supplier_dispute_responses_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "supplier_dispute_responses" ADD CONSTRAINT "supplier_dispute_responses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
