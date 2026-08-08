import { describe, expect, it } from 'vitest';

import { listToolNames } from './tools.js';
import { TOOL_PERMISSIONS, UNGATED_TOOLS, permissionsSatisfy } from './toolPermissions.js';

describe('TOOL_PERMISSIONS coverage', () => {
  it('classifies every registered tool as gated or explicitly ungated', () => {
    const unclassified = listToolNames().filter(
      (name) => !TOOL_PERMISSIONS[name] && !UNGATED_TOOLS.includes(name),
    );
    expect(unclassified).toEqual([]);
  });

  it('does not map tools that no longer exist', () => {
    const registered = new Set(listToolNames());
    const stale = [...Object.keys(TOOL_PERMISSIONS), ...UNGATED_TOOLS].filter((n) => !registered.has(n));
    expect(stale).toEqual([]);
  });

  it('gates every mutating tool', () => {
    for (const tool of [
      'createAppointment',
      'updateAppointmentStatus',
      'cancelAppointment',
      'rescheduleAppointment',
      'createTreatmentPlan',
      'createInvoice',
    ]) {
      expect(TOOL_PERMISSIONS[tool]).toMatch(/\.(write|delete|manage)$/);
    }
  });

  it('gates PHI reads behind medical.read, not patients.read', () => {
    expect(TOOL_PERMISSIONS.getPatientCard).toBe('medical.read');
    expect(TOOL_PERMISSIONS.getVisits).toBe('medical.read');
    expect(TOOL_PERMISSIONS.getTreatmentPlans).toBe('medical.read');
  });
});

describe('permissionsSatisfy', () => {
  it('matches an exact key', () => {
    expect(permissionsSatisfy(new Set(['patients.read']), 'patients.read')).toBe(true);
  });

  it('honours the SUPERADMIN wildcard', () => {
    expect(permissionsSatisfy(new Set(['*']), 'billing.write')).toBe(true);
  });

  it('lets a higher action satisfy a lower one (shop.manage covers shop.read)', () => {
    expect(permissionsSatisfy(new Set(['shop.manage']), 'shop.read')).toBe(true);
    expect(permissionsSatisfy(new Set(['billing.delete']), 'billing.write')).toBe(true);
  });

  it('never lets a lower action satisfy a higher one', () => {
    expect(permissionsSatisfy(new Set(['appointments.read']), 'appointments.write')).toBe(false);
    expect(permissionsSatisfy(new Set(['billing.write']), 'billing.manage')).toBe(false);
  });

  it('does not leak across modules', () => {
    expect(permissionsSatisfy(new Set(['patients.read']), 'medical.read')).toBe(false);
  });
});
