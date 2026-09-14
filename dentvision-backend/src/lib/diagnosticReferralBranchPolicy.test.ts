import { describe, expect, it } from 'vitest';

describe('diagnostic referral branch policy contract', () => {
  it('requires the same clinic and an active branch for scoped access', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('./diagnosticReferralBranchPolicy.ts', import.meta.url), 'utf8');
    expect(source).toContain("if (!resource.clinicId || !user.clinicId || user.clinicId !== resource.clinicId) return false");
    expect(source).toContain('if (!membership[0]) return false');
    expect(source).toContain('if (!resource.branchId) return false');
    expect(source).toContain('DIAGNOSTIC_REFERRAL_BRANCH_FORBIDDEN');
    expect(source).toContain('AND clinic_id = ${clinicId} AND active = true');
  });

  it('keeps organization roles explicit instead of introducing wildcard access', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('./diagnosticReferralBranchPolicy.ts', import.meta.url), 'utf8');
    expect(source).toContain("user.role === 'OWNER'");
    expect(source).toContain("user.role === 'ADMIN'");
    expect(source).toContain("user.role === 'ACCOUNTANT'");
    expect(source).not.toContain("user.role === '*'");
  });
});
