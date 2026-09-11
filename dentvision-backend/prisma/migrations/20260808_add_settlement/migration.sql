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

-- AlterTable: referrals add settlementId when the referral table exists.
-- The base schema may use either the mapped lowercase table or the Prisma default PascalCase table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referrals') THEN
    ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "settlementId" TEXT;
    CREATE INDEX IF NOT EXISTS "referrals_settlementId_idx" ON "referrals"("settlementId");

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND constraint_name = 'referrals_settlementId_fkey'
    ) THEN
      ALTER TABLE "referrals" ADD CONSTRAINT "referrals_settlementId_fkey"
        FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Referral') THEN
    ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "settlementId" TEXT;
    CREATE INDEX IF NOT EXISTS "Referral_settlementId_idx" ON "Referral"("settlementId");

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND constraint_name = 'Referral_settlementId_fkey'
    ) THEN
      ALTER TABLE "Referral" ADD CONSTRAINT "Referral_settlementId_fkey"
        FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
