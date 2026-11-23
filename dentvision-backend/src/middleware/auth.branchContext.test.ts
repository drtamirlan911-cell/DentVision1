import { describe, expect, it } from 'vitest';
import { mergeBranchIds, resolveAssignedBranchId, shouldUseLegacyClinicFallback } from './auth.js';

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


describe('assigned branch selector', () => {
  it('uses the only canonical branch when membership is unambiguous', () => {
    expect(resolveAssignedBranchId(['branch-a'], 'legacy-branch')).toBe('branch-a');
  });

  it('does not silently pick the first branch when canonical membership spans several branches', () => {
    expect(resolveAssignedBranchId(['branch-a', 'branch-b'], 'legacy-branch')).toBeUndefined();
  });

  it('keeps the legacy ClinicMember branch fallback for pre-canonical clinics', () => {
    expect(resolveAssignedBranchId([], 'legacy-branch')).toBe('legacy-branch');
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
