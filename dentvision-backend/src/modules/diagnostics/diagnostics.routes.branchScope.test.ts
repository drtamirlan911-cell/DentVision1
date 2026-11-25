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
    expect(source).toContain('Нет доступа к активному контексту клиники');
  });

  it('uses the authenticated allow-list plus an exact active legacy clinic assignment', () => {
    const start = source.indexOf('async function referralListBranchIds');
    const end = source.indexOf('export function requireReferralAccess', start);
    const resolver = source.slice(start, end);
    expect(resolver).toContain('resolveTrustedReferralBranchIds(user, clinicId)');
    expect(resolver).toContain('isActiveClinicContext(user, clinicId!)');
    expect(resolver).toContain('assertClinicOrgAccess(user, clinicId!)');
    expect(resolver).toContain('cm."userId" = ${user.id} AND cm."clinicId" = ${clinicId}');
    expect(resolver).toContain('COALESCE(b."active", false)');
    expect(resolver).toContain('WHERE "clinic_id" = ${clinicId} AND "active" = true');
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
    const end = source.indexOf("diagnosticsRouter.post('/referrals/:id/ai-result'", start);
    const dashboard = source.slice(start, end);
    expect(dashboard).toContain('const requestedScope = { clinicId: q.clinicId, centerId: q.centerId, labId: q.labId }');
    expect(dashboard).toContain('authorizeReferralListScope(req.user, requestedScope)');
    expect(dashboard).toContain('referralListBranchIds(req.user, requestedScope.clinicId)');
    expect(dashboard).toContain('branchIds !== undefined && branchIds.length === 0');
    expect(dashboard).toContain('svc.getDashboardStats({');
    expect(dashboard).toContain('...(branchIds !== undefined ? { branchIds } : {})');
  });
});
