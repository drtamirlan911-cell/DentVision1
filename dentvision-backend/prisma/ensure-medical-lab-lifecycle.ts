import prisma from '../src/lib/prisma.js';

const statements = [
  `CREATE TABLE IF NOT EXISTS "medical_lab_orders" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "medical_lab_orders_clinicId_createdAt_idx" ON "medical_lab_orders"("clinicId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "medical_lab_orders_patientId_idx" ON "medical_lab_orders"("patientId")`,
  `CREATE INDEX IF NOT EXISTS "medical_lab_orders_treatmentCaseId_idx" ON "medical_lab_orders"("treatmentCaseId")`,
  `CREATE INDEX IF NOT EXISTS "medical_lab_orders_labId_status_idx" ON "medical_lab_orders"("labId","status")`,
  `DO $$ BEGIN ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    IF to_regclass('public.treatment_cases') IS NOT NULL THEN
      BEGIN
        ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_treatmentCaseId_fkey"
          FOREIGN KEY ("treatmentCaseId") REFERENCES "treatment_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END $$`,
  `DO $$ BEGIN ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_labId_fkey" FOREIGN KEY ("labId") REFERENCES "laboratories"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "medical_lab_orders" ADD CONSTRAINT "medical_lab_orders_orderedByUserId_fkey" FOREIGN KEY ("orderedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "medical_lab_order_tests" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "testId" TEXT,
    "priceMinor" BIGINT,
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
  )`,
  `ALTER TABLE "medical_lab_order_tests" ADD COLUMN IF NOT EXISTS "priceMinor" BIGINT`,
  `CREATE INDEX IF NOT EXISTS "medical_lab_order_tests_orderId_idx" ON "medical_lab_order_tests"("orderId")`,
  `CREATE INDEX IF NOT EXISTS "medical_lab_order_tests_testId_idx" ON "medical_lab_order_tests"("testId")`,
  `DO $$ BEGIN ALTER TABLE "medical_lab_order_tests" ADD CONSTRAINT "medical_lab_order_tests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "medical_lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "medical_lab_order_tests" ADD CONSTRAINT "medical_lab_order_tests_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "medical_lab_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medical_lab_events_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "medical_lab_events_orderId_createdAt_idx" ON "medical_lab_events"("orderId","createdAt")`,
  `CREATE INDEX IF NOT EXISTS "medical_lab_events_clinicId_createdAt_idx" ON "medical_lab_events"("clinicId","createdAt")`,
  `DO $$ BEGIN ALTER TABLE "medical_lab_events" ADD CONSTRAINT "medical_lab_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "medical_lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "medical_lab_events" ADD CONSTRAINT "medical_lab_events_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "medical_lab_events" ADD CONSTRAINT "medical_lab_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  "ALTER TABLE \"medical_lab_orders\" ADD COLUMN IF NOT EXISTS \"accessionRequired\" BOOLEAN NOT NULL DEFAULT false",
  "CREATE TABLE IF NOT EXISTS \"medical_lab_specimens\" (\"id\" TEXT NOT NULL,\"orderId\" TEXT NOT NULL,\"labId\" TEXT NOT NULL,\"accessionNumber\" TEXT NOT NULL,\"parentSpecimenId\" TEXT,\"specimenType\" TEXT NOT NULL,\"containerType\" TEXT,\"volume\" DECIMAL(12,3),\"volumeUnit\" TEXT,\"status\" TEXT NOT NULL DEFAULT 'collected',\"location\" TEXT,\"collectedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\"receivedAt\" TIMESTAMP(3),\"createdByUserId\" TEXT NOT NULL,\"receivedByUserId\" TEXT,\"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\"updatedAt\" TIMESTAMP(3) NOT NULL,CONSTRAINT \"medical_lab_specimens_pkey\" PRIMARY KEY (\"id\"))",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"medical_lab_specimens_accessionNumber_key\" ON \"medical_lab_specimens\"(\"accessionNumber\")",
  "CREATE INDEX IF NOT EXISTS \"medical_lab_specimens_orderId_createdAt_idx\" ON \"medical_lab_specimens\"(\"orderId\",\"createdAt\")",
  "CREATE INDEX IF NOT EXISTS \"medical_lab_specimens_labId_status_idx\" ON \"medical_lab_specimens\"(\"labId\",\"status\")",
  "CREATE INDEX IF NOT EXISTS \"medical_lab_specimens_parentSpecimenId_idx\" ON \"medical_lab_specimens\"(\"parentSpecimenId\")",
  "DO $ BEGIN ALTER TABLE \"medical_lab_specimens\" ADD CONSTRAINT \"medical_lab_specimens_orderId_fkey\" FOREIGN KEY (\"orderId\") REFERENCES \"medical_lab_orders\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $",
  "DO $ BEGIN ALTER TABLE \"medical_lab_specimens\" ADD CONSTRAINT \"medical_lab_specimens_labId_fkey\" FOREIGN KEY (\"labId\") REFERENCES \"laboratories\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $",
  "DO $ BEGIN ALTER TABLE \"medical_lab_specimens\" ADD CONSTRAINT \"medical_lab_specimens_parentSpecimenId_fkey\" FOREIGN KEY (\"parentSpecimenId\") REFERENCES \"medical_lab_specimens\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $",
  "DO $ BEGIN ALTER TABLE \"medical_lab_specimens\" ADD CONSTRAINT \"medical_lab_specimens_createdByUserId_fkey\" FOREIGN KEY (\"createdByUserId\") REFERENCES \"users\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $",
  "DO $ BEGIN ALTER TABLE \"medical_lab_specimens\" ADD CONSTRAINT \"medical_lab_specimens_receivedByUserId_fkey\" FOREIGN KEY (\"receivedByUserId\") REFERENCES \"users\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $",
  "CREATE TABLE IF NOT EXISTS \"medical_lab_specimen_events\" (\"id\" TEXT NOT NULL,\"specimenId\" TEXT NOT NULL,\"orderId\" TEXT NOT NULL,\"labId\" TEXT NOT NULL,\"eventType\" TEXT NOT NULL,\"fromStatus\" TEXT,\"toStatus\" TEXT,\"location\" TEXT,\"note\" TEXT,\"actorUserId\" TEXT NOT NULL,\"metadata\" JSONB,\"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT \"medical_lab_specimen_events_pkey\" PRIMARY KEY (\"id\"))",
  "CREATE INDEX IF NOT EXISTS \"medical_lab_specimen_events_specimenId_createdAt_idx\" ON \"medical_lab_specimen_events\"(\"specimenId\",\"createdAt\")",
  "CREATE INDEX IF NOT EXISTS \"medical_lab_specimen_events_orderId_createdAt_idx\" ON \"medical_lab_specimen_events\"(\"orderId\",\"createdAt\")",
  "DO $ BEGIN ALTER TABLE \"medical_lab_specimen_events\" ADD CONSTRAINT \"medical_lab_specimen_events_specimenId_fkey\" FOREIGN KEY (\"specimenId\") REFERENCES \"medical_lab_specimens\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $",
  "DO $ BEGIN ALTER TABLE \"medical_lab_specimen_events\" ADD CONSTRAINT \"medical_lab_specimen_events_orderId_fkey\" FOREIGN KEY (\"orderId\") REFERENCES \"medical_lab_orders\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $",
  "DO $ BEGIN ALTER TABLE \"medical_lab_specimen_events\" ADD CONSTRAINT \"medical_lab_specimen_events_labId_fkey\" FOREIGN KEY (\"labId\") REFERENCES \"laboratories\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $",
  "DO $ BEGIN ALTER TABLE \"medical_lab_specimen_events\" ADD CONSTRAINT \"medical_lab_specimen_events_actorUserId_fkey\" FOREIGN KEY (\"actorUserId\") REFERENCES \"users\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $",
];

try {
  // Idempotent DDL is executed statement-by-statement. A single interactive
  // transaction exceeded Prisma's default 5s timeout on Neon during production
  // startup and caused P2028 even though the individual statements were safe.
  for (const sql of statements) await prisma.$executeRawUnsafe(sql);
  console.log('[DB] Medical laboratory lifecycle schema ready');
} catch (error) {
  console.error('[DB] Medical laboratory lifecycle schema failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
