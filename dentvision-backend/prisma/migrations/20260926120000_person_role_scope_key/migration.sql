-- Master Spec v5: PersonRole uniqueness must include the authorization scope.
-- The old [personId, roleId] constraint made the same role impossible in
-- multiple organizations and contradicted the scopeType/scopeId model.

ALTER TABLE "person_roles"
  ADD COLUMN IF NOT EXISTS "scopeKey" TEXT NOT NULL DEFAULT 'platform';

UPDATE "person_roles"
SET "scopeKey" = CASE
  WHEN LOWER(COALESCE("scopeType", '')) = 'organization' AND "scopeId" IS NOT NULL
    THEN 'organization:' || "scopeId"
  WHEN LOWER(COALESCE("scopeType", '')) = 'platform'
    THEN 'platform'
  ELSE COALESCE(LOWER("scopeType"), 'platform')
END;

DROP INDEX IF EXISTS "person_roles_personId_roleId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "person_roles_personId_roleId_scopeKey_key"
  ON "person_roles" ("personId", "roleId", "scopeKey");

CREATE INDEX IF NOT EXISTS "person_roles_scopeKey_idx"
  ON "person_roles" ("scopeKey");
