-- Add the idempotency_records table (audit F-3).
--
-- The table is declared in schema.prisma and used by the payment POST handler,
-- but no migration ever created it — on databases that only ran the boot DDL
-- (which also omits it) every idempotency lookup threw P2021 and payments were
-- created without dedupe. `paymentId` is nullable so a key can be reserved
-- before the payment row exists, which serializes concurrent double-submits.
CREATE TABLE IF NOT EXISTS "idempotency_records" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_key_key" ON "idempotency_records"("key");
CREATE INDEX IF NOT EXISTS "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- Legacy databases created via `db push` before the schema allowed NULL keep
-- paymentId NOT NULL; align them with the schema so the reserve-first flow works.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'idempotency_records'
      AND column_name = 'paymentId' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "idempotency_records" ALTER COLUMN "paymentId" DROP NOT NULL;
  END IF;
END $$;
