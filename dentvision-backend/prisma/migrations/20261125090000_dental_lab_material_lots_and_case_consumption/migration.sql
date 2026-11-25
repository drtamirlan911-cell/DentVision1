CREATE TABLE IF NOT EXISTS "dental_lab_materials" (
  "id" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "minimumStockMilli" BIGINT NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dental_lab_materials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dental_lab_materials_minimumStockMilli_check" CHECK ("minimumStockMilli" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_materials_labId_code_key"
  ON "dental_lab_materials"("labId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_materials_id_labId_key"
  ON "dental_lab_materials"("id", "labId");
CREATE INDEX IF NOT EXISTS "dental_lab_materials_labId_active_idx"
  ON "dental_lab_materials"("labId", "active");

DO $$ BEGIN
  ALTER TABLE "dental_lab_materials" ADD CONSTRAINT "dental_lab_materials_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "dental_lab_material_lots" (
  "id" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "lotNumber" TEXT NOT NULL,
  "supplierName" TEXT,
  "supplierLotNumber" TEXT,
  "receivedQuantityMilli" BIGINT NOT NULL,
  "remainingQuantityMilli" BIGINT NOT NULL,
  "unitCostMinor" BIGINT NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'KZT',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "receivedByUserId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dental_lab_material_lots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dental_lab_material_lots_quantity_check"
    CHECK ("receivedQuantityMilli" > 0 AND "remainingQuantityMilli" >= 0 AND "remainingQuantityMilli" <= "receivedQuantityMilli"),
  CONSTRAINT "dental_lab_material_lots_cost_check" CHECK ("unitCostMinor" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_material_lots_labId_materialId_lotNumber_key"
  ON "dental_lab_material_lots"("labId", "materialId", "lotNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_material_lots_id_labId_key"
  ON "dental_lab_material_lots"("id", "labId");
CREATE INDEX IF NOT EXISTS "dental_lab_material_lots_labId_materialId_expiresAt_idx"
  ON "dental_lab_material_lots"("labId", "materialId", "expiresAt");
CREATE INDEX IF NOT EXISTS "dental_lab_material_lots_labId_remainingQuantityMilli_idx"
  ON "dental_lab_material_lots"("labId", "remainingQuantityMilli");

DO $$ BEGIN
  ALTER TABLE "dental_lab_material_lots" ADD CONSTRAINT "dental_lab_material_lots_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dental_lab_material_lots" ADD CONSTRAINT "dental_lab_material_lots_materialId_labId_fkey"
    FOREIGN KEY ("materialId", "labId") REFERENCES "dental_lab_materials"("id", "labId") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "dental_lab_case_materials" (
  "id" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "labOrderId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "lotId" TEXT NOT NULL,
  "quantityMilli" BIGINT NOT NULL,
  "unitCostMinorSnapshot" BIGINT NOT NULL,
  "totalCostMinorSnapshot" BIGINT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadFingerprint" TEXT NOT NULL,
  "consumedByUserId" TEXT NOT NULL,
  "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedByUserId" TEXT,
  "reversalReason" TEXT,
  CONSTRAINT "dental_lab_case_materials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dental_lab_case_materials_amount_check"
    CHECK ("quantityMilli" > 0 AND "unitCostMinorSnapshot" >= 0 AND "totalCostMinorSnapshot" >= 0),
  CONSTRAINT "dental_lab_case_materials_reversal_check"
    CHECK (("reversedAt" IS NULL AND "reversedByUserId" IS NULL AND "reversalReason" IS NULL)
        OR ("reversedAt" IS NOT NULL AND "reversedByUserId" IS NOT NULL AND "reversalReason" IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_case_materials_labId_idempotencyKey_key"
  ON "dental_lab_case_materials"("labId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "dental_lab_case_materials_labId_labOrderId_consumedAt_idx"
  ON "dental_lab_case_materials"("labId", "labOrderId", "consumedAt");
CREATE INDEX IF NOT EXISTS "dental_lab_case_materials_lotId_consumedAt_idx"
  ON "dental_lab_case_materials"("lotId", "consumedAt");

DO $$ BEGIN
  ALTER TABLE "dental_lab_case_materials" ADD CONSTRAINT "dental_lab_case_materials_labOrderId_fkey"
    FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dental_lab_case_materials" ADD CONSTRAINT "dental_lab_case_materials_materialId_labId_fkey"
    FOREIGN KEY ("materialId", "labId") REFERENCES "dental_lab_materials"("id", "labId") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dental_lab_case_materials" ADD CONSTRAINT "dental_lab_case_materials_lotId_labId_fkey"
    FOREIGN KEY ("lotId", "labId") REFERENCES "dental_lab_material_lots"("id", "labId") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
