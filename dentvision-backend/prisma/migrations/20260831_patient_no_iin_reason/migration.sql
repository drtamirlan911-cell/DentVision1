-- The IIN is the identifier a Kazakhstan clinic actually works by, so it
-- becomes required when a patient is created. It cannot be required
-- unconditionally: a foreign national has none, and a patient booking over
-- WhatsApp has nobody to ask. `noIinReason` records that the requirement was
-- waived on purpose, so "no IIN" is a documented decision rather than an
-- empty field nobody noticed.
--
-- Nullable, no backfill: rows older than the requirement keep both columns
-- empty and are flagged in the patient card instead. The directory fills in
-- as those records are next touched, which is the point — the platform
-- accumulates IINs by working, not by a one-off migration.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "noIinReason" TEXT;
