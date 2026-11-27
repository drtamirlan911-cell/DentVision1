describe('resolveBottomNavWorkspaceHomePath', () => {
  it('returns the active supplier cabinet instead of the clinic workspace', () => {
    expect(resolveBottomNavWorkspaceHomePath({
      scopeType: 'SUPPLIER', roleKey: 'supplier.manager',
    })).toBe('/supplier');
  });

  it('returns the dental-lab QC specialist to the quality queue', () => {
    expect(resolveBottomNavWorkspaceHomePath({
      scopeType: 'LABORATORY', roleKey: 'qc_specialist',
    })).toBe('/diagnostics/lab?workspace=dental-lab&tab=quality');
  });

  it('returns diagnostic finance staff to the cashier tab', () => {
    expect(resolveBottomNavWorkspaceHomePath({
      scopeType: 'DIAGNOSTIC_CENTER', roleKey: 'diagnostic_finance',
    })).toBe('/diagnostics/center?tab=cashier');
  });

  it('returns medical-lab finance staff to the finance tab', () => {
    expect(resolveBottomNavWorkspaceHomePath({
      scopeType: 'LABORATORY', roleKey: 'medical_lab_finance',
    })).toBe('/diagnostics/lab?workspace=medical-lab&tab=finance');
  });

  it('returns a clinic cashier to the cashier when the active IAM pages allow it', () => {
    expect(resolveBottomNavWorkspaceHomePath({
      scopeType: 'CLINIC', roleKey: 'clinic.cashier',
    }, ['cashier', 'billing'])).toBe('/crm/cashier');
  });

  it('does not invent a destination when no active workspace is selected', () => {
    expect(resolveBottomNavWorkspaceHomePath(null, ['schedule'])).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { resolveBottomNavWorkspaceHomePath, shouldShowClinicWorkspaceTab } from './BottomNav';

describe('shouldShowClinicWorkspaceTab', () => {
  it('keeps the clinic demo entry available to unauthenticated visitors', () => {
    expect(shouldShowClinicWorkspaceTab(false, false, false)).toBe(true);
  });

  it('keeps the demo entry available in guest mode', () => {
    expect(shouldShowClinicWorkspaceTab(true, true, false)).toBe(true);
  });

  it('shows CRM to authenticated users with schedule access', () => {
    expect(shouldShowClinicWorkspaceTab(true, false, true)).toBe(true);
  });

  it('hides CRM from the patient context without schedule permission', () => {
    expect(shouldShowClinicWorkspaceTab(true, false, false)).toBe(false);
  });

  it('hides CRM from the student context without schedule permission', () => {
    expect(shouldShowClinicWorkspaceTab(true, false, false)).toBe(false);
  });

  it('hides CRM from support and partner contexts without schedule permission', () => {
    expect(shouldShowClinicWorkspaceTab(true, false, false)).toBe(false);
  });
});
