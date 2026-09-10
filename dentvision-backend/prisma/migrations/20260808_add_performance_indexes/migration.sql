-- Performance indexes: composite btree for clinic-scoped list/aggregate hot paths,
-- trigram GIN for %term% text search (patients, marketplace catalog).
--
-- This repository does not have a baseline migration that guarantees every
-- application table exists before this migration runs on a fresh database.
-- Guard each table-level index with to_regclass so migrate deploy can proceed
-- safely; existing tables still receive the intended indexes.

DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "invoices_clinicId_status_createdAt_idx"
      ON "invoices"("clinicId", "status", "createdAt");
  END IF;

  IF to_regclass('public.documents') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "documents_clinicId_createdAt_idx"
      ON "documents"("clinicId", "createdAt");
  END IF;

  IF to_regclass('public.lab_orders') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "lab_orders_clinicId_createdAt_idx"
      ON "lab_orders"("clinicId", "createdAt");
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "audit_logs_clinicId_createdAt_idx"
      ON "audit_logs"("clinicId", "createdAt");
  END IF;

  IF to_regclass('public.transactions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "transactions_type_idx"
      ON "transactions"("type");
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF to_regclass('public.patients') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "patients_firstName_trgm_idx"
      ON "patients" USING gin ("firstName" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "patients_lastName_trgm_idx"
      ON "patients" USING gin ("lastName" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "patients_phone_trgm_idx"
      ON "patients" USING gin ("phone" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "patients_email_trgm_idx"
      ON "patients" USING gin ("email" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "patients_iin_trgm_idx"
      ON "patients" USING gin ("iin" gin_trgm_ops);
  END IF;

  IF to_regclass('public.products') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "products_name_trgm_idx"
      ON "products" USING gin ("name" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "products_brand_trgm_idx"
      ON "products" USING gin ("brand" gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS "products_description_trgm_idx"
      ON "products" USING gin ("description" gin_trgm_ops);
  END IF;
END $$;
