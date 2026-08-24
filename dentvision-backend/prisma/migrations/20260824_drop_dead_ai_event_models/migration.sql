-- Drops two genuinely dead models, confirmed by docs/SYSTEM_MAP.md's
-- self-audit (Stage 12) to have zero Prisma-client references anywhere.
--
-- `ai_events` (AIEvent) is deliberately NOT dropped here even though its
-- only writer (`EventStore.ts`) is itself only ever called from inside
-- `EventBus.ts`'s internal bookkeeping — a Redis Streams bus that nothing
-- publishes to, but that IS still wired into server startup/shutdown via
-- `eventOrchestrator.ts` (`src/index.ts`'s `orchestrator.start()/.stop()`).
-- Untangling that from `AIEvent` is a separate, larger change (removing the
-- whole `modules/events/` + `ai/os/eventOrchestrator.ts` layer) that the
-- plan explicitly deferred rather than resurrect; this migration only
-- removes what was cleanly, provably unreferenced on its own:
--
-- - `ai_actions` (AIAction) / `ai_alerts` (AIAlert) — zero references
--   anywhere in the app, confirmed before and after this change.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

DROP TABLE IF EXISTS "ai_actions";
DROP TABLE IF EXISTS "ai_alerts";
DROP TYPE IF EXISTS "ActionStatus";
