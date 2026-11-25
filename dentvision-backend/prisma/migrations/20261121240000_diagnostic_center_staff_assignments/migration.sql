-- A person must have at most one operator and one radiologist record per center.
-- Repoint historical referrals to the oldest staff record before removing duplicates.
WITH ranked AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (PARTITION BY "centerId", "userId" ORDER BY "createdAt" ASC, "id" ASC) AS "canonicalId",
    ROW_NUMBER() OVER (PARTITION BY "centerId", "userId" ORDER BY "createdAt" ASC, "id" ASC) AS "rn"
  FROM "operators"
)
UPDATE "referrals" AS r
SET "operatorId" = ranked."canonicalId"
FROM ranked
WHERE r."operatorId" = ranked."id" AND ranked."rn" > 1;

WITH ranked AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (PARTITION BY "centerId", "userId" ORDER BY "createdAt" ASC, "id" ASC) AS "canonicalId",
    ROW_NUMBER() OVER (PARTITION BY "centerId", "userId" ORDER BY "createdAt" ASC, "id" ASC) AS "rn"
  FROM "operators"
)
DELETE FROM "operators" AS o
USING ranked
WHERE o."id" = ranked."id" AND ranked."rn" > 1;

WITH ranked AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (PARTITION BY "centerId", "userId" ORDER BY "createdAt" ASC, "id" ASC) AS "canonicalId",
    ROW_NUMBER() OVER (PARTITION BY "centerId", "userId" ORDER BY "createdAt" ASC, "id" ASC) AS "rn"
  FROM "radiologists"
)
UPDATE "referrals" AS r
SET "radiologistId" = ranked."canonicalId"
FROM ranked
WHERE r."radiologistId" = ranked."id" AND ranked."rn" > 1;

WITH ranked AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (PARTITION BY "centerId", "userId" ORDER BY "createdAt" ASC, "id" ASC) AS "canonicalId",
    ROW_NUMBER() OVER (PARTITION BY "centerId", "userId" ORDER BY "createdAt" ASC, "id" ASC) AS "rn"
  FROM "radiologists"
)
DELETE FROM "radiologists" AS r
USING ranked
WHERE r."id" = ranked."id" AND ranked."rn" > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "operators_centerId_userId_key"
  ON "operators"("centerId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "radiologists_centerId_userId_key"
  ON "radiologists"("centerId", "userId");
