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

-- Existing DEMO rows can also have a stale active subscription without a
-- finite period. Normalize these to the same 30-day trial contract.
UPDATE "subscriptions" AS s
SET "plan" = 'enterprise',
    "status" = CASE
      WHEN c."createdAt" + INTERVAL '30 days' <= CURRENT_TIMESTAMP THEN 'expired'
      ELSE 'trialing'
    END,
    "periodEnd" = c."createdAt" + INTERVAL '30 days',
    "updatedAt" = CURRENT_TIMESTAMP
FROM "clinics" AS c
WHERE s."ownerType" = 'CLINIC'
  AND s."ownerId" = c."id"
  AND c."plan" = 'DEMO'
  AND s."status" IN ('active', 'trialing');

-- The previous expiry job set Clinic.active=false after periodEnd. Restore
-- expired-trial clinics to active tenancy state so they remain readable;
-- subscription.status='expired' continues to block writes at every write gate.
UPDATE "clinics" AS c
SET "active" = true
FROM "subscriptions" AS s
WHERE s."ownerType" = 'CLINIC'
  AND s."ownerId" = c."id"
  AND s."status" = 'expired'
  AND s."periodEnd" IS NOT NULL
  AND c."active" = false;
