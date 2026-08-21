-- lab.routes.ts's VALID_STATUSES has, since it was written, accepted
-- 'sent', 'try_in', 'adjustment', 'ready', 'remake', 'delayed' as legal
-- input for PATCH /:id/status — the real dental-lab workflow (sent to lab,
-- fabrication, try-in with the patient, adjustment, ready for pickup,
-- remake, delayed). The LabOrderStatus enum was never updated to match, so
-- every one of those six passed the route's own validation and then
-- crashed the Prisma write with a 500 (PrismaClientValidationError:
-- Invalid value for argument `status`. Expected LabOrderStatus).
--
-- Purely additive: existing rows and the existing values (pending,
-- in_progress, completed, cancelled, delivered) are untouched.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts, because
-- `prisma migrate deploy` has not reliably reached production here.

ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'try_in';
ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'adjustment';
ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'remake';
ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'delayed';
