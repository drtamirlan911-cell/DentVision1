import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const schema = read('dentvision-backend/prisma/schema.prisma');
const migration = read('dentvision-backend/prisma/migrations/20261121240000_dental_lab_partner_invoices/migration.sql');
const partnerRoutes = read('dentvision-backend/src/modules/lab/labPlatform.routes.ts');
const clinicRoutes = read('dentvision-backend/src/modules/lab/lab.routes.ts');
const payments = read('dentvision-backend/src/modules/payments/payments.routes.ts');
const refunds = read('dentvision-backend/src/modules/payments/refund.service.ts');
const labUi = read('src/pages/diagnostics/DentalLabPlatform.tsx');
const clinicUi = read('src/pages/crm/Lab.tsx');
const acceptance = read('dentvision-backend/src/modules/lab/dentalLabAcceptance.ts');

describe('Dental Lab partner invoice lifecycle', () => {
  it('persists a separate invoice with one immutable issued amount per partner case', () => {
    expect(schema).toContain('model DentalLabInvoice');
    expect(schema).toContain('labOrderId         String   @unique');
    expect(schema).toContain('amountMinor        BigInt');
    expect(schema).toContain('serviceNameSnapshot String');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "dental_lab_invoices"');
    expect(migration).toContain('"labOrderId" TEXT NOT NULL');
    expect(migration).toContain('"amountMinor" BIGINT NOT NULL');
    expect(migration).toContain('dental_lab_invoices_labOrderId_key');
  });

  it('allows only the active laboratory finance role to issue an invoice after delivery and clinic acceptance', () => {
    const start = partnerRoutes.indexOf("labPlatformRouter.post('/orders/:id/invoice'");
    const end = partnerRoutes.indexOf("labPlatformRouter.get('/team'", start);
    const route = partnerRoutes.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(route).toContain('resolveLab(req)');
    expect(route).toContain('canLabManageFinance(membership.role)');
    expect(route).toContain('FOR UPDATE');
    expect(route).toContain("order.status !== 'delivered'");
    expect(route).toContain('dentalLabShipments: {');
    expect(route).toContain('hasAcceptedLatestDentalLabDelivery(meta.clinicAcceptance, latestShipment, membership.labId)');
    expect(route).toContain("kind: 'clinic_acceptance_required'");
    expect(route).toContain("code: 'LAB_CLINIC_ACCEPTANCE_REQUIRED'");
    expect(route).toContain('order.servicePriceSnapshot');
    expect(acceptance).toContain("acceptance.status !== 'accepted'");
    expect(acceptance).toContain('latestShipment.id !== acceptance.shipmentId');
    expect(route).toContain('if (order.dentalLabInvoice) return { kind:');
    expect(route).toContain("status: 'issued'");
    expect(route).toContain('DENTAL_LAB_INVOICE_ISSUED');
    expect(route).toContain("type: 'lab.invoice.issued'");
  });

  it('exposes the same invoice snapshot to the clinic and laboratory order views', () => {
    expect(clinicRoutes).toContain('include: { dentalLabInvoice: true }');
    expect(clinicRoutes).toContain('invoice: order.dentalLabInvoice ?');
    expect(partnerRoutes).toContain('dentalLabInvoice: true');
    expect(partnerRoutes).toContain('invoice: order.dentalLabInvoice ?');
    expect(partnerRoutes).toContain('invoice: null');
    expect(labUi).toContain('issueLabPlatformInvoice(id)');
    expect(labUi).toContain('Выставить счёт клинике');
    expect(labUi).toContain('clinicAcceptedCurrentShipment');
    expect(labUi).toContain('order.clinicAcceptance.shipmentId === shipment?.id');
    expect(clinicUi).toContain('Счёт {labInvoice.invoiceNumber}');
    expect(clinicUi).toContain("clinicAcceptance?.status === 'accepted'");
    expect(clinicUi).toContain("clinicAcceptance?.status !== 'accepted'");
    expect(clinicUi).toContain("labInvoice?.status === 'issued'");
    expect(clinicUi).toContain('invoiceId: invoice.id');
  });

  it('rejects payment without the matching issued invoice and exact minor-unit amount', () => {
    const start = payments.indexOf("if (refType === 'dental_lab_order')");
    const end = payments.indexOf("if (refType === 'medical_lab_order'", start);
    const create = payments.slice(start, end);
    expect(create).toContain('dentalLabInvoiceId = String(req.body?.invoiceId');
    expect(create).toContain("labOrder.invoice.status !== 'issued'");
    expect(create).toContain('labOrder.invoice.amountMinor !== dentalLabExpectedAmountMinor');
    expect(create).toContain("idempotencyKey = `dental-lab-invoice:");
    const settlement = payments.slice(payments.indexOf('async function settleDentalLabOrderPayment'), payments.indexOf('async function settleMedicalLabOrderPayment'));
    expect(settlement).toContain("paymentMeta.invoiceId");
    expect(settlement).toContain('hasAcceptedLatestDentalLabDelivery(order.clinicAcceptance, order.latestShipment, order.laboratoryId)');
    expect(create).toContain('hasAcceptedLatestDentalLabDelivery(labOrder.clinicAcceptance, labOrder.latestShipment, labOrder.laboratoryId)');
    expect(payments).toContain('hasAcceptedLatestDentalLabDelivery(\n            currentOrder.clinicAcceptance,\n            currentOrder.latestShipment,\n            currentOrder.laboratoryId,\n          )');
    expect(payments).toContain('FOR UPDATE');
    expect(create).toContain("code: 'DENTAL_LAB_CLINIC_ACCEPTANCE_REQUIRED'");
    expect(settlement).toContain("status: 'paid', paymentId: payment.id, paidAt: new Date()");
    expect(settlement).toContain('recordPartnerEconomics');
  });

  it('updates the same invoice on full and partial payment refunds', () => {
    expect(refunds).toContain("payment.refType === 'dental_lab_order'");
    expect(refunds).toContain('tx.dentalLabInvoice.findUnique');
    expect(refunds).toContain('invoice.refundedMinor + requested');
    expect(refunds).toContain("refundedMinor === invoice.amountMinor ? 'refunded' : 'partially_refunded'");
  });
});
