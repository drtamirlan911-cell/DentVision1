-- AlterTable (try both PascalCase and lowercase table names)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = "Patient") THEN
    ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "userId" TEXT;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = "patients") THEN
    ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "userId" TEXT;
  END IF;
END $$;

-- CreateIndex (both variants)
CREATE INDEX IF NOT EXISTS "Patient_userId_idx" ON "Patient"("userId");
CREATE INDEX IF NOT EXISTS "patients_userId_idx" ON "patients"("userId");

-- AddForeignKey (try both table name variants)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = "Patient") THEN
    ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = "patients") THEN
    ALTER TABLE "patients" ADD CONSTRAINT "patients_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;