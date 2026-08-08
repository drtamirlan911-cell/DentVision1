import { describe, expect, it, vi } from 'vitest';

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

function makePerson(keys: string[]) {
  return {
    personRoles: [
      {
        role: {
          permissions: keys.map((key) => ({ permission: { key } })),
        },
      },
    ],
  };
}

describe('resolveUserPermissions', () => {
  it('returns DB-granted permissions for a scoped person', async () => {
    personFindFirst.mockResolvedValueOnce(makePerson(['patient.read', 'finance.manage']));
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(personFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', organizationId: 'org-1' } })
    );
    expect(result).toEqual(['patient.read', 'finance.manage']);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('deduplicates permission keys across roles', async () => {
    personFindFirst.mockResolvedValueOnce(
      makePerson(['patient.read', 'patient.read', 'bi.clinic'])
    );
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(result).toEqual(['patient.read', 'bi.clinic']);
  });

  it('falls back to the role matrix when no Person exists', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(result).toContain('finance.manage');
    expect(result).toContain('patient.read');
    expect(result).not.toContain('platform.analytics');
  });

  it('falls back to role matrix for SUPERADMIN (wildcard)', async () => {
    personFindFirst.mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ role: 'SUPERADMIN' });
    const result = await resolveUserPermissions('user-1');
    expect(result).toContain('platform.analytics');
    expect(result).toContain('bi.platform');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back to the role matrix when DB query throws', async () => {
    personFindFirst.mockRejectedValueOnce(new Error('db down'));
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(result).toContain('patient.write');
    expect(result).not.toContain('finance.manage');
  });

  it('falls back to the matrix when a person has an empty permission set', async () => {
    personFindFirst.mockResolvedValueOnce(makePerson([]));
    userFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    const result = await resolveUserPermissions('user-1', 'org-1');
    expect(result).toContain('finance.manage');
    expect(result).toContain('patient.read');
  });
});
