import { describe, expect, it } from 'vitest';
import { resolveClinicRoleKey } from './migrate-unified-schema.js';

// Every value of the Prisma `UserRole` enum (schema.prisma) — these are the
// only strings the ClinicMember.role column can actually hold.
const EXPECTED_ROLE_KEY: Record<string, string> = {
  OWNER: 'owner', DOCTOR: 'doctor', ASSISTANT: 'assistant', ADMIN: 'admin',
  CASHIER: 'cashier', LAB: 'lab', MANAGER: 'manager', STUDENT: 'student',
  SUPERADMIN: 'superadmin', SUPPORT: 'support',
};

describe('resolveClinicRoleKey', () => {
  it.each(Object.entries(EXPECTED_ROLE_KEY))('resolves %s to %s', (role, expected) => {
    expect(resolveClinicRoleKey(role)).toBe(expected);
  });

  it('returns null (not a silent "owner" fallback) for an unrecognized role', () => {
    expect(resolveClinicRoleKey('SOME_UNKNOWN_ROLE')).toBeNull();
  });
});
