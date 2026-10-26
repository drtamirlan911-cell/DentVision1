import { describe, expect, it } from 'vitest';

import {
  MODULE_PAGES,
  capabilitiesForPermissions,
  pagesForPermissions,
  pagesForCaller,
  permissionsForRole,
} from './permissions.js';

describe('pagesForPermissions', () => {
  it('keeps STUDENT on learner pages instead of inheriting global partner pages', () => {
    expect(pagesForCaller([], 'STUDENT')).toEqual(['shop', 'school', 'profile', 'help', 'notifications']);
  });


  it('keeps platform roles out of clinical and supplier tenants even with wildcard permissions', () => {
    const superadmin = pagesForCaller(['*'], 'SUPERADMIN');
    expect(superadmin).toContain('admin');
    expect(superadmin).not.toContain('schedule');
    expect(superadmin).not.toContain('supplier');
    expect(superadmin).toContain('support');
    expect(superadmin).not.toContain('diagnostics-referrals');
    const support = pagesForCaller(['*'], 'SUPPORT');
    expect(support).toContain('help');
    expect(support).toContain('analytics');
    expect(support).not.toContain('admin');
    expect(support).not.toContain('schedule');
  });

  it('keeps read-only billing from exposing cashier and finance pages', () => {
    const pages = pagesForPermissions(['billing.read']);
    expect(pages).toContain('pricelist');
    expect(pages).not.toContain('cashier');
    expect(pages).not.toContain('finance');
    expect(pages).not.toContain('billing');
  });

  it('keeps BI out of clinic admin and manager roles', () => {
    expect(pagesForCaller(permissionsForRole('ADMIN'), 'ADMIN')).not.toContain('bi');
    expect(pagesForCaller(permissionsForRole('MANAGER'), 'MANAGER')).not.toContain('bi');
  });

  it('keeps the legacy laboratory role out of clinic scheduling', () => {
    expect(pagesForCaller(permissionsForRole('LAB'), 'LAB')).not.toContain('schedule');
  });

  it('expands the wildcard to every known page', () => {
    const all = new Set(Object.values(MODULE_PAGES).flat());
    expect(new Set(pagesForPermissions(['*']))).toEqual(all);
  });

  it('maps a module permission to that module’s pages', () => {
    expect(pagesForPermissions(['inventory.read'])).toEqual(['inventory', 'profile']);
    expect(pagesForPermissions(['appointments.read'])).toEqual(['schedule', 'reminders', 'profile']);
  });

  it('unions pages across permissions without duplicating', () => {
    const pages = pagesForPermissions(['appointments.read', 'appointments.write', 'inventory.read']);
    expect(pages).toEqual([...new Set(pages)]);
    expect(pages).toContain('schedule');
    expect(pages).toContain('inventory');
    expect(pages).toContain('profile');
  });

  it('grants nothing for an empty permission set', () => {
    expect(pagesForPermissions([])).toEqual([]);
  });

  it('maps community permissions to the community page', () => {
    expect(pagesForPermissions(['community.read'])).toEqual(['community', 'profile']);
  });

  it('maps settings.manage to clinic settings only, not personal settings', () => {
    // The personal `settings` screen used to sit in this module too, so
    // reaching it required settings.manage — the same key that gates the
    // workflow write routes. It is part of the authenticated baseline now.
    expect(pagesForPermissions(['settings.manage', 'audit.read'])).toEqual(
      expect.arrayContaining(['clinic-settings', 'audit']),
    );
    expect(pagesForPermissions(['settings.manage'])).not.toContain('settings');
  });

  it('never shows the admin console to a clinic role', () => {
    expect(pagesForPermissions(permissionsForRole('OWNER'))).not.toContain('admin');
    expect(pagesForPermissions(permissionsForRole('SUPERADMIN'))).toContain('admin');
  });
});

describe('capabilitiesForPermissions', () => {
  it('derives flags from the permission set', () => {
    const caps = capabilitiesForPermissions(['staff.read', 'analytics.read'], 'MANAGER');

    expect(caps.canSeeSalary).toBe(true);
    expect(caps.canSeeReports).toBe(true);
    expect(caps.canAddStaff).toBe(false);
    expect(caps.canManageFinance).toBe(false);
  });

  it('honours the wildcard', () => {
    const caps = capabilitiesForPermissions(['*'], 'SUPERADMIN');

    expect(caps.canSeeSalary).toBe(true);
    expect(caps.canSeeAudit).toBe(true);
    expect(caps.canManageFinance).toBe(true);
    expect(caps.canBackup).toBe(true);
  });

  it('keeps the role-keyed flags that have no permission behind them', () => {
    expect(capabilitiesForPermissions([], 'DOCTOR').ownDataOnly).toBe(true);
    expect(capabilitiesForPermissions([], 'OWNER').ownDataOnly).toBe(false);
    expect(capabilitiesForPermissions([], 'STUDENT').readOnly).toBe(true);
    expect(capabilitiesForPermissions([], 'OWNER').canBackup).toBe(true);
    expect(capabilitiesForPermissions([], 'MANAGER').canBackup).toBe(false);
  });

  it('tolerates a missing role', () => {
    expect(() => capabilitiesForPermissions([], '')).not.toThrow();
  });
});
