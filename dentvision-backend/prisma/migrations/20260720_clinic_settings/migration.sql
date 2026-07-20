-- Per-clinic settings JSON + retire CASHIER memberships → ADMIN

ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "settings" JSONB;

UPDATE "clinic_members" SET "role" = 'ADMIN' WHERE "role" = 'CASHIER';
UPDATE "users" SET "role" = 'ADMIN' WHERE "role" = 'CASHIER';
