import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('analytics branch isolation contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/analytics/analytics.routes.ts'), 'utf8');
  it('derives branch access from authenticated memberships', () => {
    expect(source).toContain('req.user?.branchIds ?? []');
    expect(source).toContain('__NO_BRANCH_ACCESS__');
  });
  it('scopes dashboard patients, appointments and operational lab data', () => {
    expect(source).toContain('prisma.patient.count({ where: { clinicId, ...branchScope(req) } })');
    expect(source).toContain('clinicId,\n          ...branchScope(req),\n          date:');
    expect(source).toContain('patient: { branchId: (branchScope(req) as any).branchId ?? undefined }');
  });
  it('scopes raw revenue and patient-growth queries', () => {
    expect(source).toContain('const branchIds = analyticsBranchIds(req);');
    expect(source).toContain('p."branchId" = ANY(${branchIds}::text[])');
    expect(source).toContain('AND "branchId" = ANY(${branchIds}::text[])');
  });
});