-- Add encrypted storage and a clinic/channel-scoped blind index for external
-- WhatsApp/Instagram contact identifiers. Keep the legacy column and unique
-- index during rollout so old rows remain readable until the audited backfill.
ALTER TABLE "ai_admin_sessions"
  ALTER COLUMN "externalUserId" DROP NOT NULL,
  ADD COLUMN "externalUserIdCiphertext" TEXT,
  ADD COLUMN "externalUserIdHash" TEXT;

CREATE UNIQUE INDEX "ai_admin_sessions_channel_externalUserIdHash_clinicId_key"
  ON "ai_admin_sessions"("channel", "externalUserIdHash", "clinicId");

ALTER TABLE "ai_admin_sessions"
  ADD COLUMN "patientNameCiphertext" TEXT,
  ADD COLUMN "patientPhoneCiphertext" TEXT;
