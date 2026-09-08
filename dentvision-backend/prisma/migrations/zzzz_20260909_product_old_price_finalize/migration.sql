-- Product.oldPrice is part of the Prisma Product model but the legacy
-- init_full_schema migration did not create it. Keep the column nullable so
-- existing products remain valid and discount displays can opt into it.

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "oldPrice" INTEGER;
  END IF;
END $$;
