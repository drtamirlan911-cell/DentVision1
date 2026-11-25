import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = read('dentvision-backend/src/modules/lab/labPlatform.routes.ts');
const authorization = read('dentvision-backend/src/modules/lab/labPlatform.authorization.ts');
const schema = read('dentvision-backend/prisma/schema.prisma');
const migration = read('dentvision-backend/prisma/migrations/20261121230000_dental_lab_shipment_proof/migration.sql');

describe('dental laboratory dispatch and proof-of-delivery contract', () => {
  it('persists one shipment per canonical lab order and an ordered event history', () => {
    expect(schema).toContain('model DentalLabShipment');
    expect(schema).toContain('model DentalLabShipmentEvent');
    expect(schema).toContain('dentalLabShipments DentalLabShipment[]');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "dental_lab_shipments"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "dental_lab_shipment_events"');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS "dental_lab_shipments_labOrderId_createdAt_idx"');
    expect(migration).toContain('dental_lab_shipment_events_shipmentId_createdAt_idx');
    expect(routes).not.toContain('include: { dentalLabShipment: true }');
    expect(routes).toContain("dentalLabShipments: { orderBy: { createdAt: 'desc' }, take: 1 }");
  });

  it('does not allow the generic status endpoint to bypass dispatch and recipient confirmation', () => {
    const start = routes.indexOf("labPlatformRouter.patch('/orders/:id/status'");
    const end = routes.indexOf("function isSecureLabEvidenceUrl", start);
    const statusRoute = routes.slice(start, end);
    expect(statusRoute).toContain("if (next === 'delivered') return { kind: 'shipment_required' as const }");
    expect(statusRoute).toContain("code: 'LAB_SHIPMENT_REQUIRED'");
    expect(statusRoute).toContain("if (!existing) return { kind: 'not_found' as const }");
    expect(routes).toContain("ready: [],");
  });

  it('limits dispatch and delivery confirmation to the matching laboratory and logistics/manager roles', () => {
    expect(authorization).toContain("const LAB_LOGISTICS_ROLES = new Set(['courier', 'logistics', 'delivery_operator', 'dispatcher'])");
    expect(authorization).toContain('export function canLabManageShipment');
    const dispatchStart = routes.indexOf("labPlatformRouter.post('/orders/:id/shipment'");
    const deliveryStart = routes.indexOf("labPlatformRouter.post('/orders/:id/shipment/delivery-confirmation'");
    const technicianStart = routes.indexOf("labPlatformRouter.patch('/orders/:id/technician'", deliveryStart);
    expect(dispatchStart).toBeGreaterThanOrEqual(0);
    const dispatch = routes.slice(dispatchStart, deliveryStart);
    const delivery = routes.slice(deliveryStart, technicianStart);
    expect(dispatch).toContain('tx.dentalLabShipment.findFirst');
    expect(delivery).toContain('tx.dentalLabShipment.findFirst');
    for (const route of [dispatch, delivery]) {
      expect(route).toContain('canLabManageShipment(membership.role)');
      expect(route).toContain("path: ['meta', 'laboratoryId'], equals: membership.labId");
      expect(route).toContain('FOR UPDATE');
    }
    expect(dispatch).toContain("method === 'COURIER' ? 'dispatched' : 'ready_for_pickup'");
    expect(delivery).toContain("status: 'delivered'");
    expect(delivery).toContain('isSecureLabEvidenceUrl(proofUrl)');
    expect(delivery).toContain('recipientName');
  });

  it('records audit, notifications and durable events without recognizing commission on delivery', () => {
    const dispatchStart = routes.indexOf("labPlatformRouter.post('/orders/:id/shipment'");
    const deliveryStart = routes.indexOf("labPlatformRouter.post('/orders/:id/shipment/delivery-confirmation'");
    const technicianStart = routes.indexOf("labPlatformRouter.patch('/orders/:id/technician'", deliveryStart);
    const delivery = routes.slice(deliveryStart, technicianStart);
    expect(delivery).toContain('tx.dentalLabShipmentEvent.create');
    expect(delivery).toContain('appendEventInTransaction');
    expect(delivery).toContain('DENTAL_LAB_DELIVERY_CONFIRMED');
    expect(delivery).toContain('createNotificationForClinic');
    expect(delivery).toContain('labOrder.delivery_confirmed');
    expect(delivery).not.toContain('recordPartnerEconomics(');
    expect(delivery).not.toContain('wallet.update(');
    const dispatch = routes.slice(dispatchStart, deliveryStart);
    expect(dispatch).toContain('DENTAL_LAB_SHIPMENT_CREATED');
    expect(dispatch).toContain('createNotificationForClinic');
    expect(dispatch).not.toContain('recordPartnerEconomics(');
  });
});


describe('Dental Lab production command surface', () => {
  const workspace = read('src/pages/diagnostics/DentalLabPlatform.tsx');
  const api = read('src/utils/labPlatformApi.ts');

  it('lets managers assign a technician from production and refreshes the canonical order queue', () => {
    expect(workspace).toContain("enabled: canManageQc && (effectiveTab === 'team' || ['board', 'priority'].includes(effectiveTab))");
    expect(workspace).toContain('assignLabTechnician');
    expect(workspace).toContain('canAssignTechnician={canManageQc}');
    expect(workspace).toContain('onAssignTechnician={(id, technicianId) => technicianMutation.mutate({ id, technicianId })}');
    expect(workspace).toContain("['technician', 'dental_technician', 'lab_technician', 'cad_designer', 'ceramist', 'orthodontic_technician']");
  });

  it('loads the canonical order and merges production and shipment events for authorized production roles only', () => {
    expect(api).toContain('export const getLabPlatformOrderLifecycle');
    expect(workspace).toContain('canViewDetails={canManageQc || canReadProduction}');
    expect(workspace).toContain('enabled: detailsOpen && canViewDetails');
    expect(workspace).toContain('lifecycleQuery.data.events.map');
    expect(workspace).toContain('lifecycleQuery.data.shipmentEvents.map');
    expect(workspace).toContain('Техническое задание клиники');
  });
});


describe('dental lab partner finance workspace contract', () => {
  const authz = read('dentvision-backend/src/modules/lab/labPlatform.authorization.ts');
  const financeRoutes = read('dentvision-backend/src/modules/lab/labPlatform.routes.ts');
  const sharedFinanceRoutes = read('dentvision-backend/src/modules/finance/finance.routes.ts');
  const payoutService = read('dentvision-backend/src/modules/finance/payout.service.ts');
  const workspace = read('src/pages/diagnostics/DentalLabPlatform.tsx');

  it('uses the canonical Laboratory id for partner wallets and scopes access to finance roles', () => {
    expect(authz).toContain("const LAB_FINANCE_ROLES = new Set(['lab_finance', 'finance', 'accountant'])");
    expect(authz).toContain('export function canLabManageFinance');
    expect(financeRoutes).toContain("labPlatformRouter.get('/finance'");
    expect(financeRoutes).toContain("labPlatformRouter.post('/payouts'");
    expect(financeRoutes).toContain("getOrCreateWallet('PARTNER', membership.labId)");
    expect(financeRoutes).toContain("vertical: 'DENTAL_LAB', partnerId: membership.labId");
    expect(sharedFinanceRoutes).toContain('organizationOriginalId || req.user?.organizationId');
  });

  it('keeps the finance-only role out of the production queue and payout notifications out of production/logistics roles', () => {
    expect(financeRoutes).toContain('!canLabMemberReadOrders(membership.role) && !canLabManageFinance(membership.role)');
    expect(financeRoutes).toContain("membershipRole: membership.role, totals: { all: 0, active: 0, dueSoon: 0, overdue: 0 }");
    expect(payoutService).toContain("role: { in: ['owner', 'admin', 'manager', 'director', 'lab_manager', 'lab_finance', 'finance', 'accountant'] }");
    expect(workspace).toContain("canManageFinance = canManageQc || ['lab_finance', 'finance', 'accountant']");
    expect(workspace).toContain("enabled: effectiveTab === 'finance' && canManageFinance");
  });

  it('limits delivery users to ready handoffs and removes patient and clinical fields from their queue projection', () => {
    const start = financeRoutes.indexOf('async function ordersForLab(');
    const end = financeRoutes.indexOf("labPlatformRouter.get('/available-laboratories'", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const queue = financeRoutes.slice(start, end);
    expect(queue).toContain("const logisticsStatuses = ['ready', 'delivered']");
    expect(queue).toContain("patientId: null");
    expect(queue).toContain("patientName: ''");
    expect(queue).toContain("notes: ''");
    expect(queue).toContain("servicePriceSnapshot: null");
    const catalogue = financeRoutes.slice(financeRoutes.indexOf("labPlatformRouter.get('/services'"), financeRoutes.indexOf("labPlatformRouter.post('/services'"));
    expect(catalogue).toContain('isLabLogisticsRole(membership.role)');
  });

  it('uses the shared payout reservation and ledger transition rather than adding commission on delivery', () => {
    expect(financeRoutes).toContain("prisma.$transaction(async (tx) =>");
    expect(financeRoutes).toContain("requestPayout({ ownerType: 'PARTNER', ownerId: membership.labId, amountMinor }, tx)");
    expect(financeRoutes).toContain("action: 'DENTAL_LAB_PAYOUT_REQUESTED'");
    expect(financeRoutes).toContain('}, tx);');
    expect(financeRoutes).toContain('availableBalanceMinor(wallet.id)');
    const deliveryStart = financeRoutes.indexOf("labPlatformRouter.post('/orders/:id/shipment/delivery-confirmation'");
    const technicianStart = financeRoutes.indexOf("labPlatformRouter.patch('/orders/:id/technician'", deliveryStart);
    expect(deliveryStart).toBeGreaterThanOrEqual(0);
    expect(technicianStart).toBeGreaterThan(deliveryStart);
    const delivery = financeRoutes.slice(deliveryStart, technicianStart);
    expect(delivery).not.toContain("getPartnerEconomicsTransparency");
    expect(delivery).not.toContain('requestPayout(');
  });

  it('shows paid settlement, partner net, commission and payout history in the financial workspace', () => {
    expect(workspace).toContain("label: 'Финансы'");
    expect(workspace).toContain('Доступно к выплате');
    expect(workspace).toContain('Комиссия DentVision');
    expect(workspace).toContain('Доля лаборатории');
    expect(workspace).toContain('Заявки на выплату');
  });
});
