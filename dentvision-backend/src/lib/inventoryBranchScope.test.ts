import { describe, expect, it } from 'vitest';
import { inventoryBranchWhere } from './inventoryBranchScope.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('inventory branch scope contract', () => {
  it('keeps organization roles explicit', () => {
    const file = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/inventoryBranchScope.ts'), 'utf8');
    expect(file).toContain("new Set(['OWNER', 'ADMIN', 'ACCOUNTANT'])");
    expect(file).toContain('branch_id');
    expect(file).toContain('clinic_id = ${clinicId}');
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
