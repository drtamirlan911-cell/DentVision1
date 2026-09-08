-- Product categoryId is part of the Prisma Product model but the legacy
-- init_full_schema migration only created the denormalized category field.
-- Add the nullable relation key after the base products table exists.

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
    CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products"("categoryId");
  END IF;
END $$;
