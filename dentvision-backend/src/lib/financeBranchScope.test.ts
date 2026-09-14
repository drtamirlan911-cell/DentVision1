import { describe, expect, it } from 'vitest';

describe('finance branch scope contract', () => {
  it('keeps organization roles explicit and fail-closed', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('./financeBranchScope.ts', import.meta.url), 'utf8');
    expect(source).toContain("new Set(['OWNER', 'ADMIN', 'ACCOUNTANT'])");
    expect(source).toContain('if (!ctx.branchIds.length) return { clinicId: ctx.clinicId, branchId: null }');
    expect(source).toContain('if (!branchId) return false');
  });
});
