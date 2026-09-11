-- LegalPartner used to be globally unique by userId. That breaks the
-- multi-organization contract boundary: one person can own/join multiple
-- organizations, each with its own legal entity, documents and signature state.
-- Remove that global uniqueness and introduce an organization-scoped mapping.

DROP INDEX IF EXISTS "legal_partners_user_id_key";

CREATE TABLE IF NOT EXISTS "legal_partner_contexts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "partner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "legal_partner_contexts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_partner_contexts_organization_id_key"
  ON "legal_partner_contexts"("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "legal_partner_contexts_partner_id_key"
  ON "legal_partner_contexts"("partner_id");
CREATE INDEX IF NOT EXISTS "legal_partner_contexts_partner_id_idx"
  ON "legal_partner_contexts"("partner_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'legal_partner_contexts_organization_id_fkey'
  ) THEN
    ALTER TABLE "legal_partner_contexts"
      ADD CONSTRAINT "legal_partner_contexts_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'legal_partner_contexts_partner_id_fkey'
  ) THEN
    ALTER TABLE "legal_partner_contexts"
      ADD CONSTRAINT "legal_partner_contexts_partner_id_fkey"
      FOREIGN KEY ("partner_id") REFERENCES "legal_partners"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Safely attach legacy partners only where their owner has exactly one
-- organization. Ambiguous multi-organization accounts remain unmapped and
-- must select an explicit workspace before using legal partner capabilities.
INSERT INTO "legal_partner_contexts" ("id", "organization_id", "partner_id")
SELECT
  gen_random_uuid()::text,
  x.organization_id,
  x.partner_id
FROM (
  SELECT
    lp.id AS partner_id,
    MIN(p.organization_id) AS organization_id
  FROM "legal_partners" lp
  JOIN "persons" p ON p.user_id = lp.user_id
  WHERE lp.user_id IS NOT NULL
    AND p.organization_id IS NOT NULL
  GROUP BY lp.id
  HAVING COUNT(DISTINCT p.organization_id) = 1
) x
ON CONFLICT (organization_id) DO NOTHING;
