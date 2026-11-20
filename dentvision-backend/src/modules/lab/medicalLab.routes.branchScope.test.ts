import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('medical lab branch isolation contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/lab/medicalLab.routes.ts'), 'utf8');

  it('checks branch membership for clinic medical-lab orders, including OWNER/ADMIN', () => {
    expect(source).toContain('user?.branchIds ?? []');
    expect(source).toContain("if (role !== 'SUPERADMIN')");
    expect(source).not.toContain("if (['OWNER', 'ADMIN'].includes(role)) return true");
    expect(source).toContain('o."clinicId" = $1');
    expect(source).not.toContain('o."clinicId" = ${args.length}');
    expect(source).toContain('o."labId" = $1');
    expect(source).not.toContain('o."labId" = ${args.length}');
    expect(source).toContain('branchId: { in: branchIds }');
    expect(source).toContain('p."branchId" = ANY(${args.length}::text[])');
  });

  it('keeps optional medical-lab order filters bound after the tenant scope parameter', () => {
    expect(source).toContain('o."patientId" = $${args.length}');
    expect(source).toContain('o."treatmentCaseId" = $${args.length}');
    expect(source).toContain('o."status" = $${args.length}');
  });

  it('blocks creation from patients outside the current branch set', () => {
    expect(source).toContain('__NO_BRANCH_ACCESS__');
  });


  it('requires the active clinic context and branch allow-list for clinic-originated order reads', () => {
    const start = source.indexOf('async function canAccessOrder');
    const end = source.indexOf('async function recordEvent', start);
    const policy = source.slice(start, end);
    expect(policy).toContain('order.clinicId !== user?.clinicId');
    expect(policy).toContain('user?.branchIds ?? []');
    expect(policy).toContain('branchIds.length === 0');
    expect(policy).not.toContain('assertClinicOrgAccess');
    expect(source).toContain("import { assertClinicOrgAccess } from '../../lib/orgContext.js';");
    expect(source).toContain('assertClinicOrgAccess(req.user!, clinicId)');
  });

  it('resolves laboratory scope from the original organization entity id', () => {
    expect(source).toContain('organizationOriginalId ||');
  });
});
