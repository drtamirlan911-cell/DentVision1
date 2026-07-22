-- Adaptive learning fields on AI messages (feedback + few-shot retrieval)
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "clinicId" TEXT;
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "feedback" TEXT;
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "feedbackAt" TIMESTAMP(3);
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "prevUserText" TEXT;

CREATE INDEX IF NOT EXISTS "ai_messages_userId_feedback_idx" ON "ai_messages"("userId", "feedback");
