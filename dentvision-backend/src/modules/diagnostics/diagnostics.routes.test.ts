import { describe, expect, it } from 'vitest';
import { authorizeReferralListScope, resolveTrustedReferralBranchIds } from './diagnostics.routes.js';

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  role: 'LAB',
  organizationId: 'org-1',
  organizationOriginalId: 'lab-1',
  organizationType: 'LABORATORY',
  ...overrides,
}) as any;

describe('diagnostics referral scope authorization', () => {
  it('allows a laboratory user to read its own laboratory scope', async () => {
    await expect(authorizeReferralListScope(user(), { labId: 'lab-1' })).resolves.toEqual({ ok: true });
  });

  it('denies a laboratory user from another laboratory', async () => {
    await expect(authorizeReferralListScope(user(), { labId: 'lab-2' })).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Нет доступа к лаборатории',
    });
  });

  it('does not confuse Organization.id with the underlying laboratory id', async () => {
    await expect(authorizeReferralListScope(user(), { labId: 'org-1' })).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Нет доступа к лаборатории',
    });
  });

  it('allows a diagnostic-center user only for its original center id', async () => {
    const diagnosticUser = user({
      organizationId: 'org-center',
      organizationOriginalId: 'center-1',
      organizationType: 'DIAGNOSTIC_CENTER',
    });
    await expect(authorizeReferralListScope(diagnosticUser, { centerId: 'center-1' })).resolves.toEqual({ ok: true });
    await expect(authorizeReferralListScope(diagnosticUser, { centerId: 'center-2' })).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'Нет доступа к центру',
    });
  });

  it('keeps superadmin platform access explicit', async () => {
    await expect(authorizeReferralListScope(user({ role: 'SUPERADMIN', organizationId: undefined, organizationOriginalId: undefined, organizationType: undefined }), { labId: 'any-lab' })).resolves.toEqual({ ok: true });
  });
});

describe('diagnostics active branch allow-list', () => {
  it('uses canonical authenticated branch memberships without requiring a legacy ClinicMember row', () => {
    const clinicOwner = user({
      role: 'OWNER',
      organizationId: 'clinic-org-1',
      organizationOriginalId: 'clinic-1',
      organizationType: 'CLINIC',
      clinicId: 'clinic-1',
      branchId: 'branch-default',
      assignedBranchId: 'branch-default',
      branchIds: ['branch-default', 'branch-second'],
    });
    expect(resolveTrustedReferralBranchIds(clinicOwner, 'clinic-1')).toEqual([
      'branch-default',
      'branch-second',
    ]);
  });

  it('fails closed for a clinic context with no active assigned branches', () => {
    const clinicDoctor = user({
      role: 'DOCTOR',
      organizationId: 'clinic-org-1',
      organizationOriginalId: 'clinic-1',
      organizationType: 'CLINIC',
      clinicId: 'clinic-1',
      branchIds: [],
    });
    expect(resolveTrustedReferralBranchIds(clinicDoctor, 'clinic-1')).toEqual([]);
  });

  it('does not widen a clinic allow-list from role names', () => {
    const clinicAdmin = user({
      role: 'ADMIN',
      organizationId: 'clinic-org-1',
      organizationOriginalId: 'clinic-1',
      organizationType: 'CLINIC',
      clinicId: 'clinic-1',
      branchIds: ['branch-one'],
    });
    expect(resolveTrustedReferralBranchIds(clinicAdmin, 'clinic-1')).toEqual(['branch-one']);
  });

  it('keeps the explicit superadmin platform-wide branch behavior', () => {
    expect(resolveTrustedReferralBranchIds(user({ role: 'SUPERADMIN' }), 'clinic-1')).toBeUndefined();
  });
});
