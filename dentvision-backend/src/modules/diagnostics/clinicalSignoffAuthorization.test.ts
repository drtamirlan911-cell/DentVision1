import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  organizationFindFirst,
  personFindFirst,
  clinicMemberFindUnique,
  canAccessReferralBranch,
} = vi.hoisted(() => ({
  organizationFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
  canAccessReferralBranch: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    organization: { findFirst: organizationFindFirst },
    person: { findFirst: personFindFirst },
    clinicMember: { findUnique: clinicMemberFindUnique },
  },
}));
vi.mock('../../lib/diagnosticReferralBranchPolicy.js', () => ({ canAccessReferralBranch }));

import { assertClinicDoctorSignoff, ClinicalSignoffAuthorizationError } from './clinicalSignoffAuthorization.js';

beforeEach(() => {
  vi.clearAllMocks();
  organizationFindFirst.mockResolvedValue({ id: 'org-1', archivedAt: null });
  personFindFirst.mockResolvedValue({ id: 'person-1' });
  clinicMemberFindUnique.mockResolvedValue(null);
  canAccessReferralBranch.mockResolvedValue(true);
});

describe('clinical diagnostic sign-off authorization', () => {
  it('allows an assigned DOCTOR with active clinic and branch membership', async () => {
    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      branchId: 'branch-1',
      assignedDoctorId: 'doctor-1',
    })).resolves.toBeUndefined();

    expect(personFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'doctor-1',
        organizationId: 'org-1',
        personRoles: {
          some: {
            scopeType: 'organization',
            scopeId: 'org-1',
            role: { key: 'doctor' },
          },
        },
      },
      select: { id: true },
    });
    expect(canAccessReferralBranch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doctor-1', role: 'DOCTOR', clinicId: 'clinic-1' }),
      { clinicId: 'clinic-1', branchId: 'branch-1' },
    );
  });

  it('preserves the Master Spec OWNER + DOCTOR multi-role capability', async () => {
    // The persisted query deliberately asks whether the person has a scoped
    // doctor role, not which single role resolveClinicAccess ranks first.
    personFindFirst.mockResolvedValue({ id: 'owner-doctor-person' });

    await expect(assertClinicDoctorSignoff({
      userId: 'owner-doctor-1',
      clinicId: 'clinic-1',
      branchId: 'branch-1',
      assignedDoctorId: 'owner-doctor-1',
    })).resolves.toBeUndefined();

    expect(personFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        personRoles: expect.objectContaining({
          some: expect.objectContaining({
            role: { key: 'doctor' },
          }),
        }),
      }),
    }));
  });

  it.each(['OWNER', 'ADMIN', 'DIRECTOR', 'MANAGER', 'ASSISTANT', 'CASHIER', 'SUPERADMIN'])(
    'denies %s when no scoped DOCTOR role exists',
    async () => {
      personFindFirst.mockResolvedValue(null);

      await expect(assertClinicDoctorSignoff({
        userId: 'non-doctor-1',
        clinicId: 'clinic-1',
        branchId: 'branch-1',
      })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);

      expect(canAccessReferralBranch).not.toHaveBeenCalled();
    },
  );

  it('denies a platform SUPERADMIN without a clinical clinic assignment', async () => {
    personFindFirst.mockResolvedValue(null);
    clinicMemberFindUnique.mockResolvedValue(null);

    await expect(assertClinicDoctorSignoff({
      userId: 'platform-admin',
      clinicId: 'clinic-1',
      branchId: 'branch-1',
    })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);
  });

  it('denies an archived clinic even when a legacy DOCTOR membership remains', async () => {
    organizationFindFirst.mockResolvedValue({ id: 'org-1', archivedAt: new Date() });
    clinicMemberFindUnique.mockResolvedValue({ role: 'DOCTOR' });

    await expect(assertClinicDoctorSignoff({
      userId: 'former-doctor',
      clinicId: 'clinic-1',
      branchId: 'branch-1',
    })).rejects.toBeInstanceOf(ClinicalSignoffAuthorizationError);

    expect(personFindFirst).not.toHaveBeenCalled();
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
  });

  it('supports a legacy doctor only when the clinic has no canonical Organization', async () => {
    organizationFindFirst.mockResolvedValue(null);
    clinicMemberFindUnique.mockResolvedValue({ role: 'DOCTOR' });

    await expect(assertClinicDoctorSignoff({
      userId: 'legacy-doctor',
      clinicId: 'legacy-clinic',
      branchId: 'legacy-branch',
      assignedDoctorId: 'legacy-doctor',
    })).resolves.toBeUndefined();

    expect(personFindFirst).not.toHaveBeenCalled();
    expect(clinicMemberFindUnique).toHaveBeenCalledWith({
      where: { userId_clinicId: { userId: 'legacy-doctor', clinicId: 'legacy-clinic' } },
      select: { role: true },
    });
  });

  it('denies a doctor with no permission for the referral branch', async () => {
    canAccessReferralBranch.mockResolvedValue(false);

    await expect(assertClinicDoctorSignoff({
      userId: 'doctor-1',
      clinicId: 'clinic-1',
      branchId: 'foreign-branch',
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

    expect(organizationFindFirst).not.toHaveBeenCalled();
    expect(personFindFirst).not.toHaveBeenCalled();
    expect(canAccessReferralBranch).not.toHaveBeenCalled();
  });

  it('denies a caller whose clinic doctor role is missing or revoked', async () => {
    personFindFirst.mockResolvedValue(null);

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

    expect(organizationFindFirst).not.toHaveBeenCalled();
    expect(personFindFirst).not.toHaveBeenCalled();
    expect(canAccessReferralBranch).not.toHaveBeenCalled();
  });
});
