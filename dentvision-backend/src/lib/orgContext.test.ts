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

  it('falls through to the legacy role when the Person carries no PersonRole', async () => {
    // This used to default to org_admin -> ADMIN, and the old test asserted
    // that as intended behaviour. It is not: grantDiagnosticsAccess creates a
    // Person *without* a role for `radiologist`/`operator` precisely so they
    // fall back to the narrower legacy check, and the default took that away.
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    personFindFirst.mockResolvedValueOnce({ personRoles: [] });
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'ASSISTANT' });
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toEqual({ role: 'ASSISTANT' });
  });

  it('denies rather than guessing when a Person has no role and no legacy membership', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    personFindFirst.mockResolvedValueOnce({ personRoles: [] });
    clinicMemberFindUnique.mockResolvedValueOnce(null);
    expect(await resolveClinicAccess(USER_ID, CLINIC_ID)).toBeNull();
  });

  it('does not hand a clinical role to a marketplace or academy membership', async () => {
    // `seller` and `lecturer` used to map to DOCTOR, which carries
    // medical-record access neither of them was granted.
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    personFindFirst.mockResolvedValueOnce({ personRoles: [{ role: { key: 'seller' } }] });
    clinicMemberFindUnique.mockResolvedValueOnce(null);
    expect(await resolveClinicAccess(USER_ID, CLINIC_ID)).toBeNull();
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

  it('falls through to the legacy membership when the Person has no PersonRole', async () => {
    // Was: default to org_admin -> ADMIN. Same fail-open as resolveClinicAccess.
    personFindFirst.mockResolvedValueOnce({ organization: { originalId: CLINIC_ID }, personRoles: [] });
    clinicMemberFindFirst.mockResolvedValueOnce({ clinicId: CLINIC_ID, role: 'DOCTOR' });
    const result = await resolveAnyClinicMembership(USER_ID);
    expect(result).toEqual({ clinicId: CLINIC_ID, role: 'DOCTOR' });
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
