import { describe, expect, it } from 'vitest';
import { resolveActivePersonRole } from './auth.js';

type PersonRoleFixture = Parameters<typeof resolveActivePersonRole>[0][number];

const role = (key: string, scopeId: string | null = 'clinic-1', scopeType: string | null = 'organization'): PersonRoleFixture => ({
  scopeType,
  scopeId,
  role: { key },
});

describe('organization auth context revocation', () => {
  it('uses an active organization-scoped PersonRole instead of stale User.role', () => {
    expect(resolveActivePersonRole([role('doctor')], 'clinic-1')).toBe('DOCTOR');
  });

  it('returns no effective role after the organization PersonRole is revoked', () => {
    expect(resolveActivePersonRole([], 'clinic-1')).toBeUndefined();
  });

  it('does not resurrect a role scoped to another organization', () => {
    expect(resolveActivePersonRole([role('owner', 'clinic-2')], 'clinic-1')).toBeUndefined();
  });

  it('allows an explicitly unscoped role to remain effective for the organization context', () => {
    expect(resolveActivePersonRole([role('admin', null, null)], 'clinic-1')).toBe('ADMIN');
  });
});
