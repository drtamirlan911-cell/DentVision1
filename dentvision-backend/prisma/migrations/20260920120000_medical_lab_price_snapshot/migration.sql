-- Preserve the exact test price used for medical-lab payment/economics.
ALTER TABLE "medical_lab_order_tests"
  ADD COLUMN IF NOT EXISTS "priceMinor" BIGINT;
