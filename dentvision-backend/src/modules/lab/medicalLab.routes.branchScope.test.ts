import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('medical lab branch isolation contract', () => {
  const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/lab/medicalLab.routes.ts'), 'utf8');

  it('checks branch membership for clinic medical-lab orders', () => {
    expect(source).toContain('user?.branchIds ?? []');
    expect(source).toContain('o."clinicId" = $1');
    expect(source).not.toContain('o."clinicId" = ${args.length}');
    expect(source).toContain('o."labId" = $1');
    expect(source).not.toContain('o."labId" = ${args.length}');
    expect(source).toContain('branchId: { in: branchIds }');
    expect(source).toContain('p."branchId" = ANY(${args.length}::text[])');
  });

  it('keeps optional medical-lab order filters bound after the tenant scope parameter', () => {
    expect(source).toContain('o."patientId" = $${args.length}');
    expect(source).toContain('o."treatmentCaseId" = $${args.length}');
    expect(source).toContain('o."status" = $${args.length}');
  });

  it('blocks creation from patients outside the current branch set', () => {
    expect(source).toContain('__NO_BRANCH_ACCESS__');
  });


  it('uses the canonical Clinic.id → Organization.id resolver for clinic-scoped access', () => {
    expect(source).toContain("import { assertClinicOrgAccess } from '../../lib/orgContext.js';");
    expect(source).toContain('assertClinicOrgAccess(user!, order.clinicId)');
    expect(source).toContain('assertClinicOrgAccess(req.user!, clinicId)');
    expect(source).not.toContain('assertOrgAccess(user!, order.clinicId)');
    expect(source).not.toContain('assertOrgAccess(req.user!, clinicId)');
  });

  it('resolves laboratory scope from the original organization entity id', () => {
    expect(source).toContain('organizationOriginalId ||');
  });

  it('exposes the team directory only through the active laboratory staff.read capability', () => {
    expect(source).toContain("medicalLabLifecycleRouter.get('/team'");
    expect(source).toContain("requireMedicalLabCapability(req.user, 'staff.read')");
    expect(source).toContain('prisma.laboratoryMember.findMany');
    expect(source).toContain('firstName: member.user.firstName');
    expect(source).toContain('userId: member.userId');
    const teamRoute = source.slice(source.indexOf("medicalLabLifecycleRouter.get('/team'"), source.indexOf("medicalLabLifecycleRouter.get('/finance'"));
    expect(teamRoute).not.toContain('req.query.labId');
    expect(teamRoute).not.toContain('req.body.labId');
    expect(teamRoute).not.toContain('req.body.organizationId');
  });

  it('scopes the team directory to the active laboratory and staff.read role', () => {
    const teamStart = source.indexOf("medicalLabLifecycleRouter.get('/team'");
    const teamEnd = source.indexOf("medicalLabLifecycleRouter.get('/finance'", teamStart);
    const teamRoute = source.slice(teamStart, teamEnd);
    expect(teamRoute).toContain("requireMedicalLabCapability(req.user, 'staff.read')");
    expect(teamRoute).toContain('resolveLaboratoryScopeId(req.user)');
    expect(teamRoute).toContain('where: { labId }');
    expect(teamRoute).toContain('include: {');
    expect(teamRoute).not.toContain('req.query.labId');
    expect(teamRoute).not.toContain('req.body.labId');
  });

  it('exposes medical-lab finance only through the active laboratory role capabilities', () => {
    expect(source).toContain("medicalLabLifecycleRouter.get('/capabilities'");
    expect(source).toContain("medicalLabLifecycleRouter.get('/finance'");
    expect(source).toContain("medicalLabLifecycleRouter.post('/payouts'");
    expect(source).toContain("requireMedicalLabCapability(req.user, 'finance.read')");
    expect(source).toContain("requireMedicalLabCapability(req.user, 'finance.manage')");
    expect(source).toContain("getOrCreateWallet('PARTNER', labId)");
    expect(source).toContain("getPartnerEconomicsTransparency({ vertical: 'MEDICAL_ANALYSIS', partnerId: labId })");
    expect(source).toContain("prisma.$transaction(async (tx) =>");
    expect(source).toContain("requestPayout({ ownerType: 'PARTNER', ownerId: labId, amountMinor }, tx)");
    expect(source).toContain("action: 'MEDICAL_LAB_PAYOUT_REQUESTED'");
    expect(source).toContain('}, tx);');
    const payoutRoute = source.slice(source.indexOf("medicalLabLifecycleRouter.post('/payouts'"), source.indexOf("medicalLabLifecycleRouter.get('/orders'"));
    expect(payoutRoute).toContain('parseTengeToMinor(rawAmount)');
    expect(payoutRoute).toContain('MEDICAL_LAB_PAYOUT_REQUESTED');
    expect(payoutRoute).not.toContain('req.body.labId');
    expect(payoutRoute).not.toContain('req.body.ownerId');
  });
});
