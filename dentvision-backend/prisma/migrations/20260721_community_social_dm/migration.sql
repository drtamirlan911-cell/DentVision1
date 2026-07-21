-- Community social: comments, saves, DMs
CREATE TABLE IF NOT EXISTS "community_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "community_saves" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_saves_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dm_conversations" (
    "id" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dm_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dm_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dm_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dm_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dm_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "community_comments_postId_createdAt_idx" ON "community_comments"("postId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "community_saves_postId_userId_key" ON "community_saves"("postId", "userId");
CREATE INDEX IF NOT EXISTS "community_saves_userId_createdAt_idx" ON "community_saves"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "dm_conversations_pairKey_key" ON "dm_conversations"("pairKey");
CREATE INDEX IF NOT EXISTS "dm_conversations_updatedAt_idx" ON "dm_conversations"("updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "dm_participants_conversationId_userId_key" ON "dm_participants"("conversationId", "userId");
CREATE INDEX IF NOT EXISTS "dm_participants_userId_idx" ON "dm_participants"("userId");
CREATE INDEX IF NOT EXISTS "dm_messages_conversationId_createdAt_idx" ON "dm_messages"("conversationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "community_saves" ADD CONSTRAINT "community_saves_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "dm_participants" ADD CONSTRAINT "dm_participants_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "dm_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "dm_messages" ADD CONSTRAINT "dm_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "dm_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
