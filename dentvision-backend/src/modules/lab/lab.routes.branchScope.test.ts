import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('dental lab branch isolation contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/lab/lab.routes.ts'), 'utf8');

  it('derives order visibility from authenticated branch memberships', () => {
    expect(source).toContain("from '../../lib/clinicBranchAccess.js'");
    expect(source).toContain('await resolveClinicBranchAccess({');
    expect(source).toContain('organizationId: req.user?.organizationId');
    expect(source).toContain('requestedBranchId: req.user?.branchId');
    expect(source).toContain('const organizationWide = access.roleScope === \'ORGANIZATION\' && access.branchId === null');
    expect(source).toContain('const branchIds = access.branchId ? [access.branchId] : access.allowedBranchIds');
    expect(source).toContain('branchIds: organizationWide ? null : branchIds');
    expect(source).toContain('branchId: { in: branchIds }');
    expect(source).toContain('const selectedBranchId = access.branchId');
    expect(source).toContain('branchId: order.branchId ?? null');
    expect(source).toContain('prepareLabOrderWrite(clinicId, writeBody, {}, branchIds, branchScope.selectedBranchId)');
    expect(source).toContain('prepareLabOrderWrite(clinicId, writeBody, {}, branchIds, branchScope.selectedBranchId)');
    expect(source).toContain('__NO_BRANCH_ACCESS__');
    expect(source).toContain("if (String(req.user?.role || '').toUpperCase() === 'SUPERADMIN')");
    expect(source).toContain('configured: true');
    expect(source).not.toContain("['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role)");
  });

  it('scopes list, transactional upsert, status and delete operations', () => {
    expect(source).toContain('where: { clinicId, ...branchScope.where }');
    const upsertStart = source.indexOf("labRouter.post('/',");
    const statusStart = source.indexOf("labRouter.patch('/:id/status'", upsertStart);
    const upsert = source.slice(upsertStart, statusStart);
    expect(upsert).toContain('FOR UPDATE');
    expect(upsert).toContain('tx.labOrder.findFirst({ where: { id, clinicId, ...branchScope.where } })');
    expect(upsert).toContain('branchScope.selectedBranchId');
    expect(upsert).toContain('{ patientId: existing.patientId, branchId: existing.branchId }');
    expect(upsert.indexOf('FOR UPDATE')).toBeLessThan(upsert.indexOf('tx.labOrder.findFirst'));
    expect(upsert).toContain("if (existingMeta.laboratoryId) return { kind: 'partner_owned' as const }");

    const statusEnd = source.indexOf("labRouter.delete('/:id'", statusStart);
    const status = source.slice(statusStart, statusEnd);
    expect(status).toContain('FOR UPDATE');
    expect(status).toContain('...branchScope.where');

    const deleteStart = statusEnd;
    const deletedOrder = source.slice(deleteStart);
    expect(deletedOrder).toContain('FOR UPDATE');
    expect(deletedOrder).toContain('...branchScope.where');
    expect(deletedOrder).toContain("if (meta.laboratoryId) return 'partner_owned' as const");
  });

  it('rejects patient writes outside assigned branches', () => {
    expect(source).toContain("Пациент недоступен в текущем филиале");
  });
});


describe('dental lab branch access must fail closed', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/lab/lab.routes.ts'), 'utf8');

  it('derives access only from the authenticated canonical clinic membership', () => {
    expect(source).toContain("from '../../lib/clinicBranchAccess.js'");
    expect(source).toContain('await resolveClinicBranchAccess({');
    expect(source).toContain('organizationId: req.user?.organizationId');
    expect(source).toContain('requestedBranchId: req.user?.branchId');
    expect(source).not.toContain('req.user?.branchIds ?? []');
    expect(source).toContain('const branchIds = access.branchId ? [access.branchId] : access.allowedBranchIds');
    expect(source).toContain('configured: organizationWide || branchIds.length > 0');
  });

  it('uses the direct LabOrder branch as the visibility boundary, including patientless orders', () => {
    expect(source).toContain('branchId: { in: branchIds }');
    expect(source).not.toContain('patient: { branchId: { in: branchIds } }');
    expect(source).toContain('const branchId = patientBranchId || selectedBranchId || existingOrder?.branchId || null');
    expect(source).toContain('branchId: { in: branchIds }');
  });

  it('requires a verified scope before every clinic-owned lab mutation', () => {
    const routeSections = [
      source.slice(source.indexOf("labRouter.post('/',"), source.indexOf("labRouter.patch('/:id/status'")),
      source.slice(source.indexOf("labRouter.patch('/:id/status'"), source.indexOf("labRouter.post('/:id/remake-request'")),
      source.slice(source.indexOf("labRouter.post('/:id/remake-request'"), source.indexOf("labRouter.post('/:id/acceptance'")),
      source.slice(source.indexOf("labRouter.post('/:id/acceptance'"), source.indexOf("labRouter.delete('/:id'")),
      source.slice(source.indexOf("labRouter.delete('/:id'")),
    ];
    for (const section of routeSections) {
      expect(section).toContain('if (!branchScope.configured)');
    }
  });

  it('keeps the explicit SUPERADMIN bypass and fails closed for missing access', () => {
    expect(source).toContain("if (String(req.user?.role || '').toUpperCase() === 'SUPERADMIN')");
    expect(source).toContain("configured: false");
    expect(source).toContain("branchId: '__NO_BRANCH_ACCESS__'");
    expect(source).not.toContain("['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role)");
  });
});

describe('clinic-authorized dental-lab remake request boundary', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/lab/lab.routes.ts'), 'utf8');
  it('requires a clinic lab-write permission, delivered partner-owned order, branch scope and row lock', () => {
    const start = source.indexOf("labRouter.post('/:id/remake-request'");
    const end = source.indexOf("labRouter.delete('/:id'", start);
    const route = source.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(route).toContain("requirePermission('lab.write')");
    expect(route).toContain('validateLabRemakeRequestReason');
    expect(route).toContain('FOR UPDATE');
    expect(route).toContain('...branchScope.where');
    expect(route).toContain('existingMeta.laboratoryId');
    expect(route).toContain("existing.status !== 'delivered'");
    expect(route).toContain("existingMeta.remakeRequest?.status === 'requested'");
    expect(route).toContain('LAB_ORDER_REMAKE_REQUESTED');
    expect(route).toContain('createNotificationForMany');
    expect(route).toContain("type: 'lab.remake.requested'");
  });
});


describe('clinic remake request and partner payment coordination', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/lab/lab.routes.ts'), 'utf8');
  it('does not open a remake dispute while an external payment remains pending', () => {
    const start = source.indexOf("labRouter.post('/:id/remake-request'");
    const end = source.indexOf("labRouter.delete('/:id'", start);
    const route = source.slice(start, end);
    expect(route).toContain("tx.payment.findFirst({");
    expect(route).toContain("refType: 'dental_lab_order', refId: existing.id, status: 'pending'");
    expect(route).toContain("return { kind: 'payment_pending' as const }");
    expect(route).toContain("code: 'DENTAL_LAB_PAYMENT_PENDING'");
  });
});