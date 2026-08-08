import { describe, expect, it, vi } from 'vitest';

const { resolveClinicAccess } = vi.hoisted(() => ({
  resolveClinicAccess: vi.fn(),
}));

vi.mock('../../../lib/orgContext.js', () => ({ resolveClinicAccess }));
vi.mock('../../../lib/prisma.js', () => ({ prisma: {} }));

import { ContextManager } from './context.manager.js';

describe('ContextManager.getCurrentPermissions', () => {
  it('grants wildcard access for SUPERADMIN', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'SUPERADMIN' });
    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');
    expect(result).toEqual(['*']);
  });

  it('resolves permissions for a Person-only user (no ClinicMember row)', async () => {
    // Previously this fell straight to the DOCTOR default regardless of the
    // user's actual role, because getCurrentPermissions only checked
    // ClinicMember directly. resolveClinicAccess checks Person first.
    resolveClinicAccess.mockResolvedValueOnce({ role: 'ADMIN' });
    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');
    expect(result).toEqual(['patients:*', 'appointments:*', 'billing:*', 'inventory:*', 'reports:*']);
  });

  it('resolves permissions for a legacy ClinicMember-only user via the fallback path', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'LAB' });
    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');
    expect(result).toEqual(['lab-orders:*']);
  });

  it('grants OWNER wildcard access', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'OWNER' });
    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');
    expect(result).toEqual(['*']);
  });

  it('defaults to DOCTOR permissions when nothing is found — parity with prior behavior', async () => {
    resolveClinicAccess.mockResolvedValueOnce(null);
    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');
    expect(result).toEqual(['patients:read', 'appointments:*', 'medical:*', 'treatment-plans:*']);
  });

  it('returns an empty set for an unrecognized role', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'STUDENT' });
    const result = await new ContextManager().getCurrentPermissions('u1', 'c1');
    expect(result).toEqual([]);
  });
});
