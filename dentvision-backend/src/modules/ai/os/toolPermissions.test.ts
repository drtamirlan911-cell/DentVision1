import { describe, expect, it } from 'vitest';

import { listToolNames, toolCapabilitiesFor } from './tools.js';
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

  it('keeps the partner dental-lab queue explicitly self-authorized, not silently unclassified', () => {
    expect(UNGATED_TOOLS).toContain('getDentalLabWorkQueue');
    expect(UNGATED_TOOLS).toContain('getDiagnosticCenterWorkQueue');
    expect(UNGATED_TOOLS).toContain('getSupplierInventoryOverview');
    expect(TOOL_PERMISSIONS).not.toHaveProperty('getDentalLabWorkQueue');
    expect(TOOL_PERMISSIONS).not.toHaveProperty('getSupplierInventoryOverview');
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

describe('tool capability inventory', () => {
  it('contains only capabilities in the verified allowed set', () => {
    const capabilities = toolCapabilitiesFor(new Set(['searchProducts', 'createInvoice']));

    expect(capabilities).toHaveLength(2);
    expect(capabilities.some((item) => item.description.includes('Поиск товаров'))).toBe(true);
    expect(capabilities.some((item) => item.description.includes('Выставить счёт'))).toBe(true);
  });

  it('distinguishes read-only tools from state-changing tools independent of registry order', () => {
    const capabilities = toolCapabilitiesFor(new Set(['searchProducts', 'createInvoice']));
    const search = capabilities.find((item) => item.description.includes('Поиск товаров'));
    const invoice = capabilities.find((item) => item.description.includes('Выставить счёт'));

    expect(search).toMatchObject({ effect: 'read', confirmation: 'none' });
    expect(invoice).toMatchObject({ effect: 'change', confirmation: 'explicit' });
  });

  it('does not invent a confirmation contract where the tool does not declare one', () => {
    const [statusChange] = toolCapabilitiesFor(new Set(['updateLabOrderStatus']));
    expect(statusChange).toMatchObject({ effect: 'change', confirmation: 'tool-policy' });
  });

  it('does not leak internal tool names into the capability text', () => {
    const capabilities = toolCapabilitiesFor(new Set(listToolNames()));
    for (const capability of capabilities) {
      for (const name of listToolNames()) expect(capability.description).not.toContain(name);
    }
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
