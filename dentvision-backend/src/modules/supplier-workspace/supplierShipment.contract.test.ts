import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = read('dentvision-backend/src/modules/supplier-workspace/workspace.routes.ts');
const schema = read('dentvision-backend/prisma/schema.prisma');
const migration = read('dentvision-backend/prisma/migrations/20261121200000_supplier_shipment_delivery_evidence/migration.sql');

describe('supplier shipment and proof-of-delivery contract', () => {
  it('stores seller-scoped shipments and durable event history', () => {
    expect(schema).toContain('model SupplierShipment');
    expect(schema).toContain('model SupplierShipmentEvent');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "supplier_shipments"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "supplier_shipment_events"');
    expect(migration).toContain('UNIQUE INDEX IF NOT EXISTS "supplier_shipments_supplierId_orderId_key"');
  });

  it('does not permit status-only shipping or delivery', () => {
    expect(routes).toContain('SUPPLIER_SHIPMENT_REQUIRED');
    expect(routes).toContain('SUPPLIER_DELIVERY_PROOF_REQUIRED');
    expect(routes).toContain("supplierWorkspaceRouter.post('/orders/:id/shipments'");
    expect(routes).toContain("supplierWorkspaceRouter.post('/orders/:id/delivery-confirmation'");
    expect(routes).not.toContain("const allowed = ['packing', 'shipped', 'delivered', 'cancelled']");
  });

  it('requires carrier, tracking number, HTTPS proof and recipient before delivery close-out', () => {
    expect(routes).toContain('trackingNumber');
    expect(routes).toContain('isSecureEvidenceUrl(proofUrl)');
    expect(routes).toContain('recipientName.length < 2');
    expect(routes).toContain('proofOfDeliveryUrl: proofUrl');
    expect(routes).toContain("eventType: 'DELIVERED'");
  });

  it('only finalizes a global order for its explicitly assigned supplier', () => {
    const delivery = routes.slice(routes.indexOf("supplierWorkspaceRouter.post('/orders/:id/delivery-confirmation'"));
    expect(delivery).toContain('locked[0].supplierId === supplierId');
    expect(delivery).toContain("status: 'delivered', deliveredAt: new Date()");
    expect(delivery).toContain('if (result.orderCompleted)');
    expect(delivery).toContain('releaseOrderCashback(orderId)');
    expect(delivery).toContain('restockFromOrder(orderId)');
  });
});
