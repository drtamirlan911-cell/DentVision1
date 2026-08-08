-- Performance indexes: composite btree for clinic-scoped list/aggregate hot paths,
-- trigram GIN for %term% text search (patients, marketplace catalog). All idempotent.

-- Composite btree indexes
CREATE INDEX IF NOT EXISTS "invoices_clinicId_status_createdAt_idx" ON "invoices"("clinicId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "documents_clinicId_createdAt_idx" ON "documents"("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS "lab_orders_clinicId_createdAt_idx" ON "lab_orders"("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_clinicId_createdAt_idx" ON "audit_logs"("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS "transactions_type_idx" ON "transactions"("type");

-- Trigram GIN search indexes (requires pg_trgm; created only if extension is available)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "patients_firstName_trgm_idx" ON "patients" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "patients_lastName_trgm_idx" ON "patients" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "patients_phone_trgm_idx" ON "patients" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "patients_email_trgm_idx" ON "patients" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "patients_iin_trgm_idx" ON "patients" USING gin ("iin" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "products_brand_trgm_idx" ON "products" USING gin ("brand" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "products_description_trgm_idx" ON "products" USING gin ("description" gin_trgm_ops);
