import { beforeEach, describe, expect, it, vi } from 'vitest';

const { centerFindFirst, labFindFirst, invitationFindUnique, invitationUpdate, grantDiagnosticsAccess } =
  vi.hoisted(() => ({
    centerFindFirst: vi.fn(),
    labFindFirst: vi.fn(),
    invitationFindUnique: vi.fn(),
    invitationUpdate: vi.fn(),
    grantDiagnosticsAccess: vi.fn(),
  }));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    diagnosticCenterMember: { findFirst: centerFindFirst },
    laboratoryMember: { findFirst: labFindFirst },
    organizationInvitation: { findUnique: invitationFindUnique, update: invitationUpdate },
  },
}));
vi.mock('../diagnostics/diagnostics.service.js', () => ({ grantDiagnosticsAccess }));

import {
  acceptInvitation,
  canManageMembers,
  generateInviteCode,
  normalizeDiagnosticInviteRole,
  rejectInvitation,
} from './invitations.service.js';

const NOW = new Date('2026-08-10T12:00:00Z');
const CENTER_ORG = { id: 'org-1', type: 'DIAGNOSTIC_CENTER', originalId: 'center-1', name: 'ТомоДент' };

beforeEach(() => {
  centerFindFirst.mockReset();
  labFindFirst.mockReset();
  invitationFindUnique.mockReset();
  invitationUpdate.mockReset();
  grantDiagnosticsAccess.mockReset();
  grantDiagnosticsAccess.mockResolvedValue(true);
});

describe('rejectInvitation', () => {
  const valid = { email: null, expiresAt: new Date('2026-08-20T00:00:00Z'), usedAt: null };

  it('accepts a live, untargeted code', () => {
    expect(rejectInvitation(valid, { now: NOW })).toBeNull();
  });

  it('answers 404 for a code that does not exist', () => {
    expect(rejectInvitation(null, { now: NOW })).toEqual({ status: 404, error: expect.any(String) });
  });

  it('answers 409 for a code already spent', () => {
    expect(rejectInvitation({ ...valid, usedAt: NOW }, { now: NOW })?.status).toBe(409);
  });

  it('answers 410 once the code has expired', () => {
    const expired = { ...valid, expiresAt: new Date('2026-08-01T00:00:00Z') };
    expect(rejectInvitation(expired, { now: NOW })?.status).toBe(410);
  });

  it('reports a spent code as spent even when it is also expired', () => {
    // Ordering matters: "already used" is the more informative answer, and it
    // is the one /auth/join-clinic gives for the same pair of conditions.
    const both = { email: null, expiresAt: new Date('2026-08-01T00:00:00Z'), usedAt: NOW };
    expect(rejectInvitation(both, { now: NOW })?.status).toBe(409);
  });

  it('never expires a code with no expiry set', () => {
    expect(rejectInvitation({ ...valid, expiresAt: null }, { now: NOW })).toBeNull();
  });

  it('refuses a targeted code presented by anyone else', () => {
    // A targeted invite is a second factor. Without this the code alone would
    // admit whoever saw it.
    const targeted = { ...valid, email: 'radiolog@clinic.kz' };
    expect(rejectInvitation(targeted, { now: NOW, userEmail: 'someone@else.kz' })?.status).toBe(403);
  });

  it('matches the target address case-insensitively', () => {
    const targeted = { ...valid, email: 'Radiolog@Clinic.kz' };
    expect(rejectInvitation(targeted, { now: NOW, userEmail: 'radiolog@clinic.KZ' })).toBeNull();
  });

  it('refuses a targeted code when the caller has no address at all', () => {
    const targeted = { ...valid, email: 'radiolog@clinic.kz' };
    expect(rejectInvitation(targeted, { now: NOW, userEmail: null })?.status).toBe(403);
  });
});

describe('normalizeDiagnosticInviteRole', () => {
  it('keeps the four roles the diagnostics module recognises', () => {
    for (const role of ['admin', 'manager', 'radiologist', 'operator']) {
      expect(normalizeDiagnosticInviteRole(role)).toBe(role);
    }
  });

  it('falls back to the narrowest role rather than trusting the caller', () => {
    // `owner` is deliberately not invitable: ownership comes from the approved
    // registration request, not from a code someone pasted.
    expect(normalizeDiagnosticInviteRole('owner')).toBe('operator');
    expect(normalizeDiagnosticInviteRole('SUPERADMIN')).toBe('operator');
    expect(normalizeDiagnosticInviteRole(undefined)).toBe('operator');
  });

  it('is case-insensitive about a role it does recognise', () => {
    expect(normalizeDiagnosticInviteRole('Radiologist')).toBe('radiologist');
  });
});

describe('generateInviteCode', () => {
  it('produces distinct eight-character codes', () => {
    const codes = new Set(Array.from({ length: 50 }, generateInviteCode));
    expect(codes.size).toBe(50);
    for (const code of codes) expect(code).toMatch(/^[0-9A-F]{8}$/);
  });
});

describe('canManageMembers', () => {
  it('lets an owner invite', async () => {
    centerFindFirst.mockResolvedValue({ role: 'owner' });
    expect(await canManageMembers('u1', CENTER_ORG)).toBe(true);
  });

  it('refuses an operator', async () => {
    // Read from the legacy member row on purpose: `grantDiagnosticsAccess`
    // leaves operators without a PersonRole, so the unified graph cannot tell
    // an operator from an owner.
    centerFindFirst.mockResolvedValue({ role: 'operator' });
    expect(await canManageMembers('u1', CENTER_ORG)).toBe(false);
  });

  it('refuses a non-member', async () => {
    centerFindFirst.mockResolvedValue(null);
    expect(await canManageMembers('u1', CENTER_ORG)).toBe(false);
  });

  it('passes a superadmin through without a lookup', async () => {
    expect(await canManageMembers('u1', CENTER_ORG, true)).toBe(true);
    expect(centerFindFirst).not.toHaveBeenCalled();
  });

  it('looks a laboratory up by labId, not centerId', async () => {
    labFindFirst.mockResolvedValue({ role: 'admin' });
    const lab = { id: 'org-2', type: 'LABORATORY', originalId: 'lab-1' };
    expect(await canManageMembers('u1', lab)).toBe(true);
    expect(labFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { labId: 'lab-1', userId: 'u1' } }));
  });

  it('refuses an organization type with no membership table', async () => {
    expect(await canManageMembers('u1', { id: 'org-3', type: 'CLINIC', originalId: 'clinic-1' })).toBe(false);
  });
});

describe('acceptInvitation', () => {
  function arrangeInvite(overrides: Record<string, unknown> = {}) {
    invitationFindUnique.mockResolvedValue({
      code: 'ABCD1234',
      role: 'radiologist',
      email: null,
      expiresAt: new Date('2026-12-01T00:00:00Z'),
      usedAt: null,
      organization: CENTER_ORG,
      ...overrides,
    });
  }

  it('grants membership against the entity id and spends the code', async () => {
    arrangeInvite();
    centerFindFirst.mockResolvedValue(null);

    const result = await acceptInvitation('ABCD1234', { id: 'u1', email: 'r@c.kz' });

    // `originalId`, never `Organization.id` — every diagnostics query is keyed
    // on the centre's own id.
    expect(grantDiagnosticsAccess).toHaveBeenCalledWith('DiagnosticCenter', 'center-1', 'u1', 'radiologist');
    expect(invitationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'ABCD1234' }, data: expect.objectContaining({ usedBy: 'u1' }) }),
    );
    expect(result).toMatchObject({ entityId: 'center-1', organizationType: 'DIAGNOSTIC_CENTER', role: 'radiologist' });
  });

  it('does not spend the code when the grant fails', async () => {
    // Marking it used first would burn the invite and leave the invitee with no
    // way in and no way to retry.
    arrangeInvite();
    centerFindFirst.mockResolvedValue(null);
    grantDiagnosticsAccess.mockResolvedValue(false);

    await expect(acceptInvitation('ABCD1234', { id: 'u1' })).rejects.toMatchObject({ status: 500 });
    expect(invitationUpdate).not.toHaveBeenCalled();
  });

  it('refuses a user who is already a member, without spending the code', async () => {
    arrangeInvite();
    centerFindFirst.mockResolvedValue({ id: 'm1', role: 'operator' });

    await expect(acceptInvitation('ABCD1234', { id: 'u1' })).rejects.toMatchObject({ status: 409 });
    expect(grantDiagnosticsAccess).not.toHaveBeenCalled();
    expect(invitationUpdate).not.toHaveBeenCalled();
  });

  it('refuses an organization type it cannot grant membership in', async () => {
    arrangeInvite({ organization: { id: 'org-9', type: 'ACADEMY', originalId: 'ac-1', name: 'Академия' } });

    await expect(acceptInvitation('ABCD1234', { id: 'u1' })).rejects.toMatchObject({ status: 400 });
    expect(invitationUpdate).not.toHaveBeenCalled();
  });

  it('surfaces the validation status for a spent code', async () => {
    arrangeInvite({ usedAt: new Date('2026-08-09T00:00:00Z') });

    await expect(acceptInvitation('ABCD1234', { id: 'u1' })).rejects.toMatchObject({ status: 409 });
    expect(grantDiagnosticsAccess).not.toHaveBeenCalled();
  });
});
