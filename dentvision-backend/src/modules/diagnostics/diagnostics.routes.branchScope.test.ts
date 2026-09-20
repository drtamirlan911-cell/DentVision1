import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts'), 'utf8');

describe('diagnostics referral branch enforcement', () => {
  it('loads and applies the shared branch policy to direct referral access', () => {
    expect(source).toContain("diagnosticReferralBranchPolicy.js");
    expect(source).toContain('canAccessReferralBranch');
    expect(source).toContain('branchId: true');
    expect(source).toContain('referralBranchAllowed');
  });

  it('does not allow unauthenticated laboratory creation', () => {
    expect(source).toContain("diagnosticsRouter.post('/laboratories', requireSuperadmin");
  });

  it('passes branch scope into referral list queries', () => {
    expect(source).toContain('referralListBranchIds');
    expect(source).toContain('branchIds');
    expect(source).toContain('Нет доступа к филиалам клиники');
  });

  it('keeps signed diagnostic results behind referral access', () => {
    expect(source).toContain("/referrals/:id/results/sign");
    expect(source).toContain('requireReferralAccess()');
    expect(source).toContain('saveAndSignResult');
  });
});
