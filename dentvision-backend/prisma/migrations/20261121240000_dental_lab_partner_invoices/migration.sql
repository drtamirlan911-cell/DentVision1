CREATE TABLE IF NOT EXISTS "dental_lab_invoices" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "labOrderId" TEXT NOT NULL,
  "laboratoryId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "branchId" TEXT,
  "serviceId" TEXT NOT NULL,
  "serviceNameSnapshot" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "refundedMinor" BIGINT NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'KZT',
  "status" TEXT NOT NULL DEFAULT 'issued',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "paymentId" TEXT,
  "issuedByUserId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dental_lab_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "dental_lab_invoices_labOrderId_fkey"
    FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_invoices_invoiceNumber_key"
  ON "dental_lab_invoices"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_invoices_labOrderId_key"
  ON "dental_lab_invoices"("labOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "dental_lab_invoices_paymentId_key"
  ON "dental_lab_invoices"("paymentId");
CREATE INDEX IF NOT EXISTS "dental_lab_invoices_laboratoryId_status_issuedAt_idx"
  ON "dental_lab_invoices"("laboratoryId", "status", "issuedAt");
CREATE INDEX IF NOT EXISTS "dental_lab_invoices_clinicId_branchId_status_idx"
  ON "dental_lab_invoices"("clinicId", "branchId", "status");
