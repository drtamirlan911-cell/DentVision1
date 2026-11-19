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

  it('does not reintroduce an archived legacy clinic-member branch into referral lists', () => {
    const start = source.indexOf('async function referralListBranchIds');
    const end = source.indexOf('export function requireReferralAccess', start);
    const resolver = source.slice(start, end);
    expect(resolver).toContain('LEFT JOIN "branches" b ON b."id" = cm."branch_id"');
    expect(resolver).toContain('COALESCE(b."active", false) AS branch_active');
    expect(resolver).toContain('membership[0].branch_active ? membership[0].branch_id : null');
  });

  it('keeps signed diagnostic results behind referral access', () => {
    expect(source).toContain("/referrals/:id/results/sign");
    expect(source).toContain('requireReferralAccess()');
    expect(source).toContain('saveAndSignResult');
  });
  it('uses the original laboratory/diagnostic entity id for partner organization scope', () => {
    expect(source).toContain('organizationOriginalId || user.organizationId');
  });
});


describe('diagnostics dashboard branch scope', () => {
  it('uses the same active branch list as the referral catalog and denies an empty clinic branch scope', () => {
    const start = source.indexOf("diagnosticsRouter.get('/dashboard'");
    const end = source.indexOf("diagnosticsRouter.post('/referrals'", start);
    const dashboard = source.slice(start, end);
    expect(dashboard).toContain('referralListBranchIds(req.user, scope.clinicId)');
    expect(dashboard).toContain('branchIds.length === 0');
    expect(dashboard).toContain('svc.getDashboardStats({ ...scope, branchIds })');
  });
});
