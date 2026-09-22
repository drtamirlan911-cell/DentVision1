import { beforeEach, describe, expect, it, vi } from 'vitest';

const { personFindFirst, personFindMany, organizationFindFirst, clinicMemberFindUnique, clinicMemberFindFirst } = vi.hoisted(() => ({
  personFindFirst: vi.fn(),
  personFindMany: vi.fn(),
  organizationFindFirst: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
  clinicMemberFindFirst: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  default: {
    person: { findFirst: personFindFirst, findMany: personFindMany },
    organization: { findFirst: organizationFindFirst },
    clinicMember: { findUnique: clinicMemberFindUnique, findFirst: clinicMemberFindFirst },
  },
}));

import { resolveAuthContext } from './authContext.js';

const USER_ID = 'user-1';
const CLINIC_ID = 'clinic-1';
const ORG_ID = 'org-1';
const clinicOrg = { id: ORG_ID, type: 'CLINIC', originalId: CLINIC_ID };
const activeClinicRole = [{ scopeType: 'organization', scopeId: ORG_ID, role: { key: 'doctor' } }];

beforeEach(() => {
  personFindFirst.mockReset().mockResolvedValue(null);
  personFindMany.mockReset().mockResolvedValue([]);
  organizationFindFirst.mockReset().mockResolvedValue(null);
  clinicMemberFindUnique.mockReset().mockResolvedValue(null);
  clinicMemberFindFirst.mockReset().mockResolvedValue(null);
});

describe('resolveAuthContext — preferred organization', () => {
  it('maps a clinic organization to the clinic id, not the organization id', async () => {
    personFindFirst.mockResolvedValueOnce({ personType: 'CLINIC_STAFF', organizationId: ORG_ID, organization: clinicOrg, personRoles: activeClinicRole });
    const ctx = await resolveAuthContext(USER_ID, { organizationId: ORG_ID });
    expect(ctx).toEqual({ organizationId: ORG_ID, organizationOriginalId: CLINIC_ID, organizationType: 'CLINIC', personType: 'CLINIC_STAFF', clinicId: CLINIC_ID });
  });

  it('leaves clinicId unset for a non-clinic organization', async () => {
    personFindFirst.mockResolvedValueOnce({ personType: 'SUPPLIER_REP', organizationId: 'org-2', organization: { id: 'org-2', type: 'SUPPLIER_COMPANY', originalId: 'supplier-1' }, personRoles: [{ scopeType: 'organization', scopeId: 'org-2', role: { key: 'seller' } }] });
    const ctx = await resolveAuthContext(USER_ID, { organizationId: 'org-2' });
    expect(ctx.clinicId).toBeUndefined();
    expect(ctx.organizationType).toBe('SUPPLIER_COMPANY');
  });

  it('ignores an organization the user has no Person link to', async () => {
    const ctx = await resolveAuthContext(USER_ID, { organizationId: 'someone-elses-org' });
    expect(ctx).toEqual({});
  });

  it('fails closed when the unified Person remains but its organization role is revoked', async () => {
    personFindFirst.mockResolvedValueOnce({ personType: 'CLINIC_STAFF', organizationId: ORG_ID, organization: clinicOrg, personRoles: [] });
    personFindFirst.mockResolvedValueOnce({ id: 'person-1' });
    const ctx = await resolveAuthContext(USER_ID, { organizationId: ORG_ID });
    expect(ctx).toEqual({});
  });
});

describe('resolveAuthContext — preferred clinic', () => {
  it('resolves the organization behind a clinic id', async () => {
    organizationFindFirst.mockResolvedValueOnce({ id: ORG_ID });
    personFindFirst.mockResolvedValueOnce({ personType: 'CLINIC_STAFF', organizationId: ORG_ID, organization: clinicOrg, personRoles: activeClinicRole });
    const ctx = await resolveAuthContext(USER_ID, { clinicId: CLINIC_ID });
    expect(organizationFindFirst).toHaveBeenCalledWith({ where: { originalType: 'Clinic', originalId: CLINIC_ID }, select: { id: true } });
    expect(ctx.organizationId).toBe(ORG_ID);
    expect(ctx.clinicId).toBe(CLINIC_ID);
  });

  it('falls back to a legacy membership when no Person exists yet', async () => {
    clinicMemberFindUnique.mockResolvedValueOnce({ id: 'cm-1' });
    const ctx = await resolveAuthContext(USER_ID, { clinicId: CLINIC_ID });
    expect(ctx).toEqual({ clinicId: CLINIC_ID });
  });

  it('refuses a clinic the user does not belong to', async () => {
    const ctx = await resolveAuthContext(USER_ID, { clinicId: 'other-clinic' });
    expect(ctx).toEqual({});
  });

  it('does not resurrect a revoked unified Person through a legacy ClinicMember', async () => {
    organizationFindFirst.mockResolvedValueOnce({ id: ORG_ID });
    personFindFirst.mockResolvedValueOnce({ personType: 'CLINIC_STAFF', organizationId: ORG_ID, organization: clinicOrg, personRoles: [] });
    personFindFirst.mockResolvedValueOnce({ id: 'person-1' });
    clinicMemberFindUnique.mockResolvedValueOnce({ id: 'legacy-1' });
    const ctx = await resolveAuthContext(USER_ID, { clinicId: CLINIC_ID });
    expect(ctx).toEqual({});
  });
});

describe('resolveAuthContext — default scope', () => {
  it('prefers a clinic organization over other org types', async () => {
    personFindMany.mockResolvedValueOnce([{ personType: 'CLINIC_STAFF', organizationId: ORG_ID, organization: clinicOrg, personRoles: activeClinicRole }]);
    const ctx = await resolveAuthContext(USER_ID);
    expect(ctx).toMatchObject({ organizationId: ORG_ID, organizationOriginalId: CLINIC_ID, organizationType: 'CLINIC', personType: 'CLINIC_STAFF', clinicId: CLINIC_ID });
  });

  it('falls back to the oldest legacy membership', async () => {
    clinicMemberFindFirst.mockResolvedValueOnce({ clinicId: CLINIC_ID });
    clinicMemberFindUnique.mockResolvedValueOnce({ id: 'cm-1' });
    const ctx = await resolveAuthContext(USER_ID);
    expect(clinicMemberFindFirst).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { joinedAt: 'asc' } }));
    expect(ctx).toEqual({ clinicId: CLINIC_ID });
  });

  it('falls back to a non-clinic organization for suppliers and lecturers', async () => {
    personFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ personType: 'LECTURER', organizationId: 'org-3', organization: { id: 'org-3', type: 'ACADEMY', originalId: 'academy-1' }, personRoles: [{ scopeType: 'organization', scopeId: 'org-3', role: { key: 'lecturer' } }] }]);
    const ctx = await resolveAuthContext(USER_ID);
    expect(ctx).toEqual({ organizationId: 'org-3', organizationOriginalId: 'academy-1', organizationType: 'ACADEMY', personType: 'LECTURER' });
  });

  it('returns an empty context for a user with no memberships at all', async () => {
    expect(await resolveAuthContext(USER_ID)).toEqual({});
  });
});
