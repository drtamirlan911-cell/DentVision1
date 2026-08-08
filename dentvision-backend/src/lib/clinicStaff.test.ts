import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveOrganizationIdForClinic, clinicMemberFindMany, personFindMany } = vi.hoisted(() => ({
  resolveOrganizationIdForClinic: vi.fn(),
  clinicMemberFindMany: vi.fn(),
  personFindMany: vi.fn(),
}));

vi.mock('./orgContext.js', () => ({ resolveOrganizationIdForClinic }));
vi.mock('./prisma.js', () => ({
  default: {
    clinicMember: { findMany: clinicMemberFindMany },
    person: { findMany: personFindMany },
  },
}));

import { listClinicStaff } from './clinicStaff.js';

const CLINIC_ID = 'clinic-1';

const legacyMember = {
  userId: 'user-legacy',
  role: 'DOCTOR',
  user: { firstName: 'Legacy', lastName: 'Doctor' },
};

const unifiedPerson = {
  userId: 'user-unified',
  fullName: 'Unified Nurse',
  personRoles: [{ role: { key: 'nurse' } }],
};

beforeEach(() => {
  resolveOrganizationIdForClinic.mockReset().mockResolvedValue('org-1');
  clinicMemberFindMany.mockReset().mockResolvedValue([]);
  personFindMany.mockReset().mockResolvedValue([]);
});

describe('listClinicStaff', () => {
  it('includes staff that exist only in the unified model', async () => {
    // These were absent from the clinic payroll run entirely.
    clinicMemberFindMany.mockResolvedValueOnce([legacyMember]);
    personFindMany.mockResolvedValueOnce([unifiedPerson]);

    const staff = await listClinicStaff(CLINIC_ID);

    expect(staff.map((s) => s.userId)).toEqual(['user-legacy', 'user-unified']);
    expect(staff[1]).toEqual({
      userId: 'user-unified', name: 'Unified Nurse', role: 'ASSISTANT', source: 'person',
    });
  });

  it('counts a member present in both models once', async () => {
    clinicMemberFindMany.mockResolvedValueOnce([legacyMember]);
    personFindMany.mockResolvedValueOnce([
      { userId: 'user-legacy', fullName: 'Legacy Doctor', personRoles: [{ role: { key: 'owner' } }] },
    ]);

    const staff = await listClinicStaff(CLINIC_ID);

    expect(staff).toHaveLength(1);
    // The legacy row wins: that is the column staff CRUD still writes.
    expect(staff[0].role).toBe('DOCTOR');
    expect(staff[0].source).toBe('clinicMember');
  });

  it('maps unified role keys back to the legacy vocabulary', async () => {
    personFindMany.mockResolvedValueOnce([
      { userId: 'u1', fullName: 'A', personRoles: [{ role: { key: 'org_admin' } }] },
      { userId: 'u2', fullName: 'B', personRoles: [{ role: { key: 'cashier' } }] },
    ]);

    const staff = await listClinicStaff(CLINIC_ID);

    expect(staff.map((s) => s.role)).toEqual(['ADMIN', 'CASHIER']);
  });

  it('defaults an unmapped or missing role to DOCTOR', async () => {
    personFindMany.mockResolvedValueOnce([
      { userId: 'u1', fullName: 'A', personRoles: [] },
      { userId: 'u2', fullName: 'B', personRoles: [{ role: { key: 'something_new' } }] },
    ]);

    const staff = await listClinicStaff(CLINIC_ID);

    expect(staff.map((s) => s.role)).toEqual(['DOCTOR', 'DOCTOR']);
  });

  it('returns the legacy roster untouched when the clinic has no Organization row', async () => {
    resolveOrganizationIdForClinic.mockResolvedValueOnce(null);
    clinicMemberFindMany.mockResolvedValueOnce([legacyMember]);

    const staff = await listClinicStaff(CLINIC_ID);

    expect(staff).toHaveLength(1);
    expect(personFindMany).not.toHaveBeenCalled();
  });
});
