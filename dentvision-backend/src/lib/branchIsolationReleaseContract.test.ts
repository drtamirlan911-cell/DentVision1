import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('branch isolation release contract', () => {
  it('has explicit boundaries for the next operational domains', () => {
    const finance = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/financeBranchScope.ts'), 'utf8');
    const diagnostics = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/diagnosticBranchScope.ts'), 'utf8');
    const inventory = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/lib/inventoryBranchScope.ts'), 'utf8');
    expect(finance).toContain('resolveFinanceBranchContext');
    expect(diagnostics).toContain('resolveDiagnosticBranchContext');
    expect(inventory).toContain('resolveInventoryBranchContext');
    for (const source of [finance, diagnostics, inventory]) {
      expect(source).toContain('if (!branchId) return false');
      expect(source).toContain('branch_id'); expect(source).toContain('clinic_id');
    }
  });
});
