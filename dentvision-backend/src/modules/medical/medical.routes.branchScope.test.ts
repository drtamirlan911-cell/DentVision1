import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('medical routes selected-branch authorization contract', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'dentvision-backend/src/modules/medical/medical.routes.ts'),
    'utf8',
  );

  it('derives the clinical branch context from canonical clinic IAM', () => {
    expect(source).toContain("from '../../lib/clinicBranchAccess.js'");
    expect(source).toContain('await resolveClinicBranchAccess({');
    expect(source).toContain('organizationId: user.organizationId');
    expect(source).toContain('requestedBranchId: user.branchId');
    expect(source).not.toContain('req.user?.branchIds ?? []');
  });

  it('grants organization-wide clinical reads only when no branch is selected', () => {
    expect(source).toContain("access.roleScope === 'ORGANIZATION' && access.branchId === null");
    expect(source).toContain('branchIds: access.branchId ? [access.branchId] : access.allowedBranchIds');
    expect(source).toContain('if (access?.organizationWide) return {};');
    expect(source).toContain("branchId: '__NO_BRANCH_ACCESS__'");
  });

  it('filters patient, visit and treatment-plan reads using the resolved branch', () => {
    expect(source).toContain('where: { id: patientId, clinicId, ...(await patientBranchScope(req)) }');
    expect(source).toContain('where: { patient: { clinicId, ...(await patientBranchScope(req)) } }');
    expect(source).toContain('const access = await resolveMedicalBranchContext(req);');
    expect(source).toContain('access.branchIds.includes(visit.patient?.branchId || \'\')');
    expect(source).toContain('access.branchIds.includes(plan.patient?.branchId || \'\')');
  });

  it('protects patient-image deletion with the same patient/branch gate', () => {
    const deleteStart = source.indexOf("medicalRouter.delete('/images/:id'");
    expect(deleteStart).toBeGreaterThanOrEqual(0);
    const route = source.slice(deleteStart);
    expect(route).toContain('await requirePatientAccess(req, res, image.patientId)');
    expect(route).not.toContain('image.patient?.clinicId && image.patient.clinicId !== req.user?.clinicId');
  });
});
