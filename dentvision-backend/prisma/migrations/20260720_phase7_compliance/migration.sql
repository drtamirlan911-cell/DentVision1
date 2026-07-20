-- CreateTable
CREATE TABLE "compliance_checks" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'needs_review',
    "findings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_checks_entityType_entityId_idx" ON "compliance_checks"("entityType", "entityId");

