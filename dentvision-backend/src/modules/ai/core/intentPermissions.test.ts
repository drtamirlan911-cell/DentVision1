import { describe, expect, it } from 'vitest';

import { ROLE_PERMISSIONS, permissionsSatisfy, permissionsForRole } from '../../../lib/permissions.js';
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

  it('stops an assistant from raising a treatment plan while keeping the card readable', () => {
    // This case used to be argued with CASHIER (invoice yes, treatment plan
    // no). A cashier is an administrator in this product now, so that role is
    // no longer narrow. ASSISTANT still makes the same point about the gate:
    // it holds medical.read and not medical.write.
    expect(roleMayRun('ASSISTANT', Intent.OPEN_MEDICAL_CARD)).toBe(true);
    expect(roleMayRun('ASSISTANT', Intent.CREATE_TREATMENT_PLAN)).toBe(false);
  });

  it('keeps PHI behind medical.read rather than patients.read', () => {
    // LAB and SUPPORT are the narrow roles now: both can look a patient up,
    // neither may open the card.
    expect(roleMayRun('LAB', Intent.SEARCH_PATIENT)).toBe(true);
    expect(roleMayRun('LAB', Intent.OPEN_MEDICAL_CARD)).toBe(false);
    expect(roleMayRun('SUPPORT', Intent.SEARCH_PATIENT)).toBe(true);
    expect(roleMayRun('SUPPORT', Intent.OPEN_MEDICAL_CARD)).toBe(false);
    expect(roleMayRun('DOCTOR', Intent.OPEN_MEDICAL_CARD)).toBe(true);
  });

  it('records that the till is no longer separable from the medical record', () => {
    // Folding the cashier into the administrator removed the only role that
    // could take money without full medical-record access. That is a change to
    // separation of duties, not an implementation detail, so it is asserted
    // rather than left implicit: if a narrow money role is ever reintroduced,
    // this fails and the question gets asked deliberately.
    const withMoney = Object.keys(ROLE_PERMISSIONS).filter((role) =>
      permissionsForRole(role).includes('billing.write'),
    );
    expect(withMoney.length).toBeGreaterThan(0);
    for (const role of withMoney) {
      expect(
        permissionsForRole(role),
        `${role} can take payment — check whether it should also write the medical record`,
      ).toContain('medical.write');
    }
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
