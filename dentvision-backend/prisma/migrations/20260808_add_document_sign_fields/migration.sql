-- AlterTable: documents add signToken/signatureData/signedByName (handle both
-- @@map lowercase and PascalCase table names, matching this repo's convention).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
    ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "signToken" TEXT;
    ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "signatureData" TEXT;
    ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "signedByName" TEXT;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Document') THEN
    ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "signToken" TEXT;
    ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "signatureData" TEXT;
    ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "signedByName" TEXT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "documents_signToken_key" ON "documents"("signToken");
