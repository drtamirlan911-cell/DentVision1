-- Whether the AI pass actually looked at the attached study, or only at the
-- referral's free text. Existing rows were all generated without ever seeing
-- the image, so the default of false is also the correct backfill.
ALTER TABLE IF EXISTS "diagnostic_results"
  ADD COLUMN IF NOT EXISTS "aiSawSource" BOOLEAN NOT NULL DEFAULT false;
