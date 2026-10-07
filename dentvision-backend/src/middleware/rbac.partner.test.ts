import { describe, expect, it, vi } from 'vitest';

const resolveUserPermissions = vi.fn();

vi.mock('../lib/resolvePermissions.js', () => ({ resolveUserPermissions }));
vi.mock('../lib/prisma.js', () => ({ default: {} }));

import { requirePermission } from './rbac.js';

function makeResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('partner permission baseline isolation', () => {
  it('does not pass the global OWNER/ASSISTANT role as a baseline for partner scopes', async () => {
    resolveUserPermissions.mockResolvedValueOnce(['supplier.manage']);

    const req = {
      user: {
        id: 'user-1',
        role: 'OWNER',
        organizationId: 'org-supplier',
        organizationType: 'SUPPLIER_COMPANY',
      },
      method: 'GET',
      path: '/supplier',
    } as any;
    const res = makeResponse();
    const next = vi.fn();

    await requirePermission('supplier.manage')(req, res as any, next);

    expect(resolveUserPermissions).toHaveBeenCalledWith('user-1', 'org-supplier', undefined);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps the role baseline for a canonical clinic scope', async () => {
    resolveUserPermissions.mockResolvedValueOnce(['patients.read']);

    const req = {
      user: {
        id: 'user-1',
        role: 'OWNER',
        organizationId: 'org-clinic',
        organizationType: 'CLINIC',
      },
      method: 'GET',
      path: '/patients',
    } as any;
    const res = makeResponse();
    const next = vi.fn();

    await requirePermission('patients.read')(req, res as any, next);

    expect(resolveUserPermissions).toHaveBeenCalledWith('user-1', 'org-clinic', 'OWNER');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
