-- Content-addressed cache of synthesised narration.
--
-- Keyed on the text rather than on a beat, plan or patient: the same opening
-- sentence is spoken to every patient of every clinic, so it is synthesised
-- once for the whole platform and re-watching a plan costs nothing.
--
-- Not a patient document — this never appears in the Documents tab and is not
-- reachable through the files routes.
--
-- Idempotent; mirrored as a runOnceMigration block in src/index.ts.

CREATE TABLE IF NOT EXISTS "voice_assets" (
  "id" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "voice" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "storageUrl" TEXT NOT NULL,
  "durationMs" INTEGER,
  "bytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voice_assets_pkey" PRIMARY KEY ("id")
);

-- The cache itself: one row per distinct spoken sentence.
CREATE UNIQUE INDEX IF NOT EXISTS "voice_assets_cacheKey_key" ON "voice_assets"("cacheKey");
-- Lets a later eviction pass tell cold entries from hot ones.
CREATE INDEX IF NOT EXISTS "voice_assets_lastUsedAt_idx" ON "voice_assets"("lastUsedAt");
