import { describe, expect, it } from 'vitest';

import { shouldShowClinicWorkspaceTab } from './BottomNav';

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
