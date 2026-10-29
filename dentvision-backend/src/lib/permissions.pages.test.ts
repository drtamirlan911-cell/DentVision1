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

  it('does not expose clinic-wide finance pages from read-only billing access', () => {
    const readOnlyPages = pagesForPermissions(['billing.read']);
    expect(readOnlyPages).toContain('pricelist');
    expect(readOnlyPages).not.toContain('finance');
    expect(readOnlyPages).not.toContain('cashier');
    expect(readOnlyPages).not.toContain('billing');
    expect(pagesForPermissions(['billing.manage'])).toEqual(
      expect.arrayContaining(['finance', 'cashier', 'billing', 'pricelist']),
    );
  });

  it('keeps Supplier separate from the global SUPERADMIN context', () => {
    expect(pagesForCaller(['*'], 'SUPERADMIN')).not.toContain('supplier');
    expect(pagesForCaller(['shop.manage'], 'SELLER')).toContain('supplier');
  });

  it('keeps platform SuperAdmin out of clinic CRM workspaces', () => {
    const pages = pagesForCaller(['*'], 'SUPERADMIN');
    expect(pages).toContain('admin');
    expect(pages).toContain('platform-finance');
    for (const page of ['schedule', 'patients', 'inventory', 'lab', 'finance', 'cashier', 'clinic-settings', 'staff', 'workflow']) {
      expect(pages).not.toContain(page);
    }
  });

  it('keeps support out of clinic BI and operational workspaces', () => {
    const pages = pagesForCaller(permissionsForRole('SUPPORT'), 'SUPPORT');
    expect(pages).not.toContain('admin');
    expect(pages).toContain('analytics');
    expect(pages).not.toContain('bi');
    expect(pages).not.toContain('schedule');
    expect(pages).not.toContain('patients');
  });

  it('keeps partner referral queues distinct from clinic referral creation', () => {
    expect(pagesForCaller([], 'MEDICAL_LAB_OWNER')).toContain('diagnostics-referrals');
    expect(pagesForCaller([], 'DENTAL_LAB_OWNER')).toContain('diagnostics-referrals');
    for (const role of ['OWNER', 'DIRECTOR', 'ADMIN', 'DOCTOR', 'ASSISTANT']) {
      expect(pagesForCaller(permissionsForRole(role), role)).toContain('diagnostics-referral-create');
    }
  });

  it('keeps shop catalogue reads separate from campaign administration', () => {
    expect(pagesForPermissions(['shop.read'])).toContain('shop');
    expect(pagesForPermissions(['shop.read'])).not.toContain('promotions');
    expect(pagesForPermissions(['shop.manage'])).toEqual(expect.arrayContaining(['shop', 'promotions']));
    expect(pagesForCaller(permissionsForRole('DOCTOR'), 'DOCTOR')).not.toContain('promotions');
    expect(pagesForCaller(permissionsForRole('ASSISTANT'), 'ASSISTANT')).not.toContain('promotions');
    expect(pagesForCaller(permissionsForRole('OWNER'), 'OWNER')).toContain('promotions');
  });

  it('aligns the manager and administrator surface with the canonical IAM matrix', () => {
    const managerPages = pagesForCaller(permissionsForRole('MANAGER'), 'MANAGER');
    expect(managerPages).toContain('inventory');
    expect(managerPages).not.toContain('lab');
    expect(managerPages).not.toContain('bi');
    expect(managerPages).not.toContain('promotions');
    expect(pagesForCaller(permissionsForRole('ADMIN'), 'ADMIN')).not.toContain('bi');
    expect(pagesForCaller(permissionsForRole('OWNER'), 'OWNER')).toContain('bi');
  });

  it('limits partner workspace settings and work queues by role', () => {
    const diagnosticOwner = pagesForCaller([], 'DIAGNOSTIC_OWNER');
    const diagnosticOperator = pagesForCaller([], 'DIAGNOSTIC_OPERATOR');
    expect(diagnosticOwner).toContain('diagnostics-settings');
    expect(diagnosticOperator).not.toContain('diagnostics-settings');
    expect(diagnosticOperator).not.toContain('diagnostics-statistics');

    const medicalLabOwner = pagesForCaller([], 'MEDICAL_LAB_OWNER');
    const medicalLabTech = pagesForCaller([], 'MEDICAL_LAB_TECHNICIAN');
    expect(medicalLabOwner).toContain('diagnostics-settings');
    expect(medicalLabTech).not.toContain('diagnostics-settings');
    expect(medicalLabTech).not.toContain('diagnostics-calendar');
    expect(medicalLabTech).not.toContain('diagnostics-statistics');

    expect(pagesForCaller([], 'DENTAL_LAB_OWNER')).toContain('diagnostics-settings');
    expect(pagesForCaller([], 'DENTAL_TECHNICIAN')).not.toContain('diagnostics-settings');
  });

  it('does not expose the inventory workbench to read-only clinical roles', () => {
    expect(pagesForCaller(permissionsForRole('DOCTOR'), 'DOCTOR')).not.toContain('inventory');
    expect(pagesForCaller(permissionsForRole('ASSISTANT'), 'ASSISTANT')).not.toContain('inventory');
    expect(pagesForCaller(permissionsForRole('OWNER'), 'OWNER')).toContain('inventory');
  });

  it('keeps assistant and clinic laboratory page surfaces within their role contract', () => {
    const assistant = pagesForCaller(permissionsForRole('ASSISTANT'), 'ASSISTANT');
    expect(assistant).toContain('patients');
    expect(assistant).toContain('visits');
    for (const page of ['medical-card', 'dental-chart', 'treatment-plans', 'icd10']) {
      expect(assistant).not.toContain(page);
    }

    const manager = pagesForCaller(permissionsForRole('MANAGER'), 'MANAGER');
    expect(manager).toEqual(expect.arrayContaining(['patients', 'inventory', 'staff', 'analytics', 'pricelist']));
    for (const page of ['medical-card', 'visits', 'dental-chart', 'documents', 'treatment-plans', 'icd10', 'clinic-settings', 'workflow', 'reminders', 'lab', 'diagnostics-referrals', 'diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings']) {
      expect(manager).not.toContain(page);
    }

    const laboratory = pagesForCaller(permissionsForRole('LAB'), 'LAB');
    expect(laboratory).toContain('lab');
    expect(laboratory).toContain('diagnostics-referrals');
    expect(laboratory).toContain('diagnostics-laboratories');
    for (const page of ['patients', 'medical-card', 'visits', 'dental-chart', 'documents', 'treatment-plans', 'icd10', 'inventory', 'diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings']) {
      expect(laboratory).not.toContain(page);
    }
  });

  it('keeps read-only billing roles on the price list only', () => {
    for (const role of ['DOCTOR', 'MANAGER']) {
      const pages = pagesForCaller(permissionsForRole(role), role);
      expect(pages).toContain('pricelist');
      expect(pages).not.toContain('finance');
      expect(pages).not.toContain('cashier');
      expect(pages).not.toContain('billing');
    }
  });

  it('keeps diagnostic-center operations distinct from clinic diagnostic reads', () => {
    for (const role of ['OWNER', 'DIRECTOR', 'ADMIN', 'DOCTOR', 'ASSISTANT', 'MANAGER', 'LAB']) {
      const pages = pagesForCaller(permissionsForRole(role), role);
      for (const page of ['diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings']) {
        expect(pages).not.toContain(page);
      }
    }

    for (const role of ['OWNER', 'DIRECTOR', 'ADMIN', 'DOCTOR', 'ASSISTANT', 'LAB']) {
      const pages = pagesForCaller(permissionsForRole(role), role);
      expect(pages).toContain('diagnostics-referrals');
      expect(pages).toContain('diagnostics-results');
    }

    const diagnosticOwner = pagesForCaller([], 'DIAGNOSTIC_OWNER');
    expect(diagnosticOwner).toContain('diagnostics-calendar');
    expect(diagnosticOwner).toContain('diagnostics-statistics');
    expect(diagnosticOwner).toContain('diagnostics-settings');
  });

  it('keeps partner referral queues available without clinic referral creation', () => {
    for (const role of ['MEDICAL_LAB_OWNER', 'MEDICAL_LAB_TECHNICIAN', 'DENTAL_LAB_OWNER', 'DENTAL_TECHNICIAN']) {
      expect(pagesForCaller([], role)).toContain('diagnostics-referrals');
      expect(pagesForCaller([], role)).not.toContain('diagnostics-referral-create');
    }
  });

  it('does not expose the laboratory workbench to manager-only read access', () => {
    expect(pagesForCaller(permissionsForRole('MANAGER'), 'MANAGER')).not.toContain('lab');
    expect(pagesForCaller(permissionsForRole('DOCTOR'), 'DOCTOR')).toContain('lab');
    expect(pagesForCaller(permissionsForRole('ASSISTANT'), 'ASSISTANT')).toContain('lab');
  });


  it('retains personal settings for scoped partner workspaces', () => {
    for (const role of ['DIAGNOSTIC_OWNER', 'MEDICAL_LAB_OWNER', 'DENTAL_LAB_OWNER']) {
      expect(pagesForCaller([], role)).toContain('settings');
    }
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
