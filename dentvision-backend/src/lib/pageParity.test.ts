import { describe, expect, it } from 'vitest';

import { pagesForCaller, MODULE_PAGES } from './permissions.js';

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
      'diagnostics-referrals', 'profile'],
  },
  lab: {
    backendRole: 'LAB',
    pages: ['lab', 'shop', 'diagnostics', 'diagnostics-referrals', 'diagnostics-laboratories',
      'diagnostics-results', 'profile'],
  },
  manager: {
    backendRole: 'MANAGER',
    pages: ['dashboard', 'schedule', 'patients', 'analytics', 'staff', 'promotions', 'shop', 'profile'],
  },
  intern: {
    backendRole: 'STUDENT',
    pages: ['schedule', 'patients', 'visits', 'documents', 'school', 'profile'],
  },
};

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

  it('keeps the admin console out of every clinic role', () => {
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
