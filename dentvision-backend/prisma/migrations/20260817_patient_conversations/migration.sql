-- The live-human channel a patient's assistant conversation escalates into.
--
-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientConversationStatus') THEN
    CREATE TYPE "PatientConversationStatus" AS ENUM ('WAITING', 'LIVE', 'RESOLVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientConversationAuthorType') THEN
    CREATE TYPE "PatientConversationAuthorType" AS ENUM ('PATIENT', 'STAFF', 'SYSTEM');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "patient_conversations" (
  "id" TEXT NOT NULL,
  "patientUserId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "status" "PatientConversationStatus" NOT NULL DEFAULT 'WAITING',
  "assignedToUserId" TEXT,
  "escalationReason" TEXT,
  "lastPatientMessageAt" TIMESTAMP(3),
  "lastStaffMessageAt" TIMESTAMP(3),
  "onCallNotifiedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "patient_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patient_conversations_clinicId_status_lastPatientMessageAt_idx"
  ON "patient_conversations"("clinicId", "status", "lastPatientMessageAt");
CREATE INDEX IF NOT EXISTS "patient_conversations_patientUserId_clinicId_idx"
  ON "patient_conversations"("patientUserId", "clinicId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'patient_conversations_patientUserId_fkey') THEN
    ALTER TABLE "patient_conversations" ADD CONSTRAINT "patient_conversations_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'patient_conversations_clinicId_fkey') THEN
    ALTER TABLE "patient_conversations" ADD CONSTRAINT "patient_conversations_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'patient_conversations_assignedToUserId_fkey') THEN
    ALTER TABLE "patient_conversations" ADD CONSTRAINT "patient_conversations_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "patient_conversation_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "authorType" "PatientConversationAuthorType" NOT NULL,
  "authorUserId" TEXT,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patient_conversation_messages_conversationId_createdAt_idx"
  ON "patient_conversation_messages"("conversationId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'patient_conversation_messages_conversationId_fkey') THEN
    ALTER TABLE "patient_conversation_messages" ADD CONSTRAINT "patient_conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "patient_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'patient_conversation_messages_authorUserId_fkey') THEN
    ALTER TABLE "patient_conversation_messages" ADD CONSTRAINT "patient_conversation_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
