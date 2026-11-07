import { beforeEach, describe, expect, it, vi } from 'vitest';

const { userFindUnique, organizationFindFirst, personFindFirst, clinicMemberFindUnique, diagnosticCenterMemberFindFirst, laboratoryMemberFindFirst, clinicSubscriptionAccess } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  organizationFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
  diagnosticCenterMemberFindFirst: vi.fn(),
  laboratoryMemberFindFirst: vi.fn(),
  clinicSubscriptionAccess: vi.fn(),
}));

vi.mock('../billing/planEntitlements.js', () => ({ resolveClinicAccess: clinicSubscriptionAccess }));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    user: { findUnique: userFindUnique },
    organization: { findFirst: organizationFindFirst },
    person: { findFirst: personFindFirst },
    clinicMember: { findUnique: clinicMemberFindUnique },
    diagnosticCenterMember: { findFirst: diagnosticCenterMemberFindFirst },
    laboratoryMember: { findFirst: laboratoryMemberFindFirst },
  },
}));

import { canManageRolesFor, canAssignPlatformScope, ensureClinicSubscriptionWritableForOrganization } from './iam.routes.js';

const USER_ID = 'user-1';

beforeEach(() => {
  userFindUnique.mockReset();
  organizationFindFirst.mockReset();
  personFindFirst.mockReset();
  clinicMemberFindUnique.mockReset();
  diagnosticCenterMemberFindFirst.mockReset();
  laboratoryMemberFindFirst.mockReset();
  clinicSubscriptionAccess.mockReset();
});

describe('canManageRolesFor', () => {
  it('admits SUPERADMIN unconditionally, without any DB lookup', async () => {
    const result = await canManageRolesFor({ id: USER_ID, role: 'SUPERADMIN' }, null);
    expect(result).toBe(true);
    expect(organizationFindFirst).not.toHaveBeenCalled();
  });

  it('rejects when the person has no organization at all', async () => {
    const result = await canManageRolesFor({ id: USER_ID, role: 'DOCTOR' }, null);
    expect(result).toBe(false);
  });

  it('rejects a non-manager clinic member (e.g. DOCTOR)', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' },
    );
    expect(result).toBe(false);
  });

  it('admits a clinic OWNER', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    organizationFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'OWNER' },
      { id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' },
    );
    expect(result).toBe(true);
  });

  it('admits a clinic ADMIN', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    organizationFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'ADMIN' },
      { id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' },
    );
    expect(result).toBe(true);
  });

  it('rejects when the caller has no membership in the clinic at all', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce(null);
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' },
    );
    expect(result).toBe(false);
  });

  it('admits a diagnostic-center manager', async () => {
    diagnosticCenterMemberFindFirst.mockResolvedValueOnce({ role: 'admin' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'DIAGNOSTIC_CENTER', originalId: 'center-1' },
    );
    expect(result).toBe(true);
  });

  it('rejects a diagnostic-center member without a manager role', async () => {
    diagnosticCenterMemberFindFirst.mockResolvedValueOnce({ role: 'radiologist' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'DIAGNOSTIC_CENTER', originalId: 'center-1' },
    );
    expect(result).toBe(false);
  });

  it('admits a laboratory manager', async () => {
    laboratoryMemberFindFirst.mockResolvedValueOnce({ role: 'owner' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'LABORATORY', originalId: 'lab-1' },
    );
    expect(result).toBe(true);
  });
});


describe('ensureClinicSubscriptionWritableForOrganization', () => {
  const clinic = { id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' };

  it('allows non-clinic organization mutations without a clinic subscription lookup', async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const result = await ensureClinicSubscriptionWritableForOrganization({ user: { role: 'OWNER' } } as any, res, {
      id: 'org-2', type: 'DIAGNOSTIC_CENTER', originalId: 'center-1',
    });
    expect(result).toBe(true);
    expect(clinicSubscriptionAccess).not.toHaveBeenCalled();
  });

  it('blocks expired clinic staff-role mutations with SUBSCRIPTION_EXPIRED', async () => {
    clinicSubscriptionAccess.mockResolvedValueOnce({ writeBlocked: true });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const result = await ensureClinicSubscriptionWritableForOrganization({ user: { role: 'OWNER' } } as any, res, clinic);
    expect(result).toBe(false);
    expect(clinicSubscriptionAccess).toHaveBeenCalledWith('clinic-1');
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SUBSCRIPTION_EXPIRED' }));
  });

  it('fails closed when the clinic subscription cannot be verified', async () => {
    clinicSubscriptionAccess.mockRejectedValueOnce(new Error('database unavailable'));
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const result = await ensureClinicSubscriptionWritableForOrganization({ user: { role: 'OWNER' } } as any, res, clinic);
    expect(result).toBe(false);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CLINIC_ACCESS_UNVERIFIED' }));
  });

  it('keeps SUPERADMIN recovery independent of clinic subscription state', async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const result = await ensureClinicSubscriptionWritableForOrganization({ user: { role: 'SUPERADMIN' } } as any, res, clinic);
    expect(result).toBe(true);
    expect(clinicSubscriptionAccess).not.toHaveBeenCalled();
  });
});


describe('organization role scope policy', () => {
  it('allows platform-scoped role assignment only for SUPERADMIN', () => {
    expect(canAssignPlatformScope('SUPERADMIN')).toBe(true);
    expect(canAssignPlatformScope('OWNER')).toBe(false);
    expect(canAssignPlatformScope('ADMIN')).toBe(false);
  });

  it('rejects role management for an archived organization before checking membership', async () => {
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'OWNER' },
      { id: 'org-archived', type: 'DIAGNOSTIC_CENTER', originalId: 'center-archived', archivedAt: new Date('2026-10-01T00:00:00.000Z') },
    );
    expect(result).toBe(false);
    expect(diagnosticCenterMemberFindFirst).not.toHaveBeenCalled();
  });

  it('does not allow SUPERADMIN role management to mutate an archived organization context', async () => {
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'SUPERADMIN' },
      { id: 'org-archived', type: 'CLINIC', originalId: 'clinic-archived', archivedAt: new Date('2026-10-01T00:00:00.000Z') },
    );
    expect(result).toBe(false);
  });
});
