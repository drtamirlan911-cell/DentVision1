-- Community feed + ensure lab_orders columns match Prisma model

CREATE TABLE IF NOT EXISTS "community_posts" (
  "id" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorRole" TEXT,
  "content" TEXT NOT NULL,
  "tags" JSONB,
  "kind" TEXT NOT NULL DEFAULT 'thread',
  "likesCount" INTEGER NOT NULL DEFAULT 0,
  "commentsCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "community_posts_createdAt_idx" ON "community_posts"("createdAt");

CREATE TABLE IF NOT EXISTS "community_likes" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "community_likes_postId_userId_key" ON "community_likes"("postId", "userId");

DO $$ BEGIN
  ALTER TABLE "community_likes" ADD CONSTRAINT "community_likes_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lab orders: align production table with dentvision-backend Prisma model
CREATE TABLE IF NOT EXISTS "lab_orders" (
  "id" TEXT NOT NULL,
  "patientId" TEXT,
  "clinicId" TEXT NOT NULL,
  "labName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "type" TEXT,
  "notes" TEXT,
  "files" JSONB,
  "deadline" TIMESTAMP(3),
  "price" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "patientId" TEXT;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "clinicId" TEXT;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "labName" TEXT;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'pending';
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "files" JSONB;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3);
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "lab_orders_clinicId_idx" ON "lab_orders"("clinicId");
