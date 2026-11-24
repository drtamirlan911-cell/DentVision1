import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('clinic acceptance for partner dental-lab deliveries', () => {
  const clinicSource = readFileSync(
    resolve(process.cwd(), 'dentvision-backend/src/modules/lab/lab.routes.ts'),
    'utf8',
  );
  const partnerSource = readFileSync(
    resolve(process.cwd(), 'dentvision-backend/src/modules/lab/labPlatform.routes.ts'),
    'utf8',
  );

  it('requires active clinic, branch, delivered order and latest verified shipment evidence', () => {
    const start = clinicSource.indexOf("labRouter.post('/:id/acceptance'");
    const end = clinicSource.indexOf("labRouter.delete('/:id'", start);
    const route = clinicSource.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(route).toContain("requirePermission('lab.write')");
    expect(route).toContain('branchScopedLabOrder(req, clinicId)');
    expect(route).toContain('FOR UPDATE');
    expect(route).toContain('where: { id: orderId, clinicId, ...branchScope.where }');
    expect(route).toContain("existing.status !== 'delivered'");
    expect(route).toContain("latestShipment.status !== 'delivered'");
    expect(route).toContain('latestShipment.deliveredAt');
    expect(route).toContain('latestShipment.proofUrl');
    expect(route).toContain('latestShipment.recipientName');
    expect(route).toContain('latestShipment.laboratoryId !== meta.laboratoryId');
    expect(route).toContain("code: 'LAB_DELIVERY_EVIDENCE_REQUIRED'");
  });

  it('is idempotent per latest shipment and rejects unresolved remake decisions', () => {
    const start = clinicSource.indexOf("labRouter.post('/:id/acceptance'");
    const end = clinicSource.indexOf("labRouter.delete('/:id'", start);
    const route = clinicSource.slice(start, end);

    expect(route).toContain("meta.remakeRequest?.status === 'requested'");
    expect(route).toContain("meta.clinicAcceptance?.status === 'accepted'");
    expect(route).toContain('meta.clinicAcceptance.shipmentId === latestShipment.id');
    expect(route).toContain("code: 'LAB_REMAKE_DECISION_PENDING'");
    expect(route).toContain('idempotent: outcome.kind === \'idempotent\'');
    expect(clinicSource).toContain('clinicAcceptance: null');
  });

  it('records audit, immutable lifecycle evidence, notification and ecosystem event', () => {
    const start = clinicSource.indexOf("labRouter.post('/:id/acceptance'");
    const end = clinicSource.indexOf("labRouter.delete('/:id'", start);
    const route = clinicSource.slice(start, end);

    expect(route).toContain("action: 'LAB_ORDER_CLINIC_ACCEPTED'");
    expect(route).toContain('dental_lab_order_events');
    expect(route).toContain('Клиника подтвердила приём доставленной работы.');
    expect(route).toContain("type: 'lab.clinic.accepted'");
    expect(route).toContain("publish('labOrder.clinic_accepted'");
  });

  it('exposes acceptance feedback to production roles but not logistics projections', () => {
    expect(partnerSource).toContain('clinicAcceptance');
    expect(partnerSource).toContain('includeClinicAcceptanceNote: !logisticsOnly');
    expect(partnerSource).toContain('includeClinicAcceptanceNote: !isLabLogisticsRole(membership.role)');
    expect(partnerSource).toContain('options.includeClinicAcceptanceNote ? { note: meta.clinicAcceptance.note || null } : {}');
    expect(partnerSource).toContain('clinicAcceptance,');
  });
});
