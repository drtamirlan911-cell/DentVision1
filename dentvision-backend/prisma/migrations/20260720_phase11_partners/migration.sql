-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'ACADEMY', 'LABORATORY', 'OFFICIAL_PARTNER');

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "tierId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "minKpiJson" JSONB,
    "benefitsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_kpis" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "metricsJson" JSONB,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_slas" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "actual" DOUBLE PRECISION,
    "breached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_slas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget" BIGINT NOT NULL DEFAULT 0,
    "splitBps" INTEGER NOT NULL DEFAULT 5000,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partners_type_status_idx" ON "partners"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "partner_tiers_name_key" ON "partner_tiers"("name");

-- CreateIndex
CREATE INDEX "partner_kpis_partnerId_period_idx" ON "partner_kpis"("partnerId", "period");

-- CreateIndex
CREATE INDEX "partner_slas_partnerId_idx" ON "partner_slas"("partnerId");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "partner_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_kpis" ADD CONSTRAINT "partner_kpis_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_slas" ADD CONSTRAINT "partner_slas_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

