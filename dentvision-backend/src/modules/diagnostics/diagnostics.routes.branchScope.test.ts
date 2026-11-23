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

  it('resolves the referral list branch filter from active IAM and selected branch', () => {
    expect(source).toContain('referralListBranchIds');
    expect(source).toContain('resolveClinicBranchAccess({');
    expect(source).toContain('organizationId: user.organizationId');
    expect(source).toContain('requestedBranchId: user.branchId');
    expect(source).not.toContain('user.branchIds ?? []');
    expect(source).toContain('if (!access) return []');
    expect(source).toContain('return access.branchId ? [access.branchId] : access.allowedBranchIds');
    expect(source).toContain('Нет доступа к филиалам клиники');
  });

  it('verifies the selected doctor belongs to the referral patient branch', () => {
    expect(source).toContain('const doctorBranchAccess = await resolveClinicBranchAccess({');
    expect(source).toContain('requestedBranchId: targetBranchId');
    expect(source).toContain('doctorBranchAccess.allowedBranchIds.includes(targetBranchId)');
    expect(source).toContain('Указанный врач не имеет доступа к филиалу пациента');
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
