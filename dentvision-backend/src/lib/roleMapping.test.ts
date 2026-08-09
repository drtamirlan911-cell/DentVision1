import { describe, expect, it } from 'vitest';

import { PERSON_ROLE_MAP } from './orgContext.js';
import { ROLE_PERMISSIONS, permissionsForRole } from './permissions.js';

/**
 * The role vocabularies have to agree with each other.
 *
 * There are three of them: the `UserRole` enum (legacy columns and the JWT),
 * the unified `Role.key` set (Person → PersonRole), and the permission matrix.
 * A mapping between two of them is where privilege quietly changes hands, and
 * nothing else in the build looks at them together — a key that maps to a role
 * that does not exist, or to a wider one, compiles and ships.
 *
 * These assertions encode decisions, not preferences:
 *  - a cashier IS an administrator in this product (there is no separate
 *    cashier in the staff UI, and `normalizeStaffRole` folds one into ADMIN);
 *  - a marketplace or academy membership must never resolve to a clinical
 *    role, because clinical roles carry medical-record access.
 */

/** Every value UserRole can take (prisma/schema.prisma). */
const USER_ROLE_ENUM = [
  'OWNER', 'DOCTOR', 'ASSISTANT', 'ADMIN', 'CASHIER',
  'LAB', 'MANAGER', 'STUDENT', 'SUPERADMIN', 'SUPPORT',
];

/** Roles that can read or write a patient's medical record. */
const CLINICAL_ROLES = ['DOCTOR', 'ASSISTANT'];

describe('PERSON_ROLE_MAP', () => {
  it('only maps to roles the permission system actually knows', () => {
    // `DIRECTOR` is the one deliberate exception: it is not a UserRole enum
    // value but is aliased to OWNER in permissions.ts and used by the frontend.
    for (const [key, legacyRole] of Object.entries(PERSON_ROLE_MAP)) {
      const known = USER_ROLE_ENUM.includes(legacyRole) || legacyRole === 'DIRECTOR';
      expect(known, `${key} → ${legacyRole} is not a role anything can resolve`).toBe(true);
    }
  });

  it('never maps to a role with an empty permission set', () => {
    // An empty set is a lock-out, not a denial: the user keeps the membership
    // and loses every page. That is the failure mode that froze the app in #179.
    for (const [key, legacyRole] of Object.entries(PERSON_ROLE_MAP)) {
      expect(permissionsForRole(legacyRole).length, `${key} → ${legacyRole}`).toBeGreaterThan(0);
    }
  });

  it('does not resolve a marketplace or academy membership to a clinical role', () => {
    // `seller` and `lecturer` used to map to DOCTOR.
    for (const key of ['seller', 'lecturer', 'supplier', 'student_marketplace']) {
      const mapped = PERSON_ROLE_MAP[key];
      if (!mapped) continue;
      expect(CLINICAL_ROLES, `${key} → ${mapped} grants medical-record access`).not.toContain(mapped);
    }
  });

  it('treats a cashier as an administrator, the same as the staff UI does', () => {
    expect(PERSON_ROLE_MAP.cashier).toBe('ADMIN');
  });
});

describe('the CASHIER alias', () => {
  it('grants exactly what ADMIN grants', () => {
    // The product has no separate cashier, but the enum value still exists and
    // the superadmin console could mint one. Before the alias, the same person
    // resolved to a narrow five-module set through the matrix and to full ADMIN
    // through the unified path — the answer depended on which resolver ran.
    expect([...permissionsForRole('CASHIER')].sort()).toEqual([...permissionsForRole('ADMIN')].sort());
  });

  it('is still resolvable, so an existing CASHIER account is not locked out', () => {
    expect(ROLE_PERMISSIONS.CASHIER).toBeDefined();
    expect(permissionsForRole('CASHIER').length).toBeGreaterThan(0);
  });
});

describe('every enum role resolves to something usable', () => {
  it.each(USER_ROLE_ENUM)('%s has a non-empty permission set', (role) => {
    // SUPERADMIN is the wildcard.
    expect(permissionsForRole(role).length).toBeGreaterThan(0);
  });
});
