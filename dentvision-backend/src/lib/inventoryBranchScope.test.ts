import { describe, expect, it } from 'vitest';
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
  it('uses the trusted active canonical branch allow-list without legacy membership lookups', async () => {
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

  it('ignores a selected branch that is not in the authenticated active list', async () => {
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
