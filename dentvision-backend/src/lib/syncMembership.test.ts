import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  userFindUnique, organizationFindFirst, personFindFirst, personFindUnique,
  personCreate, personUpdate, roleFindUnique, personRoleUpsert,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  organizationFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  personFindUnique: vi.fn(),
  personCreate: vi.fn(),
  personUpdate: vi.fn(),
  roleFindUnique: vi.fn(),
  personRoleUpsert: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  default: {
    user: { findUnique: userFindUnique },
    organization: { findFirst: organizationFindFirst },
    person: { findFirst: personFindFirst, findUnique: personFindUnique, create: personCreate, update: personUpdate },
    role: { findUnique: roleFindUnique },
    personRole: { upsert: personRoleUpsert },
  },
}));

import { syncPersonFromClinicMember } from './syncMembership.js';

const CLINIC_ID = 'clinic-1';
const USER_ID = 'user-1';

// Every value of the Prisma `UserRole` enum (schema.prisma) — these are the
// only strings the ClinicMember.role column can actually hold.
const ALL_USER_ROLES = [
  'OWNER', 'DOCTOR', 'ASSISTANT', 'ADMIN', 'CASHIER', 'LAB', 'MANAGER',
  'STUDENT', 'SUPERADMIN', 'SUPPORT',
];

const EXPECTED_ROLE_KEY: Record<string, string> = {
  OWNER: 'owner', DOCTOR: 'doctor', ASSISTANT: 'assistant', ADMIN: 'admin',
  CASHIER: 'cashier', LAB: 'lab', MANAGER: 'manager', STUDENT: 'student',
  SUPERADMIN: 'superadmin', SUPPORT: 'support',
};

describe('syncPersonFromClinicMember — role resolution', () => {
  beforeEach(() => {
    userFindUnique.mockReset().mockResolvedValue({ id: USER_ID, firstName: 'A', lastName: 'B', phone: null, spec: null });
    organizationFindFirst.mockReset().mockResolvedValue({ id: 'org-1' });
    personFindFirst.mockReset().mockResolvedValue({ id: 'person-1' });
    personFindUnique.mockReset();
    personCreate.mockReset();
    personUpdate.mockReset().mockResolvedValue({ id: 'person-1' });
    roleFindUnique.mockReset().mockResolvedValue({ id: 'role-1' });
    personRoleUpsert.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(ALL_USER_ROLES)('resolves %s to the correct unified role key and assigns it', async (role) => {
    await syncPersonFromClinicMember(CLINIC_ID, USER_ID, role);
    expect(roleFindUnique).toHaveBeenCalledWith({ where: { key: EXPECTED_ROLE_KEY[role] } });
    expect(personRoleUpsert).toHaveBeenCalledOnce();
  });

  it('fails closed on an unrecognized role: no PersonRole is assigned, no owner fallback', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await syncPersonFromClinicMember(CLINIC_ID, USER_ID, 'SOME_UNKNOWN_ROLE');
    expect(roleFindUnique).not.toHaveBeenCalled();
    expect(personRoleUpsert).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toContain('SOME_UNKNOWN_ROLE');
  });

  it('still creates/updates the Person record even when the role is unrecognized', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await syncPersonFromClinicMember(CLINIC_ID, USER_ID, 'SOME_UNKNOWN_ROLE');
    expect(personUpdate).toHaveBeenCalledOnce();
  });
});
