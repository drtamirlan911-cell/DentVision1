-- Контент-планы: сохранение, редактирование, кэш сгенерированных картинок.
-- Зеркалит блок runOnceMigration('marketing_content_plans') в src/index.ts —
-- миграции в этом проекте применяются на старте приложения.

CREATE TABLE IF NOT EXISTS "content_plans" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "title" TEXT,
  "tone" TEXT,
  "contextSnapshot" JSONB NOT NULL,
  "deterministic" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "content_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "content_plans_clinicId_createdAt_idx"
  ON "content_plans"("clinicId", "createdAt");

CREATE TABLE IF NOT EXISTS "content_ideas" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "hook" TEXT NOT NULL,
  "caption" TEXT NOT NULL,
  "hashtags" JSONB NOT NULL,
  "callToAction" TEXT NOT NULL,
  "basedOn" TEXT NOT NULL,
  "edited" BOOLEAN NOT NULL DEFAULT false,
  "coverUrl" TEXT,
  "slideUrls" JSONB,
  "imagePrompt" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "content_ideas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "content_ideas_planId_position_key"
  ON "content_ideas"("planId", "position");
CREATE INDEX IF NOT EXISTS "content_ideas_planId_idx" ON "content_ideas"("planId");

-- Кэш картинок: ключ содержательный, поэтому один и тот же промпт
-- генерируется на платформе один раз.
CREATE TABLE IF NOT EXISTS "marketing_assets" (
  "id" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "storageUrl" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketing_assets_cacheKey_key"
  ON "marketing_assets"("cacheKey");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'content_plans_clinicId_fkey') THEN
    ALTER TABLE "content_plans" ADD CONSTRAINT "content_plans_clinicId_fkey"
      FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'content_ideas_planId_fkey') THEN
    ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "content_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
