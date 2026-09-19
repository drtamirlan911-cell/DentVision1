import { beforeEach, describe, expect, it, vi } from 'vitest';

const { personFindFirst, userFindUnique } = vi.hoisted(() => ({
  personFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  default: {
    person: { findFirst: personFindFirst },
    user: { findUnique: userFindUnique },
  },
}));

import { resolveUserPermissions } from './resolvePermissions.js';

function makePerson(keys: string[], scopedRoles: Array<{ scopeId?: string | null; keys: string[] }> = []) {
  return {
    personRoles: [
      {
        role: {
          permissions: keys.map((key) => ({ permission: { key } })),
        },
      },
      ...scopedRoles.map(({ scopeId = null, keys: roleKeys }) => ({
        scopeId,
        role: { permissions: roleKeys.map((key) => ({ permission: { key } })) },
      })),
    ],
  };
}

describe('resolveUserPermissions', () => {
  beforeEach(() => {
    personFindFirst.mockReset();
    userFindUnique.mockReset();
  });

  it('returns DB-granted permissions for a scoped person', async () => {
    personFindFirst.mockResolvedValueOnce(makePerson(['patients.read', 'billing.manage']));
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', organizationId: 'org-1' } })
    );
    expect(result).toEqual(['patients.read', 'billing.manage']);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('deduplicates permission keys across roles', async () => {
    personFindFirst.mockResolvedValueOnce(
      makePerson(['patients.read', 'patients.read', 'bi.read'])
    );
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(result).toEqual(['patients.read', 'bi.read']);
  });

  it('falls back to the role matrix when no Person exists', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(result).toContain('billing.manage');
    expect(result).toContain('patients.read');
    expect(result).not.toContain('admin.read');
  });

  it('uses the global role baseline for an unscoped person with sparse DB grants', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    personFindFirst.mockResolvedValueOnce(makePerson(['patients.read']));
    const result = await resolveUserPermissions('user-1');
    expect(result).toContain('patients.read');
    expect(result).toContain('billing.manage');
    expect(result).toContain('staff.manage');
  });

  it('falls back to role matrix for SUPERADMIN (wildcard)', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ role: 'SUPERADMIN' });
    const result = await resolveUserPermissions('user-1');
    expect(result).toEqual(['*']);
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back to the role matrix when DB query throws', async () => {
    personFindFirst.mockRejectedValueOnce(new Error('db down'));
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(result).toContain('patients.write');
    expect(result).not.toContain('billing.manage');
  });

  it('falls back to the matrix when a person has an empty permission set', async () => {
    personFindFirst.mockResolvedValueOnce(makePerson([]));
    userFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(result).toContain('billing.manage');
    expect(result).toContain('patients.read');
  });
});


describe('organization scope isolation', () => {
  it('does not import permissions from another organization', async () => {
    personFindFirst.mockResolvedValueOnce(
      makePerson([], [
        { scopeId: 'org-1', keys: ['patients.read'] },
        { scopeId: 'org-2', keys: ['billing.manage'] },
      ])
    );
    const result = await resolveUserPermissions('user-1', 'org-1', 'DOCTOR');
    expect(result).toContain('patients.read');
    expect(result).not.toContain('billing.manage');
    expect(result).toContain('medical.manage');
  });
});
