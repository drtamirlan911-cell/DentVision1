import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveClinicAccess, canAccessReferralBranch } = vi.hoisted(() => ({
  resolveClinicAccess: vi.fn(),
  canAccessReferralBranch: vi.fn(),
}));
vi.mock('../../lib/orgContext.js', () => ({ resolveClinicAccess }));
vi.mock('../../lib/diagnosticReferralBranchPolicy.js', () => ({ canAccessReferralBranch }));

import { assertClinicDoctorSignoff, ClinicalSignoffAuthorizationError } from './clinicalSignoffAuthorization.js';

beforeEach(() => {
  vi.clearAllMocks();
  resolveClinicAccess.mockResolvedValue({ role: 'DOCTOR' });
  canAccessReferralBranch.mockResolvedValue(true);
});

describe('clinical diagnostic sign-off authorization', () => {
  it('allows an active doctor in the assigned clinic and branch', async () => {
    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      branchId: 'branch-1',
      assignedDoctorId: 'doctor-1',
    })).resolves.toBeUndefined();

    expect(resolveClinicAccess).toHaveBeenCalledWith('doctor-1', 'clinic-1');
    expect(canAccessReferralBranch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doctor-1', role: 'DOCTOR', clinicId: 'clinic-1' }),
      { clinicId: 'clinic-1', branchId: 'branch-1' },
    );
  });

  it.each(['OWNER', 'ADMIN', 'DIRECTOR', 'MANAGER', 'ASSISTANT', 'CASHIER', 'SUPERADMIN'])(
    'denies persisted %s role',
    async (role) => {
      resolveClinicAccess.mockResolvedValue({ role });

      await expect(assertClinicDoctorSignoff({
        userId: 'user-1',
        clinicId: 'clinic-1',
        branchId: 'branch-1',
      })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);

      expect(canAccessReferralBranch).not.toHaveBeenCalled();
    },
  );

  it('denies a doctor whose persisted membership has no access to the referral branch', async () => {
    canAccessReferralBranch.mockResolvedValue(false);

    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      branchId: 'branch-foreign',
      assignedDoctorId: 'doctor-1',
    })).rejects.toThrow('У врача нет доступа к филиалу направления');
  });

  it('denies a doctor assigned to a different clinician', async () => {
    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-2',
      clinicId: 'clinic-1',
      branchId: 'branch-1',
      assignedDoctorId: 'doctor-1',
    })).rejects.toThrow('Подписать результат может только назначенный врач');

    expect(resolveClinicAccess).not.toHaveBeenCalled();
    expect(canAccessReferralBranch).not.toHaveBeenCalled();
  });

  it('denies a caller whose clinic role is missing or revoked', async () => {
    resolveClinicAccess.mockResolvedValue(null);

    await expect(assertClinicDoctorSignoff({
      userId: 'former-doctor',
      clinicId: 'clinic-1',
      branchId: 'branch-1',
    })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);

    expect(canAccessReferralBranch).not.toHaveBeenCalled();
  });

  it('fails closed when the user, clinic or referral branch context is missing', async () => {
    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-1',
      clinicId: null,
      branchId: 'branch-1',
    })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);

    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      branchId: null,
    })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);

    expect(resolveClinicAccess).not.toHaveBeenCalled();
    expect(canAccessReferralBranch).not.toHaveBeenCalled();
  });
});
