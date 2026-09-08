-- Product.minStock is part of the Prisma Product model but the legacy
-- init_full_schema migration did not create it. Preserve existing products
-- by adding it as nullable at the SQL layer; Prisma's model default remains
-- responsible for new writes.

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "minStock" INTEGER;
  END IF;
END $$;
