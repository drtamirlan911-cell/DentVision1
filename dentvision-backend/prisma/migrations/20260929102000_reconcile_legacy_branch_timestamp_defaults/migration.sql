-- Keep legacy snake_case Branch audit columns writable by the canonical Prisma model.
-- Some production rows/tables predate the camelCase compatibility columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'UPDATE "branches" SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL';
    EXECUTE 'ALTER TABLE "branches" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'updated_at'
  ) THEN
    EXECUTE 'UPDATE "branches" SET "updated_at" = CURRENT_TIMESTAMP WHERE "updated_at" IS NULL';
    EXECUTE 'ALTER TABLE "branches" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP';
  END IF;
END $$;
