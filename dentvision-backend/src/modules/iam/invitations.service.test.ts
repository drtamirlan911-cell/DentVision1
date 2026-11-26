import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  centerFindFirst, labFindFirst, supplierMemberFindFirst, supplierMemberCreate,
  invitationFindUnique, invitationUpdateMany, organizationFindUnique, invitationCreate,
  grantDiagnosticsAccess, syncPersonFromSupplierMember, transaction,
} = vi.hoisted(() => ({
  centerFindFirst: vi.fn(),
  labFindFirst: vi.fn(),
  supplierMemberFindFirst: vi.fn(),
  supplierMemberCreate: vi.fn(),
  invitationFindUnique: vi.fn(),
  invitationUpdateMany: vi.fn(),
  organizationFindUnique: vi.fn(),
  invitationCreate: vi.fn(),
  grantDiagnosticsAccess: vi.fn(),
  syncPersonFromSupplierMember: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    diagnosticCenterMember: { findFirst: centerFindFirst },
    laboratoryMember: { findFirst: labFindFirst },
    supplierMember: { findFirst: supplierMemberFindFirst },
    organization: { findUnique: organizationFindUnique },
    organizationInvitation: { findUnique: invitationFindUnique, updateMany: invitationUpdateMany, create: invitationCreate },
    $transaction: transaction,
  },
}));
vi.mock('../diagnostics/diagnostics.service.js', () => ({ grantDiagnosticsAccess }));
vi.mock('../../lib/syncMembership.js', () => ({ syncPersonFromSupplierMember }));

import {
  acceptInvitation,
  canManageMembers,
  generateInviteCode,
  normalizeDiagnosticInviteRole,
  normalizeEmployerInviteRole,
  normalizeLaboratoryInviteRole,
  normalizeSupplierInviteRole,
  laboratoryTypeFromSettings,
  createInvitation,
  rejectInvitation,
  isOrganizationMemberRoleAllowed,
} from './invitations.service.js';

const NOW = new Date('2026-08-10T12:00:00Z');
const CENTER_ORG = { id: 'org-1', type: 'DIAGNOSTIC_CENTER', originalId: 'center-1', name: 'ТомоДент' };

beforeEach(() => {
  centerFindFirst.mockReset();
  labFindFirst.mockReset();
  supplierMemberFindFirst.mockReset();
  supplierMemberCreate.mockReset();
  invitationFindUnique.mockReset();
  invitationUpdateMany.mockReset();
  organizationFindUnique.mockReset();
  invitationCreate.mockReset();
  grantDiagnosticsAccess.mockReset();
  syncPersonFromSupplierMember.mockReset();
  transaction.mockReset();
  grantDiagnosticsAccess.mockResolvedValue(true);
  syncPersonFromSupplierMember.mockResolvedValue(undefined);
  supplierMemberFindFirst.mockResolvedValue(null);
  supplierMemberCreate.mockResolvedValue({ id: 'supplier-member-1' });
  transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback({
    supplierMember: { create: supplierMemberCreate },
    organizationInvitation: { updateMany: invitationUpdateMany },
  }));
  invitationUpdateMany.mockResolvedValue({ count: 1 });
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

  it('answers 410 when the code was explicitly revoked', () => {
    expect(rejectInvitation({ ...valid, revokedAt: NOW }, { now: NOW })?.status).toBe(410);
    expect(rejectInvitation({ ...valid, revokedAt: NOW }, { now: NOW })?.error).toContain('отозвано');
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

describe('laboratory invite role families', () => {
  it('reads the medical or dental vertical only from organization settings', () => {
    expect(laboratoryTypeFromSettings({ laboratoryType: 'DENTAL_LAB' })).toBe('DENTAL_LAB');
    expect(laboratoryTypeFromSettings({ laboratoryType: 'MEDICAL_LAB' })).toBe('MEDICAL_LAB');
    expect(laboratoryTypeFromSettings({})).toBe('MEDICAL_LAB');
    expect(laboratoryTypeFromSettings(null)).toBe('MEDICAL_LAB');
  });

  it('allows only medical laboratory roles and never owner or platform roles', () => {
    for (const role of ['medical_lab_admin', 'medical_lab_manager', 'medical_lab_reception', 'medical_lab_technician', 'medical_lab_validator', 'medical_lab_doctor', 'medical_lab_finance', 'medical_lab_quality']) {
      expect(normalizeLaboratoryInviteRole(role, 'MEDICAL_LAB')).toBe(role);
    }
    expect(normalizeLaboratoryInviteRole('medical_lab_owner', 'MEDICAL_LAB')).toBe('medical_lab_technician');
    expect(normalizeLaboratoryInviteRole('SUPERADMIN', 'MEDICAL_LAB')).toBe('medical_lab_technician');
    expect(normalizeLaboratoryInviteRole('lab_finance', 'MEDICAL_LAB')).toBe('medical_lab_technician');
  });

  it('allows only dental laboratory roles and never medical roles, owner or platform roles', () => {
    for (const role of ['dental_lab_admin', 'dental_lab_manager', 'lab_coordinator', 'dental_technician', 'cad_designer', 'ceramist', 'orthodontic_technician', 'qc_specialist', 'lab_finance']) {
      expect(normalizeLaboratoryInviteRole(role, 'DENTAL_LAB')).toBe(role);
    }
    expect(normalizeLaboratoryInviteRole('dental_lab_owner', 'DENTAL_LAB')).toBe('dental_technician');
    expect(normalizeLaboratoryInviteRole('medical_lab_finance', 'DENTAL_LAB')).toBe('dental_technician');
    expect(normalizeLaboratoryInviteRole('SUPERADMIN', 'DENTAL_LAB')).toBe('dental_technician');
  });
});

describe('createInvitation — laboratory role family', () => {
  it('normalizes a dental-lab invitation against the persisted dental vertical', async () => {
    organizationFindUnique.mockResolvedValue({
      id: 'org-dental', type: 'LABORATORY', archivedAt: null,
      settings: { laboratoryType: 'DENTAL_LAB' },
    });
    invitationCreate.mockImplementation(async ({ data }: any) => data);

    const result = await createInvitation({
      organizationId: 'org-dental',
      role: 'medical_lab_finance',
      createdBy: 'owner-1',
    });

    expect(result.role).toBe('dental_technician');
    expect(invitationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-dental', role: 'dental_technician' }),
    }));
  });

  it('preserves a valid medical finance invitation for a medical laboratory', async () => {
    organizationFindUnique.mockResolvedValue({
      id: 'org-medical', type: 'LABORATORY', archivedAt: null,
      settings: { laboratoryType: 'MEDICAL_LAB' },
    });
    invitationCreate.mockImplementation(async ({ data }: any) => data);

    const result = await createInvitation({
      organizationId: 'org-medical',
      role: 'medical_lab_finance',
      createdBy: 'owner-1',
    });

    expect(result.role).toBe('medical_lab_finance');
  });
});

describe('organization partner staff role policy', () => {
  it('accepts all supported diagnostic center roles but rejects owner escalation and unknown roles', () => {
    const center = { type: 'DIAGNOSTIC_CENTER', settings: null };
    expect(isOrganizationMemberRoleAllowed(center, 'diagnostic_reception')).toBe(true);
    expect(isOrganizationMemberRoleAllowed(center, 'radiology_technician')).toBe(true);
    expect(isOrganizationMemberRoleAllowed(center, 'diagnostic_finance')).toBe(true);
    expect(isOrganizationMemberRoleAllowed(center, 'diagnostic_quality')).toBe(true);
    expect(isOrganizationMemberRoleAllowed(center, 'owner')).toBe(false);
    expect(isOrganizationMemberRoleAllowed(center, 'SUPERADMIN')).toBe(false);
  });

  it('keeps medical and dental laboratory roles isolated by the canonical organization settings', () => {
    expect(isOrganizationMemberRoleAllowed({ type: 'LABORATORY', settings: { laboratoryType: 'MEDICAL_LAB' } }, 'medical_lab_validator')).toBe(true);
    expect(isOrganizationMemberRoleAllowed({ type: 'LABORATORY', settings: { laboratoryType: 'MEDICAL_LAB' } }, 'dental_technician')).toBe(false);
    expect(isOrganizationMemberRoleAllowed({ type: 'LABORATORY', settings: { laboratoryType: 'DENTAL_LAB' } }, 'dental_technician')).toBe(true);
    expect(isOrganizationMemberRoleAllowed({ type: 'LABORATORY', settings: { laboratoryType: 'DENTAL_LAB' } }, 'medical_lab_validator')).toBe(false);
    expect(isOrganizationMemberRoleAllowed({ type: 'LABORATORY', settings: { laboratoryType: 'DENTAL_LAB' } }, 'dental_lab_owner')).toBe(false);
  });
});

describe('supplier invitation role', () => {
  it('allows the supplier manager role but never grants supplier ownership', () => {
    expect(normalizeSupplierInviteRole('manager')).toBe('manager');
    expect(normalizeSupplierInviteRole('owner')).toBe('manager');
    expect(normalizeSupplierInviteRole('SUPERADMIN')).toBe('manager');
    expect(normalizeSupplierInviteRole(undefined)).toBe('manager');
  });

  it('allows only the supplier owner to invite staff', async () => {
    supplierMemberFindFirst.mockResolvedValueOnce({ role: 'owner' });
    expect(await canManageMembers('supplier-owner', {
      id: 'supplier-org', type: 'SUPPLIER_COMPANY', originalId: 'supplier-1',
    })).toBe(true);

    supplierMemberFindFirst.mockResolvedValueOnce({ role: 'manager' });
    expect(await canManageMembers('supplier-manager', {
      id: 'supplier-org', type: 'SUPPLIER_COMPANY', originalId: 'supplier-1',
    })).toBe(false);
  });

  it('creates supplier invitations with the non-owner manager role', async () => {
    organizationFindUnique.mockResolvedValue({
      id: 'supplier-org', type: 'SUPPLIER_COMPANY', originalId: 'supplier-1', archivedAt: null,
    });
    invitationCreate.mockImplementation(async ({ data }: any) => data);

    const result = await createInvitation({
      organizationId: 'supplier-org', role: 'owner', createdBy: 'supplier-owner',
    });

    expect(result.role).toBe('manager');
    expect(invitationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'supplier-org', role: 'manager' }),
    }));
  });
});

describe('normalizeEmployerInviteRole', () => {
  it('allows only recruiter and read-only employer roles', () => {
    expect(normalizeEmployerInviteRole('employer_recruiter')).toBe('employer_recruiter');
    expect(normalizeEmployerInviteRole('employer_viewer')).toBe('employer_viewer');
  });

  it('does not allow invitees to grant themselves owner or platform roles', () => {
    expect(normalizeEmployerInviteRole('employer_owner')).toBe('employer_viewer');
    expect(normalizeEmployerInviteRole('OWNER')).toBe('employer_viewer');
    expect(normalizeEmployerInviteRole('SUPERADMIN')).toBe('employer_viewer');
    expect(normalizeEmployerInviteRole(undefined)).toBe('employer_viewer');
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
    // Manager authority remains anchored to the legacy center-member role;
    // having a canonical operational PersonRole must not grant invite powers.
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
    expect(invitationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ code: 'ABCD1234' }), data: expect.objectContaining({ usedBy: 'u1' }) }),
    );
    expect(result).toMatchObject({ entityId: 'center-1', organizationType: 'DIAGNOSTIC_CENTER', role: 'radiologist' });
  });

  it('grants a dental technician with the dental canonical role and dental legacy membership', async () => {
    arrangeInvite({
      role: 'dental_technician',
      organization: {
        id: 'org-dental', type: 'LABORATORY', originalId: 'dental-lab-1', name: 'Dental Lab',
        settings: { laboratoryType: 'DENTAL_LAB' },
      },
    });
    labFindFirst.mockResolvedValue(null);

    const result = await acceptInvitation('ABCD1234', { id: 'dental-tech-1', email: 'tech@example.test' });

    expect(grantDiagnosticsAccess).toHaveBeenCalledWith('Laboratory', 'dental-lab-1', 'dental-tech-1', 'dental_technician');
    expect(result).toMatchObject({ organizationType: 'LABORATORY', entityId: 'dental-lab-1', role: 'dental_technician' });
    expect(invitationUpdateMany).toHaveBeenCalledOnce();
  });

  it('refuses a role from the wrong laboratory vertical without granting or consuming the invitation', async () => {
    arrangeInvite({
      role: 'medical_lab_finance',
      organization: {
        id: 'org-dental', type: 'LABORATORY', originalId: 'dental-lab-1', name: 'Dental Lab',
        settings: { laboratoryType: 'DENTAL_LAB' },
      },
    });
    labFindFirst.mockResolvedValue(null);

    await expect(acceptInvitation('ABCD1234', { id: 'dental-tech-2' }))
      .rejects.toMatchObject({ status: 400 });
    expect(grantDiagnosticsAccess).not.toHaveBeenCalled();
    expect(invitationUpdateMany).not.toHaveBeenCalled();
  });

  it('grants the medical finance role only to a medical laboratory', async () => {
    arrangeInvite({
      role: 'medical_lab_finance',
      organization: {
        id: 'org-medical', type: 'LABORATORY', originalId: 'medical-lab-1', name: 'Medical Lab',
        settings: { laboratoryType: 'MEDICAL_LAB' },
      },
    });
    labFindFirst.mockResolvedValue(null);

    const result = await acceptInvitation('ABCD1234', { id: 'medical-finance-1' });

    expect(grantDiagnosticsAccess).toHaveBeenCalledWith('Laboratory', 'medical-lab-1', 'medical-finance-1', 'medical_lab_finance');
    expect(result).toMatchObject({ organizationType: 'LABORATORY', entityId: 'medical-lab-1', role: 'medical_lab_finance' });
  });

  it('adds a supplier employee to the existing supplier membership and canonical person graph', async () => {
    arrangeInvite({
      role: 'manager',
      organization: {
        id: 'supplier-org', type: 'SUPPLIER_COMPANY', originalId: 'supplier-1', name: 'Dental Market',
      },
    });
    supplierMemberFindFirst.mockResolvedValue(null);
    supplierMemberCreate.mockResolvedValue({ id: 'supplier-member-7' });

    const result = await acceptInvitation('ABCD1234', { id: 'supplier-user-7', email: 'manager@example.test' });

    expect(transaction).toHaveBeenCalledOnce();
    expect(supplierMemberCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ supplierId: 'supplier-1', userId: 'supplier-user-7', role: 'manager' }),
    });
    expect(syncPersonFromSupplierMember).toHaveBeenCalledWith('supplier-member-7', 'supplier-1', 'supplier-user-7', expect.any(Object));
    expect(invitationUpdateMany).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      organizationId: 'supplier-org',
      organizationType: 'SUPPLIER_COMPANY',
      entityId: 'supplier-1',
      role: 'manager',
    });
  });

  it('does not spend the code when the grant fails', async () => {
    // Marking it used first would burn the invite and leave the invitee with no
    // way in and no way to retry.
    arrangeInvite();
    centerFindFirst.mockResolvedValue(null);
    grantDiagnosticsAccess.mockResolvedValue(false);

    await expect(acceptInvitation('ABCD1234', { id: 'u1' })).rejects.toMatchObject({ status: 500 });
    expect(invitationUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses a user who is already a member, without spending the code', async () => {
    arrangeInvite();
    centerFindFirst.mockResolvedValue({ id: 'm1', role: 'operator' });

    await expect(acceptInvitation('ABCD1234', { id: 'u1' })).rejects.toMatchObject({ status: 409 });
    expect(grantDiagnosticsAccess).not.toHaveBeenCalled();
    expect(invitationUpdateMany).not.toHaveBeenCalled();
  });

  it('refuses an organization type it cannot grant membership in', async () => {
    arrangeInvite({ organization: { id: 'org-9', type: 'ACADEMY', originalId: 'ac-1', name: 'Академия' } });

    await expect(acceptInvitation('ABCD1234', { id: 'u1' })).rejects.toMatchObject({ status: 400 });
    expect(invitationUpdateMany).not.toHaveBeenCalled();
  });

  it('returns conflict when the one-time claim loses a concurrent race', async () => {
    arrangeInvite();
    centerFindFirst.mockResolvedValue(null);
    invitationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(acceptInvitation('ABCD1234', { id: 'u1' })).rejects.toMatchObject({ status: 409 });
    expect(grantDiagnosticsAccess).toHaveBeenCalledTimes(1);
  });

  it('surfaces the validation status for a spent code', async () => {
    arrangeInvite({ usedAt: new Date('2026-08-09T00:00:00Z') });

    await expect(acceptInvitation('ABCD1234', { id: 'u1' })).rejects.toMatchObject({ status: 409 });
    expect(grantDiagnosticsAccess).not.toHaveBeenCalled();
  });
});
