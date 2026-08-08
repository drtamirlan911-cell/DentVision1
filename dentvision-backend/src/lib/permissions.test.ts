import { describe, expect, it } from 'vitest';
import { permissionsForRole, roleHasPermission } from '../lib/permissions.js';

describe('permissionsForRole', () => {
  it('SUPERADMIN gets the full catalog', () => {
    const all = permissionsForRole('SUPERADMIN');
    expect(all).toContain('patient.read');
    expect(all).toContain('platform.analytics');
    expect(all).toContain('compliance.manage');
    expect(all).toContain('bi.platform');
  });

  it('OWNER has finance + settings + delete', () => {
    const p = permissionsForRole('OWNER');
    expect(p).toContain('finance.manage');
    expect(p).toContain('bi.clinic');
    expect(p).toContain('patient.delete');
    expect(p).not.toContain('platform.analytics');
  });

  it('DIRECTOR is OWNER-equivalent', () => {
    expect(permissionsForRole('DIRECTOR')).toEqual(permissionsForRole('OWNER'));
  });

  it('DOCTOR has clinical read/write but no finance', () => {
    const p = permissionsForRole('DOCTOR');
    expect(p).toContain('patient.read');
    expect(p).toContain('appointment.write');
    expect(p).not.toContain('finance.manage');
    expect(p).not.toContain('patient.delete');
  });

  it('SUPPORT is read-mostly', () => {
    const p = permissionsForRole('SUPPORT');
    expect(p).toContain('patient.read');
    expect(p).toContain('bi.clinic');
    expect(p).not.toContain('patient.write');
    expect(p).not.toContain('finance.manage');
  });

  it('unknown/empty role yields no permissions', () => {
    expect(permissionsForRole(null)).toEqual([]);
    expect(permissionsForRole('NOPE')).toEqual([]);
  });
});

describe('roleHasPermission', () => {
  it('SUPERADMIN bypasses everything', () => {
    expect(roleHasPermission('SUPERADMIN', 'anything' as any)).toBe(true);
    expect(roleHasPermission('SUPERADMIN', 'platform.analytics')).toBe(true);
  });

  it('platform-only keys are SUPERADMIN-only', () => {
    for (const key of ['platform.analytics', 'compliance.manage', 'partner.manage', 'bi.platform', 'bi.network']) {
      expect(roleHasPermission('OWNER', key as any)).toBe(false);
      expect(roleHasPermission('DIRECTOR', key as any)).toBe(false);
      expect(roleHasPermission('SUPERADMIN', key as any)).toBe(true);
    }
  });

  it('DIRECTOR inherits OWNER grants', () => {
    expect(roleHasPermission('DIRECTOR', 'finance.manage')).toBe(true);
    expect(roleHasPermission('DIRECTOR', 'patient.delete')).toBe(true);
  });

  it('DOCTOR cannot manage finance', () => {
    expect(roleHasPermission('DOCTOR', 'finance.manage')).toBe(false);
    expect(roleHasPermission('DOCTOR', 'appointment.write')).toBe(true);
  });

  it('SUPPORT is limited', () => {
    expect(roleHasPermission('SUPPORT', 'patient.read')).toBe(true);
    expect(roleHasPermission('SUPPORT', 'finance.manage')).toBe(false);
  });
});
