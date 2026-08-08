import { describe, expect, it } from 'vitest';
import { permissionsForRole, roleHasPermission } from '../lib/permissions.js';

describe('permissionsForRole', () => {
  it('SUPERADMIN gets wildcard', () => {
    expect(permissionsForRole('SUPERADMIN')).toEqual(['*']);
  });

  it('OWNER has full clinic access', () => {
    const p = permissionsForRole('OWNER');
    expect(p).toContain('patients.read');
    expect(p).toContain('patients.write');
    expect(p).toContain('patients.delete');
    expect(p).toContain('billing.manage');
    expect(p).toContain('bi.read');
    expect(p).toContain('staff.manage');
  });

  it('DIRECTOR is OWNER-equivalent', () => {
    expect(permissionsForRole('DIRECTOR')).toEqual(permissionsForRole('OWNER'));
  });

  it('DOCTOR has clinical read/write but no billing admin', () => {
    const p = permissionsForRole('DOCTOR');
    expect(p).toContain('patients.read');
    expect(p).toContain('patients.write');
    expect(p).toContain('medical.read');
    expect(p).toContain('appointments.write');
    expect(p).not.toContain('billing.manage');
    expect(p).not.toContain('patients.delete');
  });

  it('ASSISTANT is read-mostly clinical', () => {
    const p = permissionsForRole('ASSISTANT');
    expect(p).toContain('patients.read');
    expect(p).not.toContain('patients.write');
    expect(p).toContain('appointments.write'); // can write appointments
    expect(p).not.toContain('billing.read');
  });

  it('CASHIER has billing write', () => {
    const p = permissionsForRole('CASHIER');
    expect(p).toContain('patients.read');
    expect(p).toContain('billing.write');
    expect(p).not.toContain('billing.manage');
    expect(p).not.toContain('patients.write');
  });

  it('SUPPORT is read-mostly', () => {
    const p = permissionsForRole('SUPPORT');
    expect(p).toContain('patients.read');
    expect(p).toContain('bi.read');
    expect(p).not.toContain('patients.write');
    expect(p).not.toContain('billing.manage');
  });

  it('LAB has lab write + patient read', () => {
    const p = permissionsForRole('LAB');
    expect(p).toContain('lab.write');
    expect(p).toContain('patients.read');
    expect(p).not.toContain('patients.write');
  });

  it('STUDENT has academy + patient read', () => {
    const p = permissionsForRole('STUDENT');
    expect(p).toContain('academy.read');
    expect(p).toContain('patients.read');
    expect(p).not.toContain('patients.write');
  });

  it('unknown/empty role yields no permissions', () => {
    expect(permissionsForRole(null)).toEqual([]);
    expect(permissionsForRole('NOPE')).toEqual([]);
  });
});

describe('roleHasPermission', () => {
  it('SUPERADMIN bypasses everything', () => {
    expect(roleHasPermission('SUPERADMIN', 'anything' as any)).toBe(true);
    expect(roleHasPermission('SUPERADMIN', 'admin.read')).toBe(true);
  });

  it('admin.* keys are SUPERADMIN-only', () => {
    expect(roleHasPermission('OWNER', 'admin.read')).toBe(false);
    expect(roleHasPermission('SUPERADMIN', 'admin.read')).toBe(true);
  });

  it('DIRECTOR inherits OWNER grants', () => {
    expect(roleHasPermission('DIRECTOR', 'billing.manage')).toBe(true);
    expect(roleHasPermission('DIRECTOR', 'patients.delete')).toBe(true);
  });

  it('DOCTOR cannot manage billing', () => {
    expect(roleHasPermission('DOCTOR', 'billing.manage')).toBe(false);
    expect(roleHasPermission('DOCTOR', 'appointments.write')).toBe(true);
  });

  it('SUPPORT has read access', () => {
    expect(roleHasPermission('SUPPORT', 'patients.read')).toBe(true);
    expect(roleHasPermission('SUPPORT', 'billing.manage')).toBe(false);
  });
});
