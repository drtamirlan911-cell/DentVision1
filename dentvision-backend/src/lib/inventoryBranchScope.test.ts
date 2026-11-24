import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock('./prisma.js', () => ({ default: { $queryRaw: queryRaw } }));

beforeEach(() => queryRaw.mockReset().mockResolvedValue([]));
import { inventoryBranchWhere, resolveInventoryBranchContext } from './inventoryBranchScope.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inventory branch scope contract', () => {
  it('keeps organization roles explicit', () => {
    const file = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/inventoryBranchScope.ts'), 'utf8');
    expect(file).toContain("new Set(['OWNER', 'ADMIN', 'ACCOUNTANT'])");
    expect(file).toContain('authorizedBranchIds');
    expect(file).toContain('ORGANIZATION_ROLES.has');
    expect(file).toContain('inventoryBranchWhere');
  });
  it('fails closed when no branch is assigned', () => {
    const file = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/inventoryBranchScope.ts'), 'utf8');
    expect(file).toContain('if (!branchIds.length) return []');
    expect(file).toContain('if (!branchId) return false');
  });
});

describe('inventory branch query allow-list', () => {
  it('applies the active branch allow-list even to organization-wide roles', () => {
    expect(inventoryBranchWhere({
      clinicId: 'clinic-a',
      role: 'OWNER',
      organizationWide: true,
      branchId: null,
      branchIds: ['active-a', 'active-b'],
    })).toEqual({
      clinicId: 'clinic-a',
      branchId: { in: ['active-a', 'active-b'] },
    });
  });

  it('fails closed when an organization has no active branches', () => {
    expect(inventoryBranchWhere({
      clinicId: 'clinic-a',
      role: 'ADMIN',
      organizationWide: true,
      branchId: null,
      branchIds: [],
    })).toEqual({
      clinicId: 'clinic-a',
      branchId: { in: [] },
    });
  });
});

describe('inventory branch context resolution', () => {
  it('uses the trusted active canonical branch allow-list and preserves it when legacy membership is absent', async () => {
    queryRaw.mockResolvedValueOnce([]);
    await expect(resolveInventoryBranchContext(
      'user-1',
      'clinic-a',
      'DOCTOR',
      ['active-a'],
      'active-a',
    )).resolves.toMatchObject({
      clinicId: 'clinic-a',
      role: 'DOCTOR',
      branchId: 'active-a',
      organizationWide: false,
      branchIds: ['active-a'],
    });
  });

  it('keeps organization roles limited to the authenticated active branch list', async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'active-a' }, { id: 'active-b' }]);
    await expect(resolveInventoryBranchContext(
      'owner-1',
      'clinic-a',
      'OWNER',
      ['active-a', 'active-b'],
      'active-b',
    )).resolves.toMatchObject({
      branchId: 'active-b',
      organizationWide: true,
      branchIds: ['active-a', 'active-b'],
    });
  });

  it('denies an empty canonical assignment instead of expanding to every clinic branch', async () => {
    queryRaw.mockResolvedValueOnce([]);
    await expect(resolveInventoryBranchContext(
      'doctor-1',
      'clinic-a',
      'DOCTOR',
      [],
      null,
    )).resolves.toMatchObject({
      branchId: null,
      organizationWide: false,
      branchIds: [],
    });
  });


  it('recovers only an active branch from exact legacy clinic membership', async () => {
    queryRaw.mockResolvedValueOnce([{ branch_id: 'legacy-a', branch_active: true }]);
    await expect(resolveInventoryBranchContext('doctor-a', 'clinic-a', 'DOCTOR', [], null))
      .resolves.toMatchObject({ branchId: 'legacy-a', branchIds: ['legacy-a'] });

    queryRaw.mockReset().mockResolvedValueOnce([{ branch_id: 'archived-a', branch_active: false }]);
    await expect(resolveInventoryBranchContext('doctor-a', 'clinic-a', 'DOCTOR', [], null))
      .resolves.toMatchObject({ branchId: null, branchIds: [] });
  });

  it('ignores a selected branch that is not in the authenticated active list', async () => {
    queryRaw.mockResolvedValueOnce([]);
    await expect(resolveInventoryBranchContext(
      'doctor-1',
      'clinic-a',
      'DOCTOR',
      ['active-a'],
      'archived-a',
    )).resolves.toMatchObject({
      branchId: 'active-a',
      branchIds: ['active-a'],
    });
  });
});
