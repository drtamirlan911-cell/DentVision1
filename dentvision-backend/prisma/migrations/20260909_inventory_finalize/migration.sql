-- Finalize inventory after init_full_schema creates its base table.
-- Keeps the feature migration compatible with clean databases while also
-- upgrading installations where inventory already existed before init.

DO $$
BEGIN
  IF to_regclass('public.inventory') IS NOT NULL THEN
    ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "sku" TEXT;
    ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "productId" TEXT;
    ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);
    ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "autoRestock" BOOLEAN NOT NULL DEFAULT true;

    CREATE INDEX IF NOT EXISTS "inventory_clinicId_productId_idx"
      ON "inventory"("clinicId", "productId");
    CREATE INDEX IF NOT EXISTS "inventory_clinicId_idx"
      ON "inventory"("clinicId");

    IF to_regclass('public.clinics') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint WHERE conname = 'inventory_clinicId_fkey'
       ) THEN
      ALTER TABLE "inventory" ADD CONSTRAINT "inventory_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "clinics"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF to_regclass('public.inventory_movements') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_itemId_fkey'
       ) THEN
      ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "inventory"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF to_regclass('public.stock_deduction_rule_items') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint WHERE conname = 'stock_deduction_rule_items_itemId_fkey'
       ) THEN
      ALTER TABLE "stock_deduction_rule_items" ADD CONSTRAINT "stock_deduction_rule_items_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "inventory"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.inventory_movements') IS NOT NULL
     AND to_regclass('public.clinics') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_clinicId_fkey'
     ) THEN
    ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.stock_deduction_rules') IS NOT NULL
     AND to_regclass('public.clinics') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'stock_deduction_rules_clinicId_fkey'
     ) THEN
    ALTER TABLE "stock_deduction_rules" ADD CONSTRAINT "stock_deduction_rules_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('public.stock_deduction_rule_items') IS NOT NULL
     AND to_regclass('public.stock_deduction_rules') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'stock_deduction_rule_items_ruleId_fkey'
     ) THEN
    ALTER TABLE "stock_deduction_rule_items" ADD CONSTRAINT "stock_deduction_rule_items_ruleId_fkey"
      FOREIGN KEY ("ruleId") REFERENCES "stock_deduction_rules"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
