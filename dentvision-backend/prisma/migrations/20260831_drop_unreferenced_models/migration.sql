-- Drops three models that docs/SYSTEM_MAP.md reports as having zero direct
-- Prisma-client calls — the same self-audit that justified dropping
-- ai_actions/ai_alerts in 20260824, re-run against a map that had gone five
-- pull requests stale.
--
-- Each was confirmed by hand as well as by the generator, because the
-- generator's "untouched" list is a signal, not a verdict:
--
-- - `spec_templates` (SpecTemplate) — per-category product spec fields for
--   the marketplace. Referenced only by `ShopCategory.specTemplates`, which
--   nothing selects; the enum `SpecFieldType` existed solely for it.
-- - `financial_transactions` (FinancialTransaction) — a second, parallel
--   money ledger that was never written to. Real movement lives in
--   `ledger_entries` / `payments`; the enum `FinancialTxType` existed solely
--   for this table.
-- - `diagnostic_schedules` (Schedule) — a slot table for diagnostic centres,
--   superseded by `DiagnosticBooking` + the availability computed in
--   `bookingSlots.ts`. Referenced only by `DiagnosticCenter.schedules`.
--
-- All three were empty on a real database before this ran. `RevenueSource`
-- is NOT dropped: `Revenue` still uses it, and `Revenue` is not dead — it is
-- written on every marketplace/academy sale and on clinic subscription
-- activation. What it lacked was a reader, and this change adds one
-- (`GET /api/finance/revenue-by-source`) rather than deleting the ledger.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

DROP TABLE IF EXISTS "spec_templates";
DROP TABLE IF EXISTS "financial_transactions";
DROP TABLE IF EXISTS "diagnostic_schedules";
DROP TYPE IF EXISTS "SpecFieldType";
DROP TYPE IF EXISTS "FinancialTxType";
