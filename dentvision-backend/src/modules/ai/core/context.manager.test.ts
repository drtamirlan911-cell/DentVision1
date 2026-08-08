import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveClinicAccess, resolveOrganizationIdForClinic, resolveUserPermissions } = vi.hoisted(() => ({
  resolveClinicAccess: vi.fn(),
  resolveOrganizationIdForClinic: vi.fn(),
  resolveUserPermissions: vi.fn(),
}));

vi.mock('../../../lib/orgContext.js', () => ({ resolveClinicAccess, resolveOrganizationIdForClinic }));
vi.mock('../../../lib/resolvePermissions.js', () => ({ resolveUserPermissions }));
vi.mock('../../../lib/prisma.js', () => ({ prisma: {} }));

import { ContextManager } from './context.manager.js';

beforeEach(() => {
  resolveClinicAccess.mockReset();
  resolveOrganizationIdForClinic.mockReset().mockResolvedValue('org-1');
  resolveUserPermissions.mockReset().mockResolvedValue([]);
});

describe('ContextManager.getCurrentPermissions', () => {
  it('grants wildcard access for SUPERADMIN without a permission lookup', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'SUPERADMIN' });

    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');

    expect(result).toEqual(['*']);
    expect(resolveUserPermissions).not.toHaveBeenCalled();
  });

  it('returns the real permission set instead of a private vocabulary', async () => {
    // Used to answer with `['patients:*', 'appointments:*', …]` — module names
    // that exist nowhere else in the platform.
    resolveClinicAccess.mockResolvedValueOnce({ role: 'ADMIN' });
    resolveUserPermissions.mockResolvedValueOnce(['patients.read', 'patients.write', 'appointments.write']);

    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');

    expect(result).toEqual(['patients.read', 'patients.write', 'appointments.write']);
  });

  it('scopes the lookup by organization id, not clinic id', async () => {
    // A clinic id matches no Person, so passing it through would silently fall
    // back to the role matrix on every call.
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
