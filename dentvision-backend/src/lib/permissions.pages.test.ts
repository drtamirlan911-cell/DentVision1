import { describe, expect, it } from 'vitest';

import {
  MODULE_PAGES,
  capabilitiesForPermissions,
  pagesForPermissions,
  permissionsForRole,
} from './permissions.js';

describe('pagesForPermissions', () => {
  it('expands the wildcard to every known page', () => {
    const all = new Set(Object.values(MODULE_PAGES).flat());
    expect(new Set(pagesForPermissions(['*']))).toEqual(all);
  });

  it('maps a module permission to that module’s pages', () => {
    expect(pagesForPermissions(['inventory.read'])).toEqual(['inventory']);
    expect(pagesForPermissions(['appointments.read'])).toEqual(['schedule', 'reminders']);
  });

  it('unions pages across permissions without duplicating', () => {
    const pages = pagesForPermissions(['appointments.read', 'appointments.write', 'inventory.read']);
    expect(pages).toEqual([...new Set(pages)]);
    expect(pages).toContain('schedule');
    expect(pages).toContain('inventory');
  });

  it('grants nothing for an empty permission set', () => {
    expect(pagesForPermissions([])).toEqual([]);
  });

  it('ignores permissions whose module has no pages', () => {
    expect(pagesForPermissions(['community.read'])).toEqual([]);
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
