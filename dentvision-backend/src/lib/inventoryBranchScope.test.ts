import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { resolveClinicBranchAccess, queryRaw } = vi.hoisted(() => ({
  resolveClinicBranchAccess: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock('./clinicBranchAccess.js', () => ({ resolveClinicBranchAccess }));
vi.mock('./prisma.js', () => ({ default: { $queryRaw: queryRaw } }));

import {
  assertInventoryBranch,
  getInventoryIdsForBranches,
  resolveInventoryBranchContext,
} from './inventoryBranchScope.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveInventoryBranchContext', () => {
  it('preserves organization-wide inventory access only when no branch is selected', async () => {
    resolveClinicBranchAccess.mockResolvedValue({
      roleScope: 'ORGANIZATION',
      branchId: null,
      allowedBranchIds: ['branch-a', 'branch-b'],
    });

    await expect(resolveInventoryBranchContext('user-a', 'clinic-a', 'OWNER', {
      organizationId: 'org-a',
      requestedBranchId: null,
    })).resolves.toEqual({
      clinicId: 'clinic-a',
      role: 'OWNER',
      branchId: null,
      organizationWide: true,
      branchIds: ['branch-a', 'branch-b'],
    });
    expect(resolveClinicBranchAccess).toHaveBeenCalledWith({
      userId: 'user-a',
      clinicId: 'clinic-a',
      organizationId: 'org-a',
      role: 'OWNER',
      requestedBranchId: null,
    });
  });

  it('narrows an organization role to the selected active branch', async () => {
    resolveClinicBranchAccess.mockResolvedValue({
      roleScope: 'ORGANIZATION',
      branchId: 'branch-b',
      allowedBranchIds: ['branch-a', 'branch-b'],
    });

    await expect(resolveInventoryBranchContext('user-a', 'clinic-a', 'OWNER', {
      organizationId: 'org-a',
      requestedBranchId: 'branch-b',
    })).resolves.toEqual({
      clinicId: 'clinic-a',
      role: 'OWNER',
      branchId: 'branch-b',
      organizationWide: false,
      branchIds: ['branch-b'],
    });
  });

  it('uses only the resolved branch for a branch-scoped role', async () => {
    resolveClinicBranchAccess.mockResolvedValue({
      roleScope: 'ASSIGNED',
      branchId: 'branch-a',
      allowedBranchIds: ['branch-a'],
    });

    await expect(resolveInventoryBranchContext('user-a', 'clinic-a', 'DOCTOR')).resolves.toMatchObject({
      organizationWide: false,
      branchId: 'branch-a',
      branchIds: ['branch-a'],
    });
  });

  it('fails closed when canonical or legacy membership cannot be resolved', async () => {
    resolveClinicBranchAccess.mockResolvedValue(null);

    await expect(resolveInventoryBranchContext('user-a', 'clinic-a', 'MANAGER')).resolves.toBeNull();
  });
});

describe('inventory branch resource guards', () => {
  it('rejects a missing branch without querying the database', async () => {
    await expect(assertInventoryBranch(null, 'clinic-a')).resolves.toBe(false);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('accepts active branches linked through the canonical clinic organization', async () => {
    queryRaw.mockResolvedValue([{ id: 'branch-canonical' }]);

    await expect(assertInventoryBranch('branch-canonical', 'clinic-a', 'org-a')).resolves.toBe(true);

    const [sql, ...values] = queryRaw.mock.calls[0];
    expect(sql.join('?')).toContain('organizations');
    expect(sql.join('?')).toContain('organization_id');
    expect(values).toContain('org-a');
    expect(values).toContain('clinic-a');
  });

  it('returns no inventory identifiers for an empty branch set', async () => {
    await expect(getInventoryIdsForBranches('clinic-a', [])).resolves.toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});

describe('inventory route selected-branch contract', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'dentvision-backend/src/modules/inventory/inventory.routes.ts'),
    'utf8',
  );

  it('passes the active organization and selected branch into the shared resolver', () => {
    expect(source).toContain('organizationId: user.organizationId');
    expect(source).toContain('requestedBranchId: user.branchId');
    expect(source).not.toContain('context.branchIds[0] ||');
  });

  it('uses only a selected or unambiguous configured default for organization-wide writes', () => {
    expect(source).toContain('requested || context.branchId');
    expect(source).toContain('await resolveUnambiguousWriteBranch(context.branchIds)');
    expect(source).not.toContain('context.branchIds[0]');
    expect(source).toContain('if (!context.organizationWide && context.branchId !== branchId) return null;');
    expect(source).toContain('if (!branchId || !context.branchIds.includes(branchId)) return null;');
  });

  it('restricts organization-wide reads to the currently active branch allow-list', () => {
    expect(source).toContain('return { clinicId: context.clinicId, branchId: { in: context.branchIds } };');
  });

  it('scopes item reads, movements, adjustments and deletes through scopedWhere', () => {
    expect(source).toContain('prisma.inventoryItem.findMany({ where,');
    expect(source).toContain('where: { id, ...scopedWhere(context) }');
    expect(source).toContain('deleteMany({ where: { id, ...scopedWhere(context) } })');
  });
});