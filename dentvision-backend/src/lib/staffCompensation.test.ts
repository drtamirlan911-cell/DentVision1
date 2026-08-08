import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveOrganizationIdForClinic, personFindFirst, compensationFindUnique,
  compensationUpsert, clinicMemberFindUnique,
} = vi.hoisted(() => ({
  resolveOrganizationIdForClinic: vi.fn(),
  personFindFirst: vi.fn(),
  compensationFindUnique: vi.fn(),
  compensationUpsert: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
}));

vi.mock('./orgContext.js', () => ({ resolveOrganizationIdForClinic }));
vi.mock('./prisma.js', () => ({
  default: {
    person: { findFirst: personFindFirst },
    personCompensation: { findUnique: compensationFindUnique, upsert: compensationUpsert },
    clinicMember: { findUnique: clinicMemberFindUnique },
  },
}));

import { resolveStaffCompensation, upsertStaffCompensation } from './staffCompensation.js';

const USER_ID = 'user-1';
const CLINIC_ID = 'clinic-1';

beforeEach(() => {
  resolveOrganizationIdForClinic.mockReset().mockResolvedValue('org-1');
  personFindFirst.mockReset().mockResolvedValue(null);
  compensationFindUnique.mockReset().mockResolvedValue(null);
  compensationUpsert.mockReset();
  clinicMemberFindUnique.mockReset().mockResolvedValue(null);
});

describe('resolveStaffCompensation', () => {
  it('gives Person-only staff their own configuration', async () => {
    // The whole point: this member has no ClinicMember row, so the old code
    // could not pay them at all.
    personFindFirst.mockResolvedValueOnce({ id: 'person-1' });
    compensationFindUnique.mockResolvedValueOnce({
      commissionPercent: 45, baseSalary: 120000, payType: 'mixed',
    });

    const result = await resolveStaffCompensation(USER_ID, CLINIC_ID);

    expect(result).toEqual({
      commissionPercent: 45, baseSalary: 120000, payType: 'mixed', source: 'person',
    });
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
  });

  it('falls back to the legacy row, unchanged', async () => {
    clinicMemberFindUnique.mockResolvedValueOnce({
      commissionPercent: 30, baseSalary: 0, payType: 'commission',
    });

    const result = await resolveStaffCompensation(USER_ID, CLINIC_ID);

    expect(result).toEqual({
      commissionPercent: 30, baseSalary: 0, payType: 'commission', source: 'clinicMember',
    });
  });

  it('falls back when a Person exists but has no compensation yet', async () => {
    personFindFirst.mockResolvedValueOnce({ id: 'person-1' });
    clinicMemberFindUnique.mockResolvedValueOnce({
      commissionPercent: 40, baseSalary: 0, payType: 'commission',
    });

    const result = await resolveStaffCompensation(USER_ID, CLINIC_ID);

    expect(result.commissionPercent).toBe(40);
    expect(result.source).toBe('clinicMember');
  });

  it('returns defaults rather than throwing when neither store has anything', async () => {
    const result = await resolveStaffCompensation(USER_ID, CLINIC_ID);

    expect(result).toEqual({
      commissionPercent: 30, baseSalary: 0, payType: 'commission', source: 'default',
    });
  });

  it('still answers when the clinic has no Organization row', async () => {
    resolveOrganizationIdForClinic.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({
      commissionPercent: 50, baseSalary: 0, payType: 'commission',
    });

    const result = await resolveStaffCompensation(USER_ID, CLINIC_ID);

    expect(result.commissionPercent).toBe(50);
    expect(personFindFirst).not.toHaveBeenCalled();
  });
});

describe('upsertStaffCompensation', () => {
  it('writes against the Person for this clinic, not just any Person of the user', async () => {
    // A user can hold a Person per organization; paying them in clinic A must
    // not overwrite their configuration in clinic B.
    personFindFirst.mockResolvedValueOnce({ id: 'person-clinic-1' });

    await upsertStaffCompensation(USER_ID, CLINIC_ID, { commissionPercent: 55 });

    expect(personFindFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, organizationId: 'org-1' },
      select: { id: true },
    });
    expect(compensationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { personId: 'person-clinic-1' } }),
    );
  });

  it('fills the untouched fields with defaults when creating', async () => {
    personFindFirst.mockResolvedValueOnce({ id: 'person-1' });

    await upsertStaffCompensation(USER_ID, CLINIC_ID, { payType: 'salary' });

    expect(compensationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { personId: 'person-1', commissionPercent: 30, baseSalary: 0, payType: 'salary' },
        update: { payType: 'salary' },
      }),
    );
  });

  it('is a no-op when the Person does not exist yet', async () => {
    await upsertStaffCompensation(USER_ID, CLINIC_ID, { baseSalary: 1 });

    expect(compensationUpsert).not.toHaveBeenCalled();
  });
});
