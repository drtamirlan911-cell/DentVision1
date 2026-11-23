-- One platform user may own multiple independent organizations and each
-- organization must retain its own legal package and signer history.
-- The active organization -> legal_partner_contexts mapping remains the
-- authoritative lookup; legacy user-only resolution is allowed only when
-- exactly one legal partner exists for that user.
DROP INDEX IF EXISTS "legal_partners_userId_key";

CREATE INDEX IF NOT EXISTS "legal_partners_userId_idx"
  ON "legal_partners"("userId");
