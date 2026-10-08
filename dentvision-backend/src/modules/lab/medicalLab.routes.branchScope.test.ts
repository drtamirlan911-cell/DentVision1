import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('medical lab branch isolation contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/lab/medicalLab.routes.ts'), 'utf8');

  it('checks branch membership for clinic medical-lab orders', () => {
    expect(source).toContain('user?.branchIds ?? []');
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


  it('uses the canonical Clinic.id → Organization.id resolver for clinic-scoped access', () => {
    expect(source).toContain("import { assertClinicOrgAccess } from '../../lib/orgContext.js';");
    expect(source).toContain('assertClinicOrgAccess(user!, order.clinicId)');
    expect(source).toContain('assertClinicOrgAccess(req.user!, clinicId)');
    expect(source).not.toContain('assertOrgAccess(user!, order.clinicId)');
    expect(source).not.toContain('assertOrgAccess(req.user!, clinicId)');
  });

  it('resolves laboratory scope from the original organization entity id', () => {
    expect(source).toContain('organizationOriginalId ||');
  });
});
