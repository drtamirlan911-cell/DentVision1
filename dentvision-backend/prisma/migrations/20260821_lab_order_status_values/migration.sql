-- lab.routes.ts accepts these six statuses, but the Prisma enum migration
-- must also remain deploy-safe when the V2 bootstrap is supplied separately.
-- The enum itself is created by init_full_schema; this migration only extends it.
--
-- Purely additive and idempotent: existing values and rows are untouched.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'LabOrderStatus'
      AND n.nspname = 'public'
  ) THEN
    ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'sent';
    ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'try_in';
    ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'adjustment';
    ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'ready';
    ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'remake';
    ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'delayed';
  END IF;
END $$;
