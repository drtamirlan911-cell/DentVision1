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

  it.each([
    ['patient', true, false, false],
    ['student', true, false, false],
    ['support', true, false, false],
    ['partner without clinic schedule access', true, false, false],
  ])('hides CRM from %s contexts without schedule permission', (_role, isAuthenticated, isGuest, canAccessSchedule) => {
    expect(shouldShowClinicWorkspaceTab(isAuthenticated, isGuest, canAccessSchedule)).toBe(false);
  });
});
