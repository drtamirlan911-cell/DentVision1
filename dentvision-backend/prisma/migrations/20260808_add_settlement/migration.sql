-- CreateTable: settlements (platform-commission settlement per center/lab per period)
CREATE TABLE IF NOT EXISTS "settlements" (
  "id" TEXT NOT NULL,
  "ownerType" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "referralCount" INTEGER NOT NULL DEFAULT 0,
  "commissionMinor" BIGINT NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'open',
  "paymentId" TEXT,
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "settlements_ownerType_ownerId_idx" ON "settlements"("ownerType", "ownerId");
CREATE INDEX IF NOT EXISTS "settlements_status_idx" ON "settlements"("status");
CREATE INDEX IF NOT EXISTS "settlements_periodStart_periodEnd_idx" ON "settlements"("periodStart", "periodEnd");

-- AlterTable: referrals add settlementId (handle both @@map and PascalCase table names)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referrals') THEN
    ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "settlementId" TEXT;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Referral') THEN
    ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "settlementId" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "referrals_settlementId_idx" ON "referrals"("settlementId");

-- AddForeignKey: referrals.settlementId -> settlements.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'referrals_settlementId_fkey'
  ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referrals') THEN
    ALTER TABLE "referrals" ADD CONSTRAINT "referrals_settlementId_fkey"
      FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
