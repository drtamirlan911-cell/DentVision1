-- Immutable monthly branch-capacity invoices for explicitly priced partner verticals.
-- This stores an audited tariff/count/period snapshot. It does not execute payment.
CREATE TABLE IF NOT EXISTS "partner_branch_subscription_invoices" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "vertical" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "activeBranchCount" INTEGER NOT NULL,
  "billableBranchCount" INTEGER NOT NULL,
  "branchIds" JSONB NOT NULL,
  "unitPriceKzt" INTEGER NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KZT',
  "status" TEXT NOT NULL DEFAULT 'issued',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "paymentId" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "partner_branch_subscription_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partner_branch_subscription_invoices_period_check" CHECK ("periodEnd" > "periodStart"),
  CONSTRAINT "partner_branch_subscription_invoices_counts_check" CHECK ("activeBranchCount" >= 0 AND "billableBranchCount" >= 1),
  CONSTRAINT "partner_branch_subscription_invoices_amount_check" CHECK ("unitPriceKzt" > 0 AND "amountMinor" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_branch_subscription_invoices_invoiceNumber_key"
  ON "partner_branch_subscription_invoices"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "partner_branch_subscription_invoices_paymentId_key"
  ON "partner_branch_subscription_invoices"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "partner_branch_subscription_invoices_subscriptionId_periodStart_key"
  ON "partner_branch_subscription_invoices"("subscriptionId", "periodStart");
CREATE INDEX IF NOT EXISTS "partner_branch_subscription_invoices_organizationId_status_periodStart_idx"
  ON "partner_branch_subscription_invoices"("organizationId", "status", "periodStart");
CREATE INDEX IF NOT EXISTS "partner_branch_subscription_invoices_ownerId_periodStart_idx"
  ON "partner_branch_subscription_invoices"("ownerId", "periodStart");

DO $$ BEGIN
  ALTER TABLE "partner_branch_subscription_invoices"
    ADD CONSTRAINT "partner_branch_subscription_invoices_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "partner_branch_subscription_invoices"
    ADD CONSTRAINT "partner_branch_subscription_invoices_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
