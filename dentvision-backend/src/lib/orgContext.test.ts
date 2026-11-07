import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  userFindUnique, organizationFindFirst, organizationFindUnique, personFindFirst, clinicMemberFindUnique, clinicMemberFindFirst,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  organizationFindFirst: vi.fn(),
  organizationFindUnique: vi.fn(),
  personFindFirst: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
  clinicMemberFindFirst: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  default: {
    user: { findUnique: userFindUnique },
    organization: { findFirst: organizationFindFirst, findUnique: organizationFindUnique },
    person: { findFirst: personFindFirst },
    clinicMember: { findUnique: clinicMemberFindUnique, findFirst: clinicMemberFindFirst },
  },
}));

import { assertOrgAccess, assertClinicOrgAccess, resolveClinicAccess, resolveAnyClinicMembership } from './orgContext.js';

const CLINIC_ID = 'clinic-1';
const USER_ID = 'user-1';

beforeEach(() => {
  userFindUnique.mockReset();
  organizationFindFirst.mockReset();
  organizationFindUnique.mockReset();
  personFindFirst.mockReset();
  clinicMemberFindUnique.mockReset();
  clinicMemberFindFirst.mockReset();
});


describe('assertClinicOrgAccess', () => {
  it('translates a domain Clinic.id to the canonical Organization.id', async () => {
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1', archivedAt: null });
    personFindFirst.mockResolvedValueOnce({ id: 'person-1' });

    const result = await assertClinicOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, CLINIC_ID);

    expect(result).toBe(true);
    expect(organizationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { originalType: 'Clinic', originalId: CLINIC_ID, archivedAt: null }, select: { id: true } }),
    );
    expect(personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID, organizationId: 'org-1' }),
      }),
    );
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
  });

  it('keeps the legacy ClinicMember fallback when no canonical Organization exists', async () => {
    organizationFindFirst.mockResolvedValueOnce(null);
    organizationFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ id: 'member-1' });

    const result = await assertClinicOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, CLINIC_ID);

    expect(result).toBe(true);
  });

  it('rejects an archived clinic even when a legacy ClinicMember row exists', async () => {
    organizationFindFirst.mockResolvedValueOnce(null);
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-archived', archivedAt: new Date('2026-10-01T00:00:00.000Z') });
    clinicMemberFindUnique.mockResolvedValueOnce({ id: 'legacy-member' });

    const result = await assertClinicOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, CLINIC_ID);

    expect(result).toBe(false);
    expect(personFindFirst).not.toHaveBeenCalled();
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
  });

});

describe('assertOrgAccess', () => {
  it('admits SUPERADMIN without any DB membership lookup', async () => {
    const result = await assertOrgAccess({ id: USER_ID, role: 'SUPERADMIN' } as any, CLINIC_ID);
    expect(result).toBe(true);
    expect(personFindFirst).not.toHaveBeenCalled();
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
  });

  it('admits a Person-only member (no ClinicMember row)', async () => {
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1', archivedAt: null });
    personFindFirst.mockResolvedValueOnce({ id: 'person-1' });
    const result = await assertOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, CLINIC_ID);
    expect(result).toBe(true);
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
  });

  it('falls back to legacy ClinicMember only when the canonical Organization does not exist', async () => {
    organizationFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ id: 'member-1' });
    const result = await assertOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, CLINIC_ID);
    expect(result).toBe(true);
  });

  it('rejects a user with neither a Person nor a ClinicMember row', async () => {
    organizationFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce(null);
    const result = await assertOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, CLINIC_ID);
    expect(result).toBe(false);
  });

  it('rejects an archived canonical organization without falling back to legacy membership', async () => {
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-archived', archivedAt: new Date('2026-10-01T00:00:00.000Z') });
    clinicMemberFindUnique.mockResolvedValueOnce({ id: 'legacy-member' });

    const result = await assertOrgAccess({ id: USER_ID, role: 'DOCTOR' } as any, 'org-archived');

    expect(result).toBe(false);
    expect(personFindFirst).not.toHaveBeenCalled();
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
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
    personFindFirst.mockResolvedValueOnce({ organization: { id: 'org-1' }, personRoles: [{ scopeType: 'organization', scopeId: 'org-1', role: { key: 'owner' } }] });
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toEqual({ role: 'OWNER' });
  });

  it('fails closed when the canonical Organization exists but the Person carries no PersonRole', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    personFindFirst.mockResolvedValueOnce({ personRoles: [] });
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'ASSISTANT' });
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toBeNull();
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
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

  it('fails closed when a canonical Organization exists but no Person row exists', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce({ id: 'org-1' });
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'LAB' });
    const result = await resolveClinicAccess(USER_ID, CLINIC_ID);
    expect(result).toBeNull();
    expect(clinicMemberFindUnique).not.toHaveBeenCalled();
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
      organization: { id: 'org-1', originalId: CLINIC_ID },
      personRoles: [{ scopeType: 'organization', scopeId: 'org-1', role: { key: 'owner' } }],
    });
    const result = await resolveAnyClinicMembership(USER_ID);
    expect(result).toEqual({ clinicId: CLINIC_ID, role: 'OWNER' });
    expect(personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, organization: { type: 'CLINIC', archivedAt: null } } }),
    );
    expect(clinicMemberFindFirst).not.toHaveBeenCalled();
  });

  it('fails closed when a canonical Person has no scoped PersonRole', async () => {
    personFindFirst.mockResolvedValueOnce({ organization: { id: 'org-1', originalId: CLINIC_ID }, personRoles: [] });
    personFindFirst.mockResolvedValueOnce({ id: 'person-1' });
    const result = await resolveAnyClinicMembership(USER_ID);
    expect(result).toBeNull();
    expect(clinicMemberFindFirst).not.toHaveBeenCalled();
  });

  it('falls back to the oldest legacy ClinicMember when no canonical Person row exists', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindFirst.mockResolvedValueOnce({ clinicId: CLINIC_ID, role: 'LAB' });
    const result = await resolveAnyClinicMembership(USER_ID);
    expect(result).toEqual({ clinicId: CLINIC_ID, role: 'LAB' });
    expect(clinicMemberFindFirst).toHaveBeenCalledWith({ where: { userId: USER_ID }, orderBy: { joinedAt: 'asc' } });
  });

  it('returns null when the user has no clinic membership at all', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindFirst.mockResolvedValueOnce(null);
    const result = await resolveAnyClinicMembership(USER_ID);
    expect(result).toBeNull();
  });
});
