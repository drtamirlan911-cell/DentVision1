-- Склад: журнал движений, правила списания, связь позиции с маркетплейсом.
-- Зеркалит блок runOnceMigration('inventory_deduction_rules') в src/index.ts —
-- миграции в этом проекте применяются на старте приложения, а не через
-- `prisma migrate deploy`.

ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "autoRestock" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "inventory_clinicId_productId_idx" ON "inventory"("clinicId", "productId");

CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "refType" TEXT,
  "refId" TEXT,
  "note" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- Ключ идемпотентности: один заказ или приём не может тронуть одну позицию
-- дважды. Ручные движения держат refType/refId пустыми, а NULL-ы в Postgres
-- не равны друг другу — под ограничение они не попадают.
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_movements_refType_refId_itemId_key"
  ON "inventory_movements"("refType", "refId", "itemId");
CREATE INDEX IF NOT EXISTS "inventory_movements_clinicId_createdAt_idx"
  ON "inventory_movements"("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS "inventory_movements_itemId_createdAt_idx"
  ON "inventory_movements"("itemId", "createdAt");

CREATE TABLE IF NOT EXISTS "stock_deduction_rules" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'always',
  "matchKey" TEXT NOT NULL DEFAULT '',
  "label" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "stock_deduction_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_deduction_rules_clinicId_scope_matchKey_key"
  ON "stock_deduction_rules"("clinicId", "scope", "matchKey");
CREATE INDEX IF NOT EXISTS "stock_deduction_rules_clinicId_active_idx"
  ON "stock_deduction_rules"("clinicId", "active");

CREATE TABLE IF NOT EXISTS "stock_deduction_rule_items" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "stock_deduction_rule_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_deduction_rule_items_ruleId_itemId_key"
  ON "stock_deduction_rule_items"("ruleId", "itemId");
CREATE INDEX IF NOT EXISTS "stock_deduction_rule_items_itemId_idx"
  ON "stock_deduction_rule_items"("itemId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inventory_movements_clinicId_fkey') THEN
    ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inventory_movements_itemId_fkey') THEN
    ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'stock_deduction_rules_clinicId_fkey') THEN
    ALTER TABLE "stock_deduction_rules" ADD CONSTRAINT "stock_deduction_rules_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'stock_deduction_rule_items_ruleId_fkey') THEN
    ALTER TABLE "stock_deduction_rule_items" ADD CONSTRAINT "stock_deduction_rule_items_ruleId_fkey"
      FOREIGN KEY ("ruleId") REFERENCES "stock_deduction_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'stock_deduction_rule_items_itemId_fkey') THEN
    ALTER TABLE "stock_deduction_rule_items" ADD CONSTRAINT "stock_deduction_rule_items_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
