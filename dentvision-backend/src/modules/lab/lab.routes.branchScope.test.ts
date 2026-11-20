import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('dental lab branch isolation contract', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'dentvision-backend/src/modules/lab/lab.routes.ts'),
    'utf8',
  );

  it('derives lab order visibility from canonical clinic branch membership', () => {
    expect(source).toContain("from '../../lib/clinicBranchAccess.js'");
    expect(source).toContain('resolveClinicBranchAccess({');
    expect(source).toContain('organizationId: req.user?.organizationId');
    expect(source).toContain('requestedBranchId: req.user?.branchId');
    expect(source).not.toContain('req.user?.branchIds ?? []');
  });

  it('narrows lab orders to the active selected branch', () => {
    expect(source).toContain('const branchIds = access.branchId ? [access.branchId] : access.allowedBranchIds');
    expect(source).toContain('{ patient: { branchId: { in: branchIds } } }');
    expect(source).toContain("branchId: '__NO_BRANCH_ACCESS__'");
    expect(source).toContain("if (!access)");
  });

  it('rejects lab writes when the caller has no verified branch scope', () => {
    expect(source).toContain('if (!branchScope.configured)');
    expect(source).toContain('const branchIds = branchScope.branchIds');
    expect(source).toContain('prepareLabOrderWrite(clinicId, { ...writeBody, status: existing.status }, existingMeta, branchIds)');
    expect(source).toContain('prepareLabOrderWrite(clinicId, writeBody, {}, branchIds)');
  });

  it('scopes list, transactional upsert, status and delete operations', () => {
    expect(source).toContain('where: { clinicId, ...branchScope.where }');
    const upsertStart = source.indexOf("labRouter.post('/',");
    const statusStart = source.indexOf("labRouter.patch('/:id/status'", upsertStart);
    const upsert = source.slice(upsertStart, statusStart);
    expect(upsert).toContain('FOR UPDATE');
    expect(upsert).toContain('tx.labOrder.findFirst({ where: { id, clinicId, ...branchScope.where } })');
    expect(upsert.indexOf('FOR UPDATE')).toBeLessThan(upsert.indexOf('tx.labOrder.findFirst'));
    expect(upsert).toContain("if (existingMeta.laboratoryId) return { kind: 'partner_owned' as const }");

    const statusEnd = source.indexOf("labRouter.delete('/:id'", statusStart);
    const status = source.slice(statusStart, statusEnd);
    expect(status).toContain('FOR UPDATE');
    expect(status).toContain('...branchScope.where');

    const deletedOrder = source.slice(statusEnd);
    expect(deletedOrder).toContain('FOR UPDATE');
    expect(deletedOrder).toContain('...branchScope.where');
    expect(deletedOrder).toContain("if (meta.laboratoryId) return 'partner_owned' as const");
  });

  it('rejects patient writes outside the selected branch', () => {
    expect(source).toContain("Пациент недоступен в текущем филиале");
    expect(source).toContain("branchId: branchIds.length > 0 ? { in: branchIds } : '__NO_BRANCH_ACCESS__'");
  });

  it('retains only the explicit SUPERADMIN bypass', () => {
    expect(source).toContain("String(req.user?.role || '').toUpperCase() === 'SUPERADMIN'");
    expect(source).not.toContain("['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role)");
  });
});
