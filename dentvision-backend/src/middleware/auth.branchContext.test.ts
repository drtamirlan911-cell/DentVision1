import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { branchMatchesOrganization, isBranchContextRecoveryPath, isOrganizationBranchManagerRoleKey, mergeBranchIds, shouldUseLegacyClinicFallback } from './auth.js';

const authSource = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/middleware/auth.ts'), 'utf8');

describe('mergeBranchIds', () => {
  it('combines universal and legacy branch assignments without duplicates', () => {
    expect(mergeBranchIds(['branch-a', 'branch-b'], ['branch-b', 'branch-c'])).toEqual([
      'branch-a',
      'branch-b',
      'branch-c',
    ]);
  });

  it('drops empty branch ids', () => {
    expect(mergeBranchIds(['', 'branch-a'], ['', 'branch-b'])).toEqual(['branch-a', 'branch-b']);
  });
});


describe('legacy clinic claim fallback', () => {
  it('does not override a verified active partner organization with a retained clinicId', () => {
    expect(shouldUseLegacyClinicFallback('org-diagnostic-center', null)).toBe(false);
    expect(shouldUseLegacyClinicFallback('org-laboratory', undefined)).toBe(false);
  });

  it('keeps the legacy clinic fallback when no organization or clinic context was resolved', () => {
    expect(shouldUseLegacyClinicFallback(null, null)).toBe(true);
    expect(shouldUseLegacyClinicFallback(undefined, undefined)).toBe(true);
  });

  it('does not re-resolve a clinic when a clinic context is already active', () => {
    expect(shouldUseLegacyClinicFallback('org-clinic', 'clinic-1')).toBe(false);
    expect(shouldUseLegacyClinicFallback(null, 'clinic-1')).toBe(false);
  });
});


describe('archived branch recovery policy', () => {
  it('allows identity/context recovery but not operational APIs', () => {
    expect(isBranchContextRecoveryPath('/api/auth/me')).toBe(true);
    expect(isBranchContextRecoveryPath('/api/auth/refresh')).toBe(true);
    expect(isBranchContextRecoveryPath('/api/auth/logout')).toBe(true);
    expect(isBranchContextRecoveryPath('/api/iam/me/contexts')).toBe(true);
    expect(isBranchContextRecoveryPath('/api/iam/switch-context')).toBe(true);
    expect(isBranchContextRecoveryPath('/api/patients')).toBe(false);
    expect(isBranchContextRecoveryPath('/api/appointments')).toBe(false);
    expect(isBranchContextRecoveryPath('/api/finance/invoices')).toBe(false);
  });

  it('recognizes organization owners/admins but not branch staff as archive managers', () => {
    expect(isOrganizationBranchManagerRoleKey('owner')).toBe(true);
    expect(isOrganizationBranchManagerRoleKey('diagnostic_owner')).toBe(true);
    expect(isOrganizationBranchManagerRoleKey('medical_lab_admin')).toBe(true);
    expect(isOrganizationBranchManagerRoleKey('doctor')).toBe(false);
    expect(isOrganizationBranchManagerRoleKey('employer_recruiter')).toBe(false);
  });
});


describe('organization-wide active branch context', () => {
  it('hydrates OWNER/ADMIN branch lists from active branches only', () => {
    const source = authSource;
    expect(source).toContain("if (['OWNER', 'ADMIN'].includes(String(effectiveRole).toUpperCase()))");
    expect(source).toContain('organizationWideBranchIds');
    expect(source).toContain('WHERE "organization_id" = ${effectiveOrgId} AND "active" = true');
    expect(source).toContain('WHERE "clinic_id" = ${effectiveClinicId} AND "active" = true');
    expect(source).toContain('mergeBranchIds(mergeBranchIds(unifiedBranchIds, legacyBranchIds), organizationWideBranchIds)');
  });
});


describe('legacy branch organization mapping', () => {
  it('accepts a clinic_id mapping only when organization_id is absent', () => {
    const clinic = { id: 'org-clinic', type: 'CLINIC', originalId: 'clinic-1' };
    expect(branchMatchesOrganization({ organizationId: 'org-clinic', clinicId: 'clinic-1' }, clinic)).toBe(true);
    expect(branchMatchesOrganization({ organizationId: null, clinicId: 'clinic-1' }, clinic)).toBe(true);
  });

  it('fails closed for a branch mapped to another organization or another clinic', () => {
    const clinic = { id: 'org-clinic', type: 'CLINIC', originalId: 'clinic-1' };
    expect(branchMatchesOrganization({ organizationId: 'org-other', clinicId: 'clinic-1' }, clinic)).toBe(false);
    expect(branchMatchesOrganization({ organizationId: null, clinicId: 'clinic-2' }, clinic)).toBe(false);
    expect(branchMatchesOrganization({ organizationId: null, clinicId: 'clinic-1' }, { id: 'org-lab', type: 'LABORATORY', originalId: 'clinic-1' })).toBe(false);
  });
});


describe('organization-wide active branch allow-list', () => {
  it('includes legacy clinic branches only when organization_id is null and clinic_id matches the clinic originalId', () => {
    expect(authSource).toContain('"organization_id" IS NULL AND "clinic_id" = ${effectiveOrgOriginalId}');
    expect(authSource).toContain('"organization_id" = ${effectiveOrgId}');
    expect(authSource).toContain('"active" = true');
  });
  it('accepts only an active legacy ClinicMember assignment for the selected clinic branch', () => {
    expect(authSource).toContain('membership.clinicId === person.organization.originalId');
    expect(authSource).toContain('membership.branchId === payload.branchId');
    expect(authSource).toContain('membership.branch?.active === true');
  });

});
