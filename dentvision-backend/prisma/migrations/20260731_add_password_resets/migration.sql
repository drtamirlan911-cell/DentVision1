-- CreateTable
CREATE TABLE IF NOT EXISTS "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (try both PascalCase and lowercase table names for compatibility)
CREATE INDEX IF NOT EXISTS "password_resets_userId_idx" ON "password_resets"("userId");
CREATE INDEX IF NOT EXISTS "password_resets_token_idx" ON "password_resets"("token");

-- AddForeignKey (try PascalCase, fallback to lowercase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = "User") THEN
    ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = "users") THEN
    ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;