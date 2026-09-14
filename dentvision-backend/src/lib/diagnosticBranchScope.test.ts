import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('diagnostic branch scope contract', () => {
  it('keeps clinic diagnostic visibility fail-closed', () => {
    const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/diagnosticBranchScope.ts'), 'utf8');
    expect(source).toContain("new Set(['OWNER', 'ADMIN', 'ACCOUNTANT'])");
    expect(source).toContain('if (!membership[0])');
    expect(source).toContain('organizationWide: false');
    expect(source).toContain('branchIds: []');
    expect(source).toContain('if (!ctx.branchIds.length) return { clinicId: ctx.clinicId, branchId: null }');
    expect(source).toContain('if (!branchId) return false');
  });
});
