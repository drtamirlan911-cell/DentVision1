-- Older self-service and clinic-creation paths assigned DEMO directly and
-- never created a Subscription row. Backfill those clinics using the original
-- clinic creation date so trials cannot remain writable indefinitely.
-- The curated demo fixture is created as PRO with a non-expiring subscription,
-- so it is intentionally not included here.
INSERT INTO "subscriptions"
  ("id", "ownerType", "ownerId", "plan", "status", "periodEnd", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'CLINIC',
  c."id",
  'enterprise',
  CASE
    WHEN c."createdAt" + INTERVAL '30 days' <= CURRENT_TIMESTAMP THEN 'expired'
    ELSE 'trialing'
  END,
  c."createdAt" + INTERVAL '30 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "clinics" AS c
WHERE c."plan" = 'DEMO'
  AND NOT EXISTS (
    SELECT 1
    FROM "subscriptions" AS s
    WHERE s."ownerType" = 'CLINIC'
      AND s."ownerId" = c."id"
  );
