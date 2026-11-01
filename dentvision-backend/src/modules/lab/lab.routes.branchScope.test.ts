import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('dental lab branch isolation contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/lab/lab.routes.ts'), 'utf8');

  it('derives order visibility from authenticated branch memberships', () => {
    expect(source).toContain('req.user?.branchIds ?? []');
    expect(source).toContain('patient: { branchId: { in: branchIds } }');
    expect(source).toContain('__NO_BRANCH_ACCESS__');
  });

  it('scopes list, transactional upsert, status and delete operations', () => {
    expect(source).toContain('where: { clinicId, ...branchScopedLabOrder(req) }');
    const upsertStart = source.indexOf("labRouter.post('/')");
    const statusStart = source.indexOf("labRouter.patch('/:id/status'", upsertStart);
    const upsert = source.slice(upsertStart, statusStart);
    expect(upsert).toContain('FOR UPDATE');
    expect(upsert).toContain('tx.labOrder.findFirst({ where: { id, clinicId, ...branchScopedLabOrder(req) } })');
    expect(upsert).toContain('prepareLabOrderWrite(clinicId, { ...writeBody, status: existing.status }, existingMeta, branchIds)');
    expect(upsert.indexOf('FOR UPDATE')).toBeLessThan(upsert.indexOf('tx.labOrder.findFirst'));
    expect(upsert).toContain("if (existingMeta.laboratoryId) return { kind: 'partner_owned' as const }");

    const statusEnd = source.indexOf("labRouter.delete('/:id'", statusStart);
    const status = source.slice(statusStart, statusEnd);
    expect(status).toContain('FOR UPDATE');
    expect(status).toContain('...branchScopedLabOrder(req)');

    const deleteStart = statusEnd;
    const delete = source.slice(deleteStart);
    expect(delete).toContain('FOR UPDATE');
    expect(delete).toContain('...branchScopedLabOrder(req)');
    expect(delete).toContain("if (meta.laboratoryId) return 'partner_owned' as const");
  });

  it('rejects patient writes outside assigned branches', () => {
    expect(source).toContain("Пациент недоступен в текущем филиале");
  });
});
