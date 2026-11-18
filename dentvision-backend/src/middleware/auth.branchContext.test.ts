import { describe, expect, it } from 'vitest';
import { isBranchContextRecoveryPath, isOrganizationBranchManagerRoleKey, mergeBranchIds, shouldUseLegacyClinicFallback } from './auth.js';

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
