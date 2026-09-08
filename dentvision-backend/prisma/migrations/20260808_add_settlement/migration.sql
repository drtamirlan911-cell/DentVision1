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

-- The Referral model is part of the full application schema, but some historical
-- databases were bootstrapped without that table. Keep this migration deploy-safe
-- while applying the settlement relation whenever the table exists.
DO $$
DECLARE
  referral_table TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'referrals'
  ) THEN
    referral_table := 'referrals';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'Referral'
  ) THEN
    referral_table := 'Referral';
  END IF;

  IF referral_table IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "settlementId" TEXT', referral_table);
    EXECUTE format('CREATE INDEX IF NOT EXISTS "referrals_settlementId_idx" ON %I("settlementId")', referral_table);
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = current_schema()
        AND constraint_name = 'referrals_settlementId_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT "referrals_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        referral_table
      );
    END IF;
  END IF;
END $$;
