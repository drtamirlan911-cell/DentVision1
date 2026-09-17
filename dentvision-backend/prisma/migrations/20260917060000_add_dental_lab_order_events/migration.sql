CREATE TABLE IF NOT EXISTS "dental_lab_order_events" (
  "id" TEXT NOT NULL,
  "labOrderId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dental_lab_order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dental_lab_order_events_labOrderId_createdAt_idx"
  ON "dental_lab_order_events" ("labOrderId", "createdAt");

CREATE INDEX IF NOT EXISTS "dental_lab_order_events_clinicId_createdAt_idx"
  ON "dental_lab_order_events" ("clinicId", "createdAt");

CREATE INDEX IF NOT EXISTS "dental_lab_order_events_actorUserId_createdAt_idx"
  ON "dental_lab_order_events" ("actorUserId", "createdAt");
