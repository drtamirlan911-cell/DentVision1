-- Person.userId was globally unique, so the unified model could represent only
-- ONE organization per user. Every membership beyond the first was silently
-- dropped (the sync helpers bail out when a Person for that user already
-- exists) or stolen (grantDiagnosticsAccess relocated the existing Person into
-- the new organization). A doctor working in two clinics, or an owner who also
-- runs a laboratory, had no representation at all — which is what kept the
-- legacy ClinicMember columns load-bearing.
--
-- Replaced with a per-organization unique. Note this is effectively one-way:
-- once multi-org Person rows exist, the global unique cannot be restored.
--
-- Written defensively: the hand-written 20260730 migration declares snake_case
-- columns ("user_id", "organization_id") while schema.prisma declares camelCase
-- for everything except organizationId, so the live column names cannot be
-- determined from the repository alone. Both spellings are resolved at runtime
-- and the statement is a no-op when neither is present.

DO $$
DECLARE
  user_col   text;
  org_col    text;
  idx_name   text;
BEGIN
  IF to_regclass('public.persons') IS NULL THEN
    RAISE NOTICE 'persons table absent — nothing to do';
    RETURN;
  END IF;

  SELECT column_name INTO user_col
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'persons' AND column_name IN ('userId', 'user_id')
  LIMIT 1;

  SELECT column_name INTO org_col
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'persons' AND column_name IN ('organizationId', 'organization_id')
  LIMIT 1;

  IF user_col IS NULL OR org_col IS NULL THEN
    RAISE NOTICE 'persons user/organization columns not found — skipping';
    RETURN;
  END IF;

  -- Drop the global unique on the user column, whatever Prisma named it.
  FOR idx_name IN
    SELECT i.relname
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    WHERE t.relname = 'persons'
      AND x.indisunique
      AND x.indnatts = 1
      AND (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = x.indkey[0]) = user_col
  LOOP
    EXECUTE format('ALTER TABLE public.persons DROP CONSTRAINT IF EXISTS %I', idx_name);
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
  END LOOP;

  -- Postgres treats NULLs as distinct, so Person rows without a userId
  -- (imported staff with no platform account) are unaffected.
  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS "persons_userId_organizationId_key" ON public.persons (%I, %I)',
    user_col, org_col
  );

  EXECUTE format('CREATE INDEX IF NOT EXISTS "persons_userId_idx" ON public.persons (%I)', user_col);
END $$;
