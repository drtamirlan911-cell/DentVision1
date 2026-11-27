import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('analytics branch isolation contract', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'dentvision-backend/src/modules/analytics/analytics.routes.ts'),
    'utf8',
  );

  it('derives selected branch access from active clinic IAM membership', () => {
    expect(source).toContain("from '../../lib/clinicBranchAccess.js'");
    expect(source).toContain('await resolveClinicBranchAccess({');
    expect(source).toContain('organizationId: req.user?.organizationId');
    expect(source).toContain('requestedBranchId: req.user?.branchId');
    expect(source).not.toContain('req.user?.branchIds ?? []');
    expect(source).not.toContain('analyticsBranchIds(req)');
    expect(source).not.toContain('branchScope(req)');
  });

  it('keeps organization-wide analytics only when no branch is selected', () => {
    expect(source).toContain("access.roleScope === 'ORGANIZATION' && access.branchId === null");
    expect(source).toContain('branchIds: access.branchId ? [access.branchId] : access.allowedBranchIds');
    expect(source).toContain('if (context.organizationWide) return {};');
    expect(source).toContain("branchId: '__NO_BRANCH_ACCESS__'");
  });

  it('scopes dashboard patients, appointments, revenue and lab-order metrics', () => {
    expect(source).toContain('prisma.patient.count({ where: { clinicId, ...analyticsBranchWhere(branchContext) } })');
    expect(source).toContain('...analyticsBranchWhere(branchContext),');
    expect(source).toContain('const patientRelationFilter = patientBranch ? { patient: patientBranch } : {};');
    expect(source).toContain('...patientRelationFilter,');
  });

  it('scopes revenue and patient-growth SQL to the verified branch set', () => {
    expect(source).toContain('const branchIds = branchContext.organizationWide ? null : branchContext.branchIds');
    expect(source).toContain('p."branchId" = ANY(${branchIds}::text[])');
    expect(source).toContain('AND "branchId" = ANY(${branchIds}::text[])');
  });

  it('scopes doctor utilization appointment counts to the same active branch', () => {
    const doctorsStart = source.indexOf("analyticsRouter.get('/doctors'");
    const growthStart = source.indexOf("analyticsRouter.get('/patients-growth'");
    const doctorsRoute = source.slice(doctorsStart, growthStart);
    expect(doctorsRoute).toContain('const branchContext = await resolveAnalyticsBranchContext(req, clinicId)');
    expect(doctorsRoute).toContain('...analyticsBranchWhere(branchContext)');
  });
});
