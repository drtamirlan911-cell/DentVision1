import { describe, expect, it } from 'vitest';
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
