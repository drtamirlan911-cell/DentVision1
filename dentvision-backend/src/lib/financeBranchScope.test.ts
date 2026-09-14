import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('finance branch scope contract', () => {
  it('keeps organization roles explicit and fail-closed', () => {
    const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/financeBranchScope.ts'), 'utf8');
    expect(source).toContain("new Set(['OWNER', 'ADMIN', 'ACCOUNTANT'])");
    expect(source).toContain('if (!membership[0])');
    expect(source).toContain('organizationWide: false, branchId: null, branchIds: []');
    expect(source).toContain('if (!ctx.branchIds.length) return { clinicId: ctx.clinicId, branchId: null }');
    expect(source).toContain('if (!branchId) return false');
  });
});
