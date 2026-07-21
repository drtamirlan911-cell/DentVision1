-- DentCashback: USER wallets, cashback rules, ledger, product ownBrand, order meta
ALTER TYPE "WalletOwnerType" ADD VALUE IF NOT EXISTS 'USER';

DO $$ BEGIN
  CREATE TYPE "CashbackScope" AS ENUM ('ALL', 'CATEGORY', 'PRODUCT', 'OWN_BRAND');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ownBrand" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "meta" JSONB;

CREATE TABLE IF NOT EXISTS "cashback_rules" (
  "id" TEXT NOT NULL,
  "ownerType" "WalletOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "scope" "CashbackScope" NOT NULL DEFAULT 'ALL',
  "scopeKey" TEXT,
  "rateBps" INTEGER NOT NULL,
  "capMinor" BIGINT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cashback_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cashback_rules_ownerType_ownerId_active_idx"
  ON "cashback_rules"("ownerType", "ownerId", "active");
CREATE INDEX IF NOT EXISTS "cashback_rules_scope_scopeKey_idx"
  ON "cashback_rules"("scope", "scopeKey");

CREATE TABLE IF NOT EXISTS "dentcash_ledger" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KZT',
  "refType" TEXT,
  "refId" TEXT,
  "sellerType" TEXT,
  "sellerId" TEXT,
  "meta" JSONB,
  "availableAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dentcash_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dentcash_ledger_userId_status_idx" ON "dentcash_ledger"("userId", "status");
CREATE INDEX IF NOT EXISTS "dentcash_ledger_refType_refId_idx" ON "dentcash_ledger"("refType", "refId");
