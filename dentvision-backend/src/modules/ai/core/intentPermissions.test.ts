import { describe, expect, it } from 'vitest';

import { permissionsSatisfy, permissionsForRole } from '../../../lib/permissions.js';
import { Intent } from '../types/intent.types.js';
import { PERMISSION_BY_INTENT, permissionForIntent } from './ai.service.js';

/** Does a role, per the shared matrix, pass the gate for this intent? */
function roleMayRun(role: string, intent: string): boolean {
  const required = permissionForIntent(intent);
  if (!required) return false;
  return permissionsSatisfy(new Set<string>(permissionsForRole(role)), required);
}

describe('PERMISSION_BY_INTENT coverage', () => {
  it('classifies every executable Intent enum value', () => {
    const unclassified = Object.values(Intent).filter(
      (intent) => intent !== Intent.UNKNOWN && !PERMISSION_BY_INTENT[intent],
    );
    expect(unclassified).toEqual([]);
  });

  it('uses the shared dot-notation vocabulary, not a private one', () => {
    for (const required of Object.values(PERMISSION_BY_INTENT)) {
      expect(required).toMatch(/^[a-z]+\.(read|write|delete|manage)$/);
    }
  });

  it('refuses an intent nobody has classified', () => {
    expect(permissionForIntent('WIPE_EVERYTHING')).toBeNull();
    expect(roleMayRun('OWNER', 'WIPE_EVERYTHING')).toBe(false);
  });
});

describe('intent gating enforces the action, not just the module', () => {
  it('stops a read-only assistant from creating appointments', () => {
    // The old gate compared module names only, so `appointments:read` passed
    // CREATE_APPOINTMENT. ASSISTANT does hold appointments.write, so use a role
    // that genuinely does not: MANAGER is read-only on appointments.
    expect(roleMayRun('MANAGER', Intent.VIEW_SCHEDULE)).toBe(true);
    expect(roleMayRun('MANAGER', Intent.CREATE_APPOINTMENT)).toBe(false);
  });

  it('stops a cashier from raising a treatment plan while keeping invoices', () => {
    expect(roleMayRun('CASHIER', Intent.GENERATE_INVOICE)).toBe(true);
    expect(roleMayRun('CASHIER', Intent.CREATE_TREATMENT_PLAN)).toBe(false);
  });

  it('keeps PHI behind medical.read rather than patients.read', () => {
    expect(roleMayRun('CASHIER', Intent.SEARCH_PATIENT)).toBe(true);
    expect(roleMayRun('CASHIER', Intent.OPEN_MEDICAL_CARD)).toBe(false);
    expect(roleMayRun('DOCTOR', Intent.OPEN_MEDICAL_CARD)).toBe(true);
  });

  it('leaves a doctor’s own clinical work intact', () => {
    for (const intent of [
      Intent.CREATE_APPOINTMENT,
      Intent.CREATE_TREATMENT_PLAN,
      Intent.SEARCH_PATIENT,
      Intent.GET_MEDICAL_CARD,
      Intent.VIEW_SCHEDULE,
      'REFER_DIAGNOSTICS',
    ]) {
      expect(roleMayRun('DOCTOR', intent)).toBe(true);
    }
  });

  it('lets an owner through everywhere', () => {
    for (const intent of Object.keys(PERMISSION_BY_INTENT)) {
      expect(roleMayRun('OWNER', intent)).toBe(true);
    }
  });

  it('lets a wildcard permission set through everywhere', () => {
    for (const required of Object.values(PERMISSION_BY_INTENT)) {
      expect(permissionsSatisfy(new Set(['*']), required)).toBe(true);
    }
  });
});
