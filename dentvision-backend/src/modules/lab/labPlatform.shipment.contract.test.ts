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
