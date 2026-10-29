-- Backfill 30-day trials for legacy self-service clinics created before the
-- trial bootstrap was added. The shared demo clinic and unrelated/non-clinic
-- subscriptions are untouched; history is anchored to the clinic's createdAt.
INSERT INTO "subscriptions"
  ("id", "ownerType", "ownerId", "plan", "status", "periodEnd", "createdAt", "updatedAt")
SELECT
  md5('dentvision-clinic-trial:' || c."id"),
  'CLINIC',
  c."id",
  'enterprise',
  CASE WHEN CURRENT_TIMESTAMP >= c."createdAt" + INTERVAL '30 days' THEN 'expired' ELSE 'trialing' END,
  c."createdAt" + INTERVAL '30 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "clinics" c
JOIN "organizations" o
  ON o."originalType" = 'Clinic'
 AND o."originalId" = c."id"
WHERE c."plan" = 'DEMO'
  AND o."archivedAt" IS NULL
  AND o."settings" ->> 'selfServiceType' = 'clinic'
  AND NOT EXISTS (
    SELECT 1 FROM "subscriptions" s
    WHERE s."ownerType" = 'CLINIC' AND s."ownerId" = c."id"
  );

UPDATE "clinics" c
SET "plan" = 'ENTERPRISE'
FROM "organizations" o
WHERE o."originalType" = 'Clinic'
  AND o."originalId" = c."id"
  AND o."settings" ->> 'selfServiceType' = 'clinic'
  AND c."plan" = 'DEMO'
  AND EXISTS (
    SELECT 1 FROM "subscriptions" s
    WHERE s."ownerType" = 'CLINIC' AND s."ownerId" = c."id"
  );
