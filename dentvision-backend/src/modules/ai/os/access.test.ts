import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  userFindUnique,
  resolveClinicAccess,
  resolveOrganizationIdForClinic,
  resolveUserPermissions,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  resolveClinicAccess: vi.fn(),
  resolveOrganizationIdForClinic: vi.fn(),
  resolveUserPermissions: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: { user: { findUnique: userFindUnique } },
}));
vi.mock('../../../lib/orgContext.js', () => ({ resolveClinicAccess, resolveOrganizationIdForClinic }));
vi.mock('../../../lib/resolvePermissions.js', () => ({ resolveUserPermissions }));

import { resolveAiToolAccess } from './access.js';

const USER_ID = 'user-1';
const CLINIC_ID = 'clinic-1';

/** The permission set the shared role matrix grants each legacy role. */
const PERMS = {
  OWNER: ['patients.read', 'patients.write', 'medical.read', 'medical.write', 'appointments.read',
    'appointments.write', 'billing.read', 'billing.write', 'billing.manage', 'inventory.read',
    'lab.read', 'analytics.read', 'shop.manage'],
  DOCTOR: ['patients.read', 'patients.write', 'medical.read', 'medical.write', 'appointments.read',
    'appointments.write', 'billing.read', 'inventory.read', 'lab.read', 'shop.read'],
  // A till-only permission set. No shipped role has this shape any more — a
  // cashier is an administrator in this product — but the gate must still hold
  // for it, and this is the narrowest set that exercises the money/PHI split.
  TILL_ONLY: ['patients.read', 'appointments.read', 'billing.read', 'billing.write', 'inventory.read', 'shop.read'],
  MANAGER: ['patients.read', 'appointments.read', 'medical.read', 'billing.read', 'inventory.read',
    'inventory.write', 'lab.read', 'staff.read', 'settings.manage', 'analytics.read', 'shop.read'],
};

const ORG_ID = 'org-1';

beforeEach(() => {
  userFindUnique.mockReset();
  resolveClinicAccess.mockReset();
  resolveOrganizationIdForClinic.mockReset();
  resolveUserPermissions.mockReset();
  resolveOrganizationIdForClinic.mockResolvedValue(ORG_ID);
});

function arrange(globalRole: string, clinicRole: string | null, perms: string[]) {
  userFindUnique.mockResolvedValue({ role: globalRole });
  resolveClinicAccess.mockResolvedValue(clinicRole ? { role: clinicRole } : null);
  resolveUserPermissions.mockResolvedValue(perms);
}

describe('resolveAiToolAccess — identity', () => {
  it('gives guests the static guest tool set without touching the database', async () => {
    const access = await resolveAiToolAccess({ userId: 'guest', isGuest: true });

    expect(access.role).toBe('GUEST');
    expect(access.clinicId).toBeNull();
    expect(access.allowed.has('navigate')).toBe(true);
    expect(access.allowed.has('searchPatients')).toBe(false);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('uses the clinic-scoped role, not the global User.role', async () => {
    // Legacy column says OWNER; in this clinic the person is only a DOCTOR.
    arrange('OWNER', 'DOCTOR', PERMS.DOCTOR);

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(access.role).toBe('DOCTOR');
    expect(access.allowed.has('createInvoice')).toBe(false); // OWNER-only tool
    expect(access.allowed.has('getPatientCard')).toBe(true);
  });

  it('refuses a clinic scope the user is not a member of', async () => {
    arrange('DOCTOR', null, PERMS.DOCTOR);

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: 'someone-elses-clinic' });

    // No verified scope — tools that call requireClinic() get nothing to read.
    expect(access.clinicId).toBeNull();
    expect(resolveClinicAccess).toHaveBeenCalledWith(USER_ID, 'someone-elses-clinic');
  });

  it('resolves the role from the database, ignoring the caller-supplied claim', async () => {
    arrange('DOCTOR', 'ASSISTANT', ['patients.read', 'appointments.read', 'appointments.write', 'medical.read']);

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(userFindUnique).toHaveBeenCalledWith({ where: { id: USER_ID }, select: { role: true } });
    expect(access.role).toBe('ASSISTANT');
  });

  it('scopes the permission lookup by organization id, not by clinic id', async () => {
    // `resolveUserPermissions` matches a Person by `organizationId`. A clinic id
    // is a different value, so passing one straight through made the Person
    // lookup miss every time and every AI tool decision silently fell back to
    // the hardcoded role matrix — the DB permission graph never contributed.
    arrange('OWNER', 'DOCTOR', PERMS.DOCTOR);

    await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(resolveOrganizationIdForClinic).toHaveBeenCalledWith(CLINIC_ID);
    expect(resolveUserPermissions).toHaveBeenCalledWith(USER_ID, ORG_ID, 'DOCTOR');
  });

  it('falls back to the clinic id when the clinic has no mirrored organization', async () => {
    // Not every clinic has been mirrored yet. Passing the clinic id on is no
    // worse than before — the matrix answers — and it keeps the caller working.
    arrange('OWNER', 'DOCTOR', PERMS.DOCTOR);
    resolveOrganizationIdForClinic.mockResolvedValue(null);

    await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(resolveUserPermissions).toHaveBeenCalledWith(USER_ID, CLINIC_ID, 'DOCTOR');
  });

  it('treats an unknown user as a guest rather than falling back to a role string', async () => {
    userFindUnique.mockResolvedValue(null);

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(access.role).toBe('GUEST');
    expect(access.allowed.has('searchPatients')).toBe(false);
  });

  it('passes SUPERADMIN through without a membership lookup', async () => {
    userFindUnique.mockResolvedValue({ role: 'SUPERADMIN' });

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(access.role).toBe('SUPERADMIN');
    expect(access.clinicId).toBe(CLINIC_ID);
    expect(resolveClinicAccess).not.toHaveBeenCalled();
  });
});

describe('resolveAiToolAccess — permission gate', () => {
  it('keeps the full surface for a role whose permissions cover it', async () => {
    arrange('OWNER', 'OWNER', PERMS.OWNER);

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    for (const tool of ['searchPatients', 'getPatientCard', 'createAppointment', 'createInvoice', 'getRevenue']) {
      expect(access.allowed.has(tool)).toBe(true);
    }
  });

  it('denies a till-only permission set the medical card and appointment writes the REST routes also deny', async () => {
    arrange('ADMIN', 'ADMIN', PERMS.TILL_ONLY);

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(access.allowed.has('getPatientCard')).toBe(false); // medical.read
    expect(access.allowed.has('getVisits')).toBe(false);
    expect(access.allowed.has('createAppointment')).toBe(false); // appointments.write
    // …while the tools a till operator legitimately needs stay available.
    expect(access.allowed.has('searchPatients')).toBe(true);
    expect(access.allowed.has('getSchedule')).toBe(true);
    expect(access.allowed.has('createInvoice')).toBe(true);
  });

  it('denies a manager the write tools the role matrix withholds', async () => {
    arrange('MANAGER', 'MANAGER', PERMS.MANAGER);

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(access.allowed.has('createAppointment')).toBe(false);
    expect(access.allowed.has('createInvoice')).toBe(false);
    expect(access.allowed.has('getDashboardStats')).toBe(true);
    expect(access.allowed.has('getRevenue')).toBe(true);
  });

  it('never gates catalog and navigation tools', async () => {
    arrange('ADMIN', 'ADMIN', PERMS.TILL_ONLY);

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(access.allowed.has('navigate')).toBe(true);
    expect(access.allowed.has('searchProducts')).toBe(true);
  });

  it('cannot widen the registry — a permission the role has is useless without an agent', async () => {
    // Lab-only staff hold lab.read, but no agent offers them the finance tools.
    arrange('LAB', 'LAB', ['patients.read', 'appointments.read', 'lab.read', 'inventory.read', 'shop.read']);

    const access = await resolveAiToolAccess({ userId: USER_ID, clinicId: CLINIC_ID });

    expect(access.allowed.has('getLabOrders')).toBe(true);
    expect(access.allowed.has('getRevenue')).toBe(false);
  });
});
