import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  userFindUnique, organizationFindFirst, personFindFirst, clinicMemberFindUnique, clinicMemberFindFirst,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  organizationFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
  clinicMemberFindFirst: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  default: {
    user: { findUnique: userFindUnique },
    organization: { findFirst: organizationFindFirst },
    person: { findFirst: personFindFirst },
    clinicMember: { findUnique: clinicMemberFindUnique, findFirst: clinicMemberFindFirst },
  },
}));

import { assertOrgAccess, resolveClinicAccess, resolveAnyClinicMembership } from './orgContext.js';

const CLINIC_ID = 'clinic-1';
const USER_ID = 'user-1';

beforeEach(() => {
  userFindUnique.mockReset();
  organizationFindFirst.mockReset();
  personFindFirst.mockReset();
  clinicMemberFindUnique.mockReset();
  clinicMemberFindFirst.mockReset();
});

describe('assertOrgAccess', () => {
  it('admits SUPERADMIN without any DB membership lookup', async () => {
    const result = await assertOrgAccess({ id: USER_ID, role: 'SUPERADMIN' } as any, CLINIC_ID);
    expect(result).toBe(true);
    expect(personFindFirst).not.toHaveBeenCalled();
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
  });

  it('admits a Person-only member (no ClinicMember row)', async () => {
    personFindFirst.mockResolvedValueOnce({ id: 'person-1' });
    const result = await assertOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, CLINIC_ID);
    expect(result).toBe(true);
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
  });

  it('falls back to legacy ClinicMember when no Person row exists', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ id: 'member-1' });
    const result = await assertOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, CLINIC_ID);
    expect(result).toBe(true);
  });

  it('rejects a user with neither a Person nor a ClinicMember row', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce(null);
    const result = await assertOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, CLINIC_ID);
    expect(result).toBe(false);
  });
});

describe('resolveClinicAccess', () => {
  it('returns null for a falsy clinicId without any DB lookup', async () => {
    const result = await resolveClinicAccess(USER_ID, '');
    expect(result).toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('short-circuits to SUPERADMIN for a platform superadmin, skipping org/person lookups', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'SUPERADMIN' });
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toEqual({ role: 'SUPERADMIN' });
    expect(organizationFindFirst).not.toHaveBeenCalled();
  });

  it('resolves the unified role via Person -> PersonRole when the org and role mapping exist', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    personFindFirst.mockResolvedValueOnce({ personRoles: [{ role: { key: 'owner' } }] });
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toEqual({ role: 'OWNER' });
  });

  it('defaults an unmapped/missing PersonRole key to org_admin -> ADMIN', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    personFindFirst.mockResolvedValueOnce({ personRoles: [] });
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toEqual({ role: 'ADMIN' });
  });

  it('falls back to the legacy ClinicMember role when there is no Person row', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'LAB' });
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toEqual({ role: 'LAB' });
  });

  it('falls back to legacy ClinicMember when the Organization row does not exist yet', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'ASSISTANT' });
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toEqual({ role: 'ASSISTANT' });
    expect(personFindFirst).not.toHaveBeenCalled();
  });

  it('returns null when neither Person nor ClinicMember has a matching row', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce(null);
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toBeNull();
  });
});

describe('resolveAnyClinicMembership', () => {
  it('resolves via the oldest Person (unified) membership in a CLINIC-type org, mapping the role', async () => {
    personFindFirst.mockResolvedValueOnce({
      organization: { originalId: CLINIC_ID },
      personRoles: [{ role: { key: 'owner' } }],
    });
    const result = await resolveAnyClinicMembership(USER_ID);
    expect(result).toEqual({ clinicId: CLINIC_ID, role: 'OWNER' });
    expect(personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, organization: { type: 'CLINIC' } } }),
    );
    expect(clinicMemberFindFirst).not.toHaveBeenCalled();
  });

  it('defaults to org_admin -> ADMIN when the Person has no PersonRole rows', async () => {
    personFindFirst.mockResolvedValueOnce({ organization: { originalId: CLINIC_ID }, personRoles: [] });
    const result = await resolveAnyClinicMembership(USER_ID);
    expect(result).toEqual({ clinicId: CLINIC_ID, role: 'ADMIN' });
  });

  it('falls back to the oldest legacy ClinicMember when no Person row exists', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindFirst.mockResolvedValueOnce({ clinicId: CLINIC_ID, role: 'LAB' });
    const result = await resolveAnyClinicMembership(USER_ID);
    expect(result).toEqual({ clinicId: CLINIC_ID, role: 'LAB' });
    expect(clinicMemberFindFirst).toHaveBeenCalledWith({ where: { userId: USER_ID }, orderBy: { joinedAt: 'asc' } });
  });

  it('returns null when the user has no clinic membership at all', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindFirst.mockResolvedValueOnce(null);
    const result = await resolveAnyClinicMembership(USER_ID);
    expect(result).toBeNull();
  });
});
