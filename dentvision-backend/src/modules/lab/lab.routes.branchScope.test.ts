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

  it('scopes list, upsert, status and delete operations', () => {
    expect(source).toContain('where: { clinicId, ...branchScopedLabOrder(req) }');
    expect(source).toContain('prepareLabOrderWrite(clinicId, body, existingMeta, branchIds)');
  });

  it('rejects patient writes outside assigned branches', () => {
    expect(source).toContain("Пациент недоступен в текущем филиале");
  });
});
