CREATE TABLE IF NOT EXISTS "dental_lab_services" (
  "id" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "material" TEXT,
  "defaultPrice" INTEGER NOT NULL,
  "turnaroundDays" INTEGER NOT NULL DEFAULT 5,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dental_lab_services_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_services_labId_code_key"
  ON "dental_lab_services"("labId", "code");
CREATE INDEX IF NOT EXISTS "dental_lab_services_labId_active_idx"
  ON "dental_lab_services"("labId", "active");
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "serviceNameSnapshot" TEXT;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "servicePriceSnapshot" INTEGER;
CREATE INDEX IF NOT EXISTS "lab_orders_serviceId_idx" ON "lab_orders"("serviceId");
DO $$ BEGIN
  ALTER TABLE "dental_lab_services" ADD CONSTRAINT "dental_lab_services_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "dental_lab_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
