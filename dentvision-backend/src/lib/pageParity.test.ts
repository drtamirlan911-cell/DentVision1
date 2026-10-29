import { describe, expect, it } from 'vitest';

import { pagesForCaller, MODULE_PAGES, BASE_PAGES } from './permissions.js';

/**
 * Page parity with the frontend's legacy role tables.
 *
 * `src/iam/resolver.ts` unions the server's page list with the legacy
 * `ORG_ROLES` / `PLATFORM_ROLES` config, so the legacy tables are currently a
 * safety net — deleting them (Phase 5) is only safe once the server grants at
 * least as much for every role. These expectations are copied verbatim from
 * `src/store/auth.store.ts`; when they all pass, the net is provably redundant
 * and the frontend tables can go.
 */
const LEGACY_ORG_PAGES: Record<string, { backendRole: string; pages: string[] }> = {
  owner: {
    backendRole: 'OWNER',
    pages: ['dashboard', 'schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents',
      'finance', 'cashier', 'pricelist', 'lab', 'reminders', 'promotions', 'inventory', 'staff',
      'audit', 'backup', 'shop', 'school', 'analytics', 'settings', 'clinic-settings', 'billing',
      'treatment-plans', 'dental-chart', 'diagnostics', 'diagnostics-referrals',
      'diagnostics-centers', 'diagnostics-labs', 'diagnostics-results', 'profile', 'bi'],
  },
  admin: {
    backendRole: 'ADMIN',
    pages: ['schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'finance',
      'cashier', 'pricelist', 'lab', 'reminders', 'promotions', 'inventory', 'staff', 'shop',
      'school', 'analytics', 'settings', 'clinic-settings', 'billing', 'treatment-plans',
      'dental-chart', 'diagnostics', 'diagnostics-referrals', 'diagnostics-results', 'profile'],
  },
  doctor: {
    backendRole: 'DOCTOR',
    pages: ['schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'lab',
      'reminders', 'school', 'treatment-plans', 'dental-chart', 'diagnostics-referrals',
      'diagnostics-results', 'profile'],
  },
  assistant: {
    backendRole: 'ASSISTANT',
    pages: ['schedule', 'patients', 'visits', 'documents', 'reminders', 'shop', 'school',
      'diagnostics-referrals', 'diagnostics-results', 'profile'],
  },
  lab: {
    backendRole: 'LAB',
    pages: ['lab', 'shop', 'diagnostics', 'diagnostics-referrals', 'diagnostics-laboratories',
      'diagnostics-results', 'profile'],
  },
  manager: {
    backendRole: 'MANAGER',
    pages: ['dashboard', 'schedule', 'patients', 'analytics', 'inventory', 'staff', 'shop', 'profile'],
  },
  // `intern` (a different frontend role, still permissive) no longer maps to
  // backend STUDENT — see `ORG_ROLES.student` in auth.store.ts. STUDENT is
  // deliberately narrower: an external learner has no clinical reason to see
  // patient data at all.
  student: {
    backendRole: 'STUDENT',
    pages: ['school', 'profile'],
  },
};

/** PLATFORM_ROLES and the non-clinic workspaces, same source. */
const LEGACY_PLATFORM_PAGES: Record<string, { role: string; permissions: string[]; pages: string[] }> = {
  'user (supplier / lecturer / buyer)': {
    role: 'SUPPLIER',
    permissions: [],
    pages: ['shop', 'school', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'profile'],
  },
  support: {
    role: 'SUPPORT',
    permissions: [],
    // Keep this in sync with PLATFORM_ROLES.support in src/store/auth.store.ts.
    // Support has a support workbench, not the Super Admin console.
    pages: ['help', 'analytics', 'settings', 'profile'],
  },
  superadmin: {
    role: 'SUPERADMIN',
    permissions: ['*'],
    pages: ['admin', 'audit', 'backup', 'analytics', 'settings', 'security', 'quality',
      'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'platform-finance',
      'ai-governance', 'support', 'profile', 'bi', 'supplier'],
  },
  diagnostic_center: {
    // A diagnostic centre is a partner organization, not a clinic ADMIN.
    // Keep the parity assertion on its scoped partner role.
    role: 'DIAGNOSTIC_OWNER',
    permissions: [],
    pages: ['diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-results',
      'diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings', 'profile'],
  },
};

describe('server page list covers the platform and workspace roles', () => {
  for (const [legacyRole, { role, permissions, pages }] of Object.entries(LEGACY_PLATFORM_PAGES)) {
    it(`grants ${role} the compatible pages from legacy '${legacyRole}'`, () => {
      const served = pagesForCaller(permissions, role);
      // A platform SUPERADMIN deliberately does not inherit the Supplier
      // workspace merely because its wildcard is global. The supplier page
      // depends on an active supplier organization context, not a platform role.
      const intentionallyExcluded = role === 'SUPERADMIN' ? new Set(['supplier']) : new Set<string>();
      expect(pages.filter((page) => !intentionallyExcluded.has(page) && !served.includes(page))).toEqual([]);
      if (role === 'SUPERADMIN') expect(served).not.toContain('supplier');
    });
  }

  it('gives a role with no permissions at all the authenticated baseline', () => {
    // This is the case that froze the app: an empty list read as "deny all".
    const served = pagesForCaller([], 'LECTURER');
    expect(served).toEqual(expect.arrayContaining([...BASE_PAGES]));
    expect(served.length).toBeGreaterThan(0);
  });

  it('keeps the platform console out of every non-superadmin role', () => {
    for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'DOCTOR', 'SUPPORT', 'SUPPLIER']) {
      const served = pagesForCaller([], role);
      for (const page of MODULE_PAGES.platform) {
        expect(served, `${role} must not see ${page}`).not.toContain(page);
      }
    }
    expect(pagesForCaller(['*'], 'SUPERADMIN')).toContain('platform-finance');
  });

  it('separates personal settings from clinic settings', () => {
    // `settings` used to sit behind settings.manage, which also gates the
    // workflow write routes — support could not reach its own settings screen
    // without being handed those.
    expect(pagesForCaller([], 'SUPPORT')).toContain('settings');
    expect(pagesForCaller([], 'SUPPORT')).not.toContain('clinic-settings');
    expect(pagesForCaller([], 'OWNER')).toContain('clinic-settings');
  });
});

describe('server page list covers the frontend legacy config', () => {
  for (const [legacyRole, { backendRole, pages }] of Object.entries(LEGACY_ORG_PAGES)) {
    it(`grants ${backendRole} everything legacy '${legacyRole}' had`, () => {
      const served = pagesForCaller([], backendRole);
      const missing = pages.filter((page) => !served.includes(page));
      expect(missing).toEqual([]);
    });
  }

  it('serves both spellings of the laboratories page', () => {
    // The frontend route table uses `diagnostics-labs` in some roles and
    // `diagnostics-laboratories` in others for the same screen.
    const served = pagesForCaller([], 'OWNER');
    expect(served).toContain('diagnostics-labs');
    expect(served).toContain('diagnostics-laboratories');
  });

  it('keeps the admin console out of every clinic role and support', () => {
    expect(pagesForCaller([], 'SUPPORT')).not.toContain('admin');
    for (const { backendRole } of Object.values(LEGACY_ORG_PAGES)) {
      expect(pagesForCaller([], backendRole)).not.toContain('admin');
    }
    expect(pagesForCaller(['*'], 'SUPERADMIN')).toContain('admin');
  });

  it('maps every page id to exactly one module', () => {
    const seen = new Map<string, string>();
    for (const [mod, ids] of Object.entries(MODULE_PAGES)) {
      for (const id of ids) {
        expect(seen.has(id), `page '${id}' claimed by ${seen.get(id)} and ${mod}`).toBe(false);
        seen.set(id, mod);
      }
    }
  });
});
