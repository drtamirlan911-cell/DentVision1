-- DentVision ecosystem-wide support inbox.
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED');
CREATE TYPE "SupportTicketCategory" AS ENUM ('ACCOUNT','ACCESS','WORKFLOW','BILLING','BUG','SECURITY','OTHER');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW','NORMAL','HIGH','URGENT');

CREATE TABLE "support_tickets" (
  "id" TEXT NOT NULL, "requesterUserId" TEXT, "assigneeUserId" TEXT,
  "category" "SupportTicketCategory" NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "subject" VARCHAR(160) NOT NULL, "description" TEXT NOT NULL, "sourcePath" VARCHAR(240),
  "firstResponseAt" TIMESTAMP(3), "resolvedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "support_ticket_messages" (
  "id" TEXT NOT NULL, "ticketId" TEXT NOT NULL, "authorUserId" TEXT, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_tickets_requesterUserId_updatedAt_idx" ON "support_tickets"("requesterUserId","updatedAt");
CREATE INDEX "support_tickets_status_priority_createdAt_idx" ON "support_tickets"("status","priority","createdAt");
CREATE INDEX "support_tickets_assigneeUserId_status_idx" ON "support_tickets"("assigneeUserId","status");
CREATE INDEX "support_ticket_messages_ticketId_createdAt_idx" ON "support_ticket_messages"("ticketId","createdAt");
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigneeUserId_fkey"
  FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
