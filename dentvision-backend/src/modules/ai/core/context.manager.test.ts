import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveClinicAccess, resolveOrganizationIdForClinic, resolveUserPermissions, userFindUnique, clinicFindUnique } = vi.hoisted(() => ({
  resolveClinicAccess: vi.fn(),
  resolveOrganizationIdForClinic: vi.fn(),
  resolveUserPermissions: vi.fn(),
  userFindUnique: vi.fn(),
  clinicFindUnique: vi.fn(),
}));

vi.mock('../../../lib/orgContext.js', () => ({ resolveClinicAccess, resolveOrganizationIdForClinic }));
vi.mock('../../../lib/resolvePermissions.js', () => ({ resolveUserPermissions }));
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    clinic: { findUnique: clinicFindUnique },
  },
}));

import { ContextManager } from './context.manager.js';

beforeEach(() => {
  resolveClinicAccess.mockReset();
  resolveOrganizationIdForClinic.mockReset().mockResolvedValue('org-1');
  resolveUserPermissions.mockReset().mockResolvedValue([]);
  userFindUnique.mockReset();
  clinicFindUnique.mockReset();
});

describe('ContextManager.loadContext', () => {
  it('fails closed when the caller has no clinic membership', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', role: 'DOCTOR' });
    clinicFindUnique.mockResolvedValue({ id: 'c1', name: 'Clinic' });
    resolveClinicAccess.mockResolvedValue(null);

    await expect(new ContextManager().loadContext('u1', 'c1')).rejects.toThrow('CLINIC_ACCESS_REQUIRED');
  });

  it('fails closed when the requested clinic does not exist', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', role: 'DOCTOR' });
    clinicFindUnique.mockResolvedValue(null);
    resolveClinicAccess.mockResolvedValue({ role: 'DOCTOR' });

    await expect(new ContextManager().loadContext('u1', 'c1')).rejects.toThrow('CLINIC_NOT_FOUND');
  });

  it('does not fall back to the global user role when clinic membership exists', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' });
    clinicFindUnique.mockResolvedValue({ id: 'c1', name: 'Clinic' });
    resolveClinicAccess.mockResolvedValue({ role: 'DOCTOR' });

    const result = await new ContextManager().loadContext('u1', 'c1');

    expect(result).toMatchObject({ userId: 'u1', clinicId: 'c1', role: 'DOCTOR' });
  });

  it('fails closed when the user record itself is missing', async () => {
    userFindUnique.mockResolvedValue(null);
    clinicFindUnique.mockResolvedValue({ id: 'c1', name: 'Clinic' });
    resolveClinicAccess.mockResolvedValue({ role: 'DOCTOR' });

    await expect(new ContextManager().loadContext('u1', 'c1')).rejects.toThrow('USER_NOT_FOUND');
  });
});

describe('ContextManager.getCurrentPermissions', () => {
  it('grants wildcard access for SUPERADMIN without a permission lookup', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'SUPERADMIN' });

    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');

    expect(result).toEqual(['*']);
    expect(resolveUserPermissions).not.toHaveBeenCalled();
  });

  it('returns the real permission set instead of a private vocabulary', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'ADMIN' });
    resolveUserPermissions.mockResolvedValueOnce(['patients.read', 'patients.write', 'appointments.write']);

    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');

    expect(result).toEqual(['patients.read', 'patients.write', 'appointments.write']);
  });

  it('scopes the lookup by organization id, not clinic id', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'DOCTOR' });

    await new ContextManager().getCurrentPermissions('u1', 'c1');

    expect(resolveOrganizationIdForClinic).toHaveBeenCalledWith('c1');
    expect(resolveUserPermissions).toHaveBeenCalledWith('u1', 'org-1', 'DOCTOR');
  });

  it('drives the fallback with the clinic-scoped role', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'CASHIER' });

    await new ContextManager().getCurrentPermissions('u1', 'c1');

    expect(resolveUserPermissions).toHaveBeenCalledWith('u1', 'org-1', 'CASHIER');
  });

  it('defaults to DOCTOR when no membership resolves — parity with prior behaviour', async () => {
    resolveClinicAccess.mockResolvedValueOnce(null);

    await new ContextManager().getCurrentPermissions('u1', 'c1');

    expect(resolveUserPermissions).toHaveBeenCalledWith('u1', 'org-1', 'DOCTOR');
  });

  it('still resolves when the clinic has no Organization row yet', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'DOCTOR' });
    resolveOrganizationIdForClinic.mockResolvedValueOnce(null);

    await new ContextManager().getCurrentPermissions('u1', 'c1');

    expect(resolveUserPermissions).toHaveBeenCalledWith('u1', null, 'DOCTOR');
  });
});
