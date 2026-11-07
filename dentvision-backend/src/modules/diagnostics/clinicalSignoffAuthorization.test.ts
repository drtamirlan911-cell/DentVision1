import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveClinicAccess } = vi.hoisted(() => ({ resolveClinicAccess: vi.fn() }));
vi.mock('../../lib/orgContext.js', () => ({ resolveClinicAccess }));

import { assertClinicDoctorSignoff, ClinicalSignoffAuthorizationError } from './clinicalSignoffAuthorization.js';

beforeEach(() => vi.clearAllMocks());

describe('clinical diagnostic sign-off authorization', () => {
  it('allows an active doctor in the clinic when assigned to the referral', async () => {
    resolveClinicAccess.mockResolvedValue({ role: 'DOCTOR' });

    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      assignedDoctorId: 'doctor-1',
    })).resolves.toBeUndefined();

    expect(resolveClinicAccess).toHaveBeenCalledWith('doctor-1', 'clinic-1');
  });

  it.each(['OWNER', 'ADMIN', 'DIRECTOR', 'MANAGER', 'ASSISTANT', 'CASHIER', 'SUPERADMIN'])(
    'denies persisted %s role',
    async (role) => {
      resolveClinicAccess.mockResolvedValue({ role });

      await expect(assertClinicDoctorSignoff({
        userId: 'user-1',
        clinicId: 'clinic-1',
      })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);
    },
  );

  it('denies a caller whose clinic role is missing or revoked', async () => {
    resolveClinicAccess.mockResolvedValue(null);

    await expect(assertClinicDoctorSignoff({
      userId: 'former-doctor',
      clinicId: 'clinic-1',
    })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);
  });

  it('denies signing when the referral is assigned to another doctor', async () => {
    resolveClinicAccess.mockResolvedValue({ role: 'DOCTOR' });

    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-2',
      clinicId: 'clinic-1',
      assignedDoctorId: 'doctor-1',
    })).rejects.toThrow('Подписать результат может только назначенный врач');

    expect(resolveClinicAccess).not.toHaveBeenCalled();
  });

  it('fails closed when the user or clinic context is missing', async () => {
    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-1',
      clinicId: null,
    })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);

    expect(resolveClinicAccess).not.toHaveBeenCalled();
  });
});
