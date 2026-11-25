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
    expect(source).toContain('const selectedBranchId = requestedBranchId === undefined');
    expect(source).toContain('user.branchId ?? user.assignedBranchId ?? null');
    expect(source).toContain('requestedBranchId: selectedBranchId');
    expect(source).not.toContain('context.branchIds[0] ||');
  });

  it('re-resolves an explicitly requested target branch before inventory creation', () => {
    expect(source).toContain('const context = await getBranchContext(req, clinicId, requested)');
    expect(source).toContain('const branchId = requested || context.branchId');
    expect(source).toContain('context.branchId !== branchId');
    expect(source).toContain('requestedBranchId: selectedBranchId');
  });

  it('requires an explicit or already-selected branch and never silently picks the first active branch', () => {
    expect(source).not.toContain('context.branchIds[0]');
    expect(source).toContain('if (!branchId || !context.branchIds.includes(branchId) || context.branchId !== branchId) return null;');
  });

  it('validates inventory transfer destinations independently through canonical IAM', () => {
    expect(source).toContain('const targetContext = await getBranchContext(req, clinicId, normalizedBranchId)');
    expect(source).toContain('targetContext.branchId !== normalizedBranchId');
    expect(source).toContain('...(targetBranchId !== undefined && { branchId: targetBranchId })');
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
