-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "city" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "suppliers_city_idx" ON "suppliers"("city");
