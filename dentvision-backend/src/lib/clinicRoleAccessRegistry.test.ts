import { describe, expect, it } from 'vitest';
import { CLINIC_ROLE_BY_KEY, CLINIC_ROLE_DEFINITIONS, CLINIC_ROLE_KEYS } from './clinicRoleAccessRegistry.js';

describe('clinic workspace role matrix', () => {
  it('defines the complete clinic operational role set', () => {
    expect(CLINIC_ROLE_KEYS).toEqual([
      'OWNER', 'ADMIN', 'MANAGER', 'DOCTOR', 'ASSISTANT', 'RECEPTIONIST', 'CASHIER', 'ACCOUNTANT',
    ]);
    expect(new Set(CLINIC_ROLE_KEYS).size).toBe(CLINIC_ROLE_KEYS.length);
  });

  it('keeps clinical sign-off with owner/doctor only', () => {
    expect(CLINIC_ROLE_BY_KEY.OWNER.permissions).toContain('medical.manage');
    expect(CLINIC_ROLE_BY_KEY.DOCTOR.permissions).toContain('medical.manage');
    for (const key of ['ADMIN', 'MANAGER', 'ASSISTANT', 'RECEPTIONIST', 'CASHIER', 'ACCOUNTANT']) {
      expect(CLINIC_ROLE_BY_KEY[key].permissions).not.toContain('medical.manage');
    }
  });

  it('keeps financial administration separated from clinical roles', () => {
    expect(CLINIC_ROLE_BY_KEY.CASHIER.permissions).toContain('billing.manage');
    expect(CLINIC_ROLE_BY_KEY.ACCOUNTANT.permissions).toContain('billing.manage');
    expect(CLINIC_ROLE_BY_KEY.DOCTOR.permissions).not.toContain('billing.manage');
    expect(CLINIC_ROLE_BY_KEY.ASSISTANT.permissions).not.toContain('billing.manage');
  });

  it('uses narrower operational scopes for branch and assigned roles', () => {
    expect(CLINIC_ROLE_BY_KEY.OWNER.defaultScope).toBe('ORGANIZATION');
    expect(CLINIC_ROLE_BY_KEY.ADMIN.defaultScope).toBe('ORGANIZATION');
    expect(CLINIC_ROLE_BY_KEY.ACCOUNTANT.defaultScope).toBe('ORGANIZATION');
    expect(CLINIC_ROLE_BY_KEY.MANAGER.defaultScope).toBe('BRANCH');
    expect(CLINIC_ROLE_BY_KEY.RECEPTIONIST.defaultScope).toBe('BRANCH');
    expect(CLINIC_ROLE_BY_KEY.CASHIER.defaultScope).toBe('BRANCH');
    expect(CLINIC_ROLE_BY_KEY.DOCTOR.defaultScope).toBe('ASSIGNED');
    expect(CLINIC_ROLE_BY_KEY.ASSISTANT.defaultScope).toBe('ASSIGNED');
  });

  it('never uses a wildcard permission in a clinic role', () => {
    for (const role of CLINIC_ROLE_DEFINITIONS) expect(role.permissions).not.toContain('*');
  });
});
