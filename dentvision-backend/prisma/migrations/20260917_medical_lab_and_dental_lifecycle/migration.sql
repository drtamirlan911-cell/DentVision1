-- Medical Laboratory lifecycle: order -> specimen -> processing -> result -> verification -> interpretation.
CREATE TABLE IF NOT EXISTS "medical_lab_orders" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "patientId" TEXT,
  "treatmentCaseId" TEXT,
  "labId" TEXT,
  "orderedByUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ordered',
  "priority" TEXT NOT NULL DEFAULT 'routine',
  "notes" TEXT,
  "specimenType" TEXT,
  "collectedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "resultReadyAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "interpretation" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "medical_lab_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "medical_lab_orders_clinicId_createdAt_idx" ON "medical_lab_orders"("clinicId","createdAt");
CREATE INDEX IF NOT EXISTS "medical_lab_orders_patientId_idx" ON "medical_lab_orders"("patientId");
CREATE INDEX IF NOT EXISTS "medical_lab_orders_treatmentCaseId_idx" ON "medical_lab_orders"("treatmentCaseId");
CREATE INDEX IF NOT EXISTS "medical_lab_orders_labId_status_idx" ON "medical_lab_orders"("labId","status");

DO $$ BEGIN
  ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_treatmentCaseId_fkey" FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_labId_fkey" FOREIGN KEY ("labId") REFERENCES "laboratories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_orderedByUserId_fkey" FOREIGN KEY ("orderedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "medical_lab_order_tests" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "testId" TEXT,
  "name" TEXT NOT NULL,
  "analyteCode" TEXT,
  "result" TEXT,
  "unit" TEXT,
  "referenceRange" TEXT,
  "flag" TEXT,
  "resultText" TEXT,
  "metadata" JSONB,
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "medical_lab_order_tests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "medical_lab_order_tests_orderId_idx" ON "medical_lab_order_tests"("orderId");
CREATE INDEX IF NOT EXISTS "medical_lab_order_tests_testId_idx" ON "medical_lab_order_tests"("testId");
DO $$ BEGIN
  ALTER TABLE "medical_lab_order_tests" ADD CONSTRAINT "medical_lab_order_tests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "medical_lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_order_tests" ADD CONSTRAINT "medical_lab_order_tests_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "medical_lab_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "note" TEXT,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medical_lab_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "medical_lab_events_orderId_createdAt_idx" ON "medical_lab_events"("orderId","createdAt");
CREATE INDEX IF NOT EXISTS "medical_lab_events_clinicId_createdAt_idx" ON "medical_lab_events"("clinicId","createdAt");
DO $$ BEGIN
  ALTER TABLE "medical_lab_events" ADD CONSTRAINT "medical_lab_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "medical_lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_events" ADD CONSTRAINT "medical_lab_events_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "medical_lab_events" ADD CONSTRAINT "medical_lab_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Dental laboratory lifecycle audit: the existing LabOrder remains the canonical order entity.
CREATE TABLE IF NOT EXISTS "dental_lab_order_events" (
  "id" TEXT NOT NULL,
  "labOrderId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "note" TEXT,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dental_lab_order_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dental_lab_order_events_labOrderId_createdAt_idx" ON "dental_lab_order_events"("labOrderId","createdAt");
CREATE INDEX IF NOT EXISTS "dental_lab_order_events_clinicId_createdAt_idx" ON "dental_lab_order_events"("clinicId","createdAt");
DO $$ BEGIN
  ALTER TABLE "dental_lab_order_events" ADD CONSTRAINT "dental_lab_order_events_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dental_lab_order_events" ADD CONSTRAINT "dental_lab_order_events_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dental_lab_order_events" ADD CONSTRAINT "dental_lab_order_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
