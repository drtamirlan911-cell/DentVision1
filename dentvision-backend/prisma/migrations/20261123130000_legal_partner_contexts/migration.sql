-- Organization-scoped mapping for legal partner packages.
-- Existing mappings are reconstructed only when the canonical IAM owner graph
-- identifies exactly one organization for a partner and one partner for that
-- organization. Ambiguous legacy ownership is intentionally left unmapped.
CREATE TABLE IF NOT EXISTS "legal_partner_contexts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "partner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_partner_contexts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_partner_contexts_organization_id_key"
  ON "legal_partner_contexts"("organization_id");

CREATE INDEX IF NOT EXISTS "legal_partner_contexts_partner_id_idx"
  ON "legal_partner_contexts"("partner_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"legal_partner_contexts"'::regclass
      AND conname = 'legal_partner_contexts_organization_id_fkey'
  ) THEN
    ALTER TABLE "legal_partner_contexts"
      ADD CONSTRAINT "legal_partner_contexts_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"legal_partner_contexts"'::regclass
      AND conname = 'legal_partner_contexts_partner_id_fkey'
  ) THEN
    ALTER TABLE "legal_partner_contexts"
      ADD CONSTRAINT "legal_partner_contexts_partner_id_fkey"
      FOREIGN KEY ("partner_id") REFERENCES "legal_partners"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Preserve legacy legal packages only where the canonical IAM owner graph
-- produces an unambiguous one-to-one organization ↔ partner match. Never pick
-- an arbitrary organization when the same owner participates in several.
WITH candidate_pairs AS (
  SELECT DISTINCT
    organization."id" AS organization_id,
    partner."id" AS partner_id
  FROM "legal_partners" partner
  JOIN "persons" person
    ON person."userId" = partner."userId"
   AND person."organization_id" IS NOT NULL
  JOIN "organizations" organization
    ON organization."id" = person."organization_id"
  JOIN "person_roles" person_role
    ON person_role."personId" = person."id"
   AND person_role."scopeType" = 'organization'
   AND person_role."scopeId" = organization."id"
  JOIN "roles" iam_role
    ON iam_role."id" = person_role."roleId"
   AND (iam_role."key" = 'owner' OR RIGHT(iam_role."key", 6) = '_owner')
  WHERE partner."userId" IS NOT NULL
),
unambiguous_pairs AS (
  SELECT
    organization_id,
    partner_id,
    COUNT(*) OVER (PARTITION BY partner_id) AS organizations_per_partner,
    COUNT(*) OVER (PARTITION BY organization_id) AS partners_per_organization
  FROM candidate_pairs
)
INSERT INTO "legal_partner_contexts" ("id", "organization_id", "partner_id")
SELECT
  gen_random_uuid()::text,
  organization_id,
  partner_id
FROM unambiguous_pairs
WHERE organizations_per_partner = 1
  AND partners_per_organization = 1
ON CONFLICT ("organization_id") DO NOTHING;
