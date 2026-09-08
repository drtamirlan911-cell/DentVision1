-- Final deploy-safe Product schema parity guard.
-- init_full_schema predates the current Prisma Product model, so this migration
-- repairs all optional catalog columns that legacy databases may be missing.
DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "brand" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price" INTEGER;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "oldPrice" INTEGER;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "minStock" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "images" JSONB;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reviewCount" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shared_product_id" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ownBrand" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unit" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'KZT';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tags" JSONB;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "specs" JSONB;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "model3dUrl" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "country" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMPTZ;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "compatibility" TEXT;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS "products_supplierId_idx" ON "products"("supplierId");
    CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products"("categoryId");
    CREATE INDEX IF NOT EXISTS "products_isActive_idx" ON "products"("isActive");
  END IF;
END $$;
