-- Repair the AIEventStatus enum so its values match the Prisma schema.
--
-- The boot-time fallback `add_ai_events.sql` originally created the enum with
-- UPPERCASE values ('PENDING', ...) while init_full_schema and the Prisma
-- schema use lowercase ('pending', ...). Postgres enum values are case-sensitive,
-- so every insert of a lowercase status failed on databases that got the table
-- from that fallback file. This migration recreates the enum with the lowercase
-- values and rewrites existing rows, only when the uppercase variant is present.
DO $$
DECLARE
  v_has_upper  BOOLEAN;
  v_has_table  BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AIEventStatus' AND e.enumlabel = 'PENDING'
  ) INTO v_has_upper;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_events'
  ) INTO v_has_table;

  IF v_has_upper THEN
    ALTER TYPE "AIEventStatus" RENAME TO "AIEventStatus_old";

    CREATE TYPE "AIEventStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

    IF v_has_table THEN
      ALTER TABLE "ai_events" ALTER COLUMN "status" TYPE "AIEventStatus"
        USING lower("status"::text)::"AIEventStatus";
      ALTER TABLE "ai_events" ALTER COLUMN "status" SET DEFAULT 'pending';
    END IF;

    DROP TYPE "AIEventStatus_old";
  END IF;
END $$;
