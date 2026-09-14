import { describe, expect, it } from 'vitest';

describe('branch isolation release contract', () => {
  it('has explicit boundaries for the next operational domains', async () => {
    const fs = await import('node:fs/promises');
    const [finance, diagnostics, inventory] = await Promise.all([
      fs.readFile(new URL('./financeBranchScope.ts', import.meta.url), 'utf8'),
      fs.readFile(new URL('./diagnosticBranchScope.ts', import.meta.url), 'utf8'),
      fs.readFile(new URL('./inventoryBranchScope.ts', import.meta.url), 'utf8'),
    ]);

    expect(finance).toContain('resolveFinanceBranchContext');
    expect(diagnostics).toContain('resolveDiagnosticBranchContext');
    expect(inventory).toContain('resolveInventoryBranchContext');

    for (const source of [finance, diagnostics, inventory]) {
      expect(source).toContain('if (!branchId) return false');
      expect(source).toContain('branch_id');
      expect(source).toContain('clinic_id');
    }
  });
});
