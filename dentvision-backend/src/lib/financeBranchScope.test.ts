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


describe('clinic billing active branch filters', () => {
  it('uses only the authenticated active branch allow-list for owner invoice reads', async () => {
    const { financeInvoicePatientWhere, financePatientBranchWhere, financeBranchIdWhere } = await import('./financeBranchScope.js');
    expect(financeInvoicePatientWhere('OWNER', ['active-a', 'active-b'])).toEqual({
      patient: { branchId: { in: ['active-a', 'active-b'] } },
    });
    expect(financePatientBranchWhere('ACCOUNTANT', ['active-a'])).toEqual({
      branchId: { in: ['active-a'] },
    });
    expect(financeBranchIdWhere('OWNER', ['active-a'])).toEqual({
      branchId: { in: ['active-a'] },
    });
  });

  it('fails closed for clinic finance roles with an empty active branch allow-list', async () => {
    const { financeInvoicePatientWhere, financePatientBranchWhere, financeBranchIdWhere } = await import('./financeBranchScope.js');
    expect(financeInvoicePatientWhere('OWNER', [])).toEqual({ patient: { branchId: { in: [] } } });
    expect(financePatientBranchWhere('ADMIN', [])).toEqual({ branchId: { in: [] } });
    expect(financeBranchIdWhere('ACCOUNTANT', [])).toEqual({ branchId: { in: [] } });
  });

  it('keeps the explicit platform superadmin exception', async () => {
    const { financeInvoicePatientWhere, financePatientBranchWhere, financeBranchIdWhere } = await import('./financeBranchScope.js');
    expect(financeInvoicePatientWhere('SUPERADMIN', [])).toEqual({});
    expect(financePatientBranchWhere('SUPERADMIN', [])).toEqual({});
    expect(financeBranchIdWhere('SUPERADMIN', [])).toEqual({});
  });
});
