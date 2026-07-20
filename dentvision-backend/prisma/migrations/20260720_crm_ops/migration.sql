-- DentVision CRM competitive upgrade
-- Apply on Render Postgres (or run: npx prisma db push from dentvision-backend)

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "meta" JSONB;

CREATE TABLE IF NOT EXISTS "waiting_list" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "patientId" TEXT,
  "patientName" TEXT,
  "patientPhone" TEXT,
  "doctorId" TEXT,
  "doctorName" TEXT,
  "preferredDate" TIMESTAMP(3),
  "preferredTime" TEXT,
  "preferredService" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "waiting_list_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "category" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "notes" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotions" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "discountPercent" INTEGER DEFAULT 0,
  "serviceIds" JSONB,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "price_list" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "serviceCode" TEXT NOT NULL,
  "name" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "price_list_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "waiting_list_clinicId_status_idx" ON "waiting_list"("clinicId", "status");
CREATE INDEX IF NOT EXISTS "expenses_clinicId_date_idx" ON "expenses"("clinicId", "date");
CREATE INDEX IF NOT EXISTS "promotions_clinicId_idx" ON "promotions"("clinicId");
CREATE INDEX IF NOT EXISTS "price_list_clinicId_idx" ON "price_list"("clinicId");
CREATE UNIQUE INDEX IF NOT EXISTS "price_list_clinicId_serviceCode_key" ON "price_list"("clinicId", "serviceCode");

DO $$ BEGIN
  ALTER TABLE "waiting_list" ADD CONSTRAINT "waiting_list_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "promotions" ADD CONSTRAINT "promotions_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "price_list" ADD CONSTRAINT "price_list_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "reminder_logs" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "reminderKey" TEXT NOT NULL,
  "channel" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meta" JSONB,
  CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reminder_logs_clinicId_reminderKey_idx" ON "reminder_logs"("clinicId", "reminderKey");

DO $$ BEGIN
  ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
