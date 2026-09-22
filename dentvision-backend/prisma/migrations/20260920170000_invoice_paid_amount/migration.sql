ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paidAmount" INTEGER NOT NULL DEFAULT 0;

UPDATE "invoices"
SET "paidAmount" = CASE WHEN "status" = 'paid' THEN "amount" ELSE 0 END
WHERE "paidAmount" = 0;
