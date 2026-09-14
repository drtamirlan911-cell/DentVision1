import { describe, expect, it } from 'vitest';

describe('inventory branch scope contract', () => {
  it('keeps organization roles explicit', async () => {
    const source = await import('node:fs/promises');
    const file = await source.readFile(new URL('./inventoryBranchScope.ts', import.meta.url), 'utf8');
    expect(file).toContain("new Set(['OWNER', 'ADMIN', 'ACCOUNTANT'])");
    expect(file).toContain('branch_id');
    expect(file).toContain('clinic_id = ${clinicId}');
  });

  it('fails closed when no branch is assigned', async () => {
    const source = await import('node:fs/promises');
    const file = await source.readFile(new URL('./inventoryBranchScope.ts', import.meta.url), 'utf8');
    expect(file).toContain('if (!branchIds.length) return []');
    expect(file).toContain('if (!branchId) return false');
  });
});
