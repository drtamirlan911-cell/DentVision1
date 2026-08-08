import { beforeEach, describe, expect, it, vi } from 'vitest';

const { personFindFirst, organizationFindFirst, clinicMemberFindUnique, clinicMemberFindFirst } = vi.hoisted(() => ({
  personFindFirst: vi.fn(),
  organizationFindFirst: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
  clinicMemberFindFirst: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  default: {
    person: { findFirst: personFindFirst },
    organization: { findFirst: organizationFindFirst },
    clinicMember: { findUnique: clinicMemberFindUnique, findFirst: clinicMemberFindFirst },
  },
}));

import { resolveAuthContext } from './authContext.js';

const USER_ID = 'user-1';
const CLINIC_ID = 'clinic-1';
const ORG_ID = 'org-1';

const clinicOrg = { id: ORG_ID, type: 'CLINIC', originalId: CLINIC_ID };

beforeEach(() => {
  personFindFirst.mockReset().mockResolvedValue(null);
  organizationFindFirst.mockReset().mockResolvedValue(null);
  clinicMemberFindUnique.mockReset().mockResolvedValue(null);
  clinicMemberFindFirst.mockReset().mockResolvedValue(null);
});

describe('resolveAuthContext — preferred organization', () => {
  it('maps a clinic organization to the clinic id, not the organization id', async () => {
    personFindFirst.mockResolvedValueOnce({ personType: 'CLINIC_STAFF', organization: clinicOrg });

    const ctx = await resolveAuthContext(USER_ID, { organizationId: ORG_ID });

    expect(ctx).toEqual({
      organizationId: ORG_ID,
      organizationType: 'CLINIC',
      personType: 'CLINIC_STAFF',
      clinicId: CLINIC_ID,
    });
  });

  it('leaves clinicId unset for a non-clinic organization', async () => {
    personFindFirst.mockResolvedValueOnce({
      personType: 'SUPPLIER_REP',
      organization: { id: 'org-2', type: 'SUPPLIER_COMPANY', originalId: 'supplier-1' },
    });

    const ctx = await resolveAuthContext(USER_ID, { organizationId: 'org-2' });

    expect(ctx.clinicId).toBeUndefined();
    expect(ctx.organizationType).toBe('SUPPLIER_COMPANY');
  });

  it('ignores an organization the user has no Person link to', async () => {
    // Preference unverifiable → falls through to the default scope, which is
    // also empty here.
    const ctx = await resolveAuthContext(USER_ID, { organizationId: 'someone-elses-org' });

    expect(ctx).toEqual({});
  });
});

describe('resolveAuthContext — preferred clinic', () => {
  it('resolves the organization behind a clinic id', async () => {
    organizationFindFirst.mockResolvedValueOnce({ id: ORG_ID });
    personFindFirst.mockResolvedValueOnce({ personType: 'CLINIC_STAFF', organization: clinicOrg });

    const ctx = await resolveAuthContext(USER_ID, { clinicId: CLINIC_ID });

    expect(organizationFindFirst).toHaveBeenCalledWith({
      where: { originalType: 'Clinic', originalId: CLINIC_ID },
      select: { id: true },
    });
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
});

describe('resolveAuthContext — default scope', () => {
  it('prefers a clinic organization over other org types', async () => {
    personFindFirst.mockResolvedValueOnce({ personType: 'CLINIC_STAFF', organization: clinicOrg });

    const ctx = await resolveAuthContext(USER_ID);

    expect(ctx).toEqual({
      organizationId: ORG_ID,
      organizationType: 'CLINIC',
      personType: 'CLINIC_STAFF',
      clinicId: CLINIC_ID,
    });
  });

  it('falls back to the oldest legacy membership', async () => {
    clinicMemberFindFirst.mockResolvedValueOnce({ clinicId: CLINIC_ID });
    clinicMemberFindUnique.mockResolvedValueOnce({ id: 'cm-1' });

    const ctx = await resolveAuthContext(USER_ID);

    expect(clinicMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { joinedAt: 'asc' } }),
    );
    expect(ctx).toEqual({ clinicId: CLINIC_ID });
  });

  it('falls back to a non-clinic organization for suppliers and lecturers', async () => {
    personFindFirst
      .mockResolvedValueOnce(null) // no clinic Person
      .mockResolvedValueOnce({
        personType: 'LECTURER',
        organization: { id: 'org-3', type: 'ACADEMY', originalId: 'academy-1' },
      });

    const ctx = await resolveAuthContext(USER_ID);

    expect(ctx).toEqual({
      organizationId: 'org-3',
      organizationType: 'ACADEMY',
      personType: 'LECTURER',
    });
  });

  it('returns an empty context for a user with no memberships at all', async () => {
    expect(await resolveAuthContext(USER_ID)).toEqual({});
  });
});
