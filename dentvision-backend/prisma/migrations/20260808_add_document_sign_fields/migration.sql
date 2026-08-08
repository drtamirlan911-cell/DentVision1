-- Document signing: signToken / signatureData / signedByName.
--
-- The unique index used to sit outside the table-name guard and named
-- "documents" unconditionally, so it raised 42P01 wherever the table is called
-- something else. Everything is resolved and executed inside one guard now.
DO $$
DECLARE
  doc_table text;
BEGIN
  SELECT table_name INTO doc_table FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('documents', 'Document') LIMIT 1;

  IF doc_table IS NULL THEN
    RAISE NOTICE 'documents table absent — nothing to do';
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "signToken" TEXT', doc_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "signatureData" TEXT', doc_table);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "signedByName" TEXT', doc_table);

  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS "documents_signToken_key" ON public.%I ("signToken")',
    doc_table
  );
END $$;
