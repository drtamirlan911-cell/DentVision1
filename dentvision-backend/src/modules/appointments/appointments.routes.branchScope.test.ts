import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('appointment branch isolation contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/appointments/appointments.routes.ts'), 'utf8');

  it('resolves branch access from the canonical clinic IAM helper', () => {
    expect(source).toContain("from '../../lib/clinicBranchAccess.js'");
    expect(source).toContain('resolveClinicBranchAccess({');
    expect(source).toContain('requestedBranchId: req.user?.branchId');
    expect(source).toContain("__NO_BRANCH_ACCESS__");
    expect(source).not.toContain("req.user?.branchIds ?? []");
  });

  it('keeps organization-wide access only when no branch is selected', () => {
    expect(source).toContain("if (access.roleScope === 'ORGANIZATION' && !access.branchId) return {};");
    expect(source).toContain("if (access.branchId) return { branchId: access.branchId };");
    expect(source).toContain("if (role === 'SUPERADMIN') return {};");
  });

  it('verifies the selected doctor has membership in the patient branch', () => {
    expect(source).toContain("role: 'DOCTOR'");
    expect(source).toContain('requestedBranchId: patient.branchId');
    expect(source).toContain('if (!doctorHasBranchAccess)');
    expect(source).toContain('Указанный врач не имеет доступа к филиалу пациента');
  });

  it('scopes appointment listing and conflict queries to the resolved branch', () => {
    expect(source).toContain("const where: Record<string, unknown> = { clinicId, ...(await branchScope(req, clinicId)) }");
    expect(source).toContain("where: { clinicId, ...(await branchScope(req, clinicId)), date:");
  });

  it('scopes create, update, close, status and cancel by the same verified branch', () => {
    expect(source).toContain("where: { id, clinicId, ...(await branchScope(req, clinicId)) }");
    expect(source).toContain("where: { id: req.params.id as string, clinicId, ...(await branchScope(req, clinicId)) }");
    expect(source).toContain("clinicId, ...(await branchScope(req, clinicId)), status:");
    expect(source).toContain("branchId }, include: { patient");
  });

  it('does not allow a scoped user to create from a patient outside the active branch', () => {
    expect(source).toContain("where: { id: patientId, clinicId, ...(await branchScope(req, clinicId)) }");
  });

  it('applies branch scope to every appointment read and mutation callsite', () => {
    expect(source.match(/await branchScope\(req, clinicId\)/g)?.length).toBe(9);
    expect(source).not.toContain('...branchScope(req)');
  });
});
