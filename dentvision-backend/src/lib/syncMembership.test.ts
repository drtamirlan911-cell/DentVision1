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

import {
  syncPersonFromClinicMember,
  syncPersonFromSupplierMember,
  syncPersonFromLecturer,
  syncPersonFromSupportUser,
} from './syncMembership.js';

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

describe('syncPersonFromClinicMember — multi-organization membership', () => {
  beforeEach(() => {
    userFindUnique.mockReset().mockResolvedValue({ id: USER_ID, firstName: 'A', lastName: 'B', phone: null, spec: null });
    organizationFindFirst.mockReset().mockResolvedValue({ id: 'org-2' });
    personFindFirst.mockReset().mockResolvedValue(null);
    personFindUnique.mockReset();
    personCreate.mockReset().mockResolvedValue({ id: 'person-2' });
    personUpdate.mockReset();
    roleFindUnique.mockReset().mockResolvedValue({ id: 'role-1' });
    personRoleUpsert.mockReset();
  });

  it('creates a second Person when the user already belongs to another clinic', async () => {
    // The user has a Person in clinic 1; joining clinic 2 used to bail out
    // silently because Person.userId was globally unique, leaving the second
    // membership represented only in the legacy ClinicMember table.
    await syncPersonFromClinicMember('clinic-2', USER_ID, 'DOCTOR');

    expect(personCreate).toHaveBeenCalledOnce();
    expect(personCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          organizationId: 'org-2',
          originalId: `clinic-2:${USER_ID}`,
        }),
      }),
    );
  });

  it('gives the second membership its own role rather than inheriting the first', async () => {
    await syncPersonFromClinicMember('clinic-2', USER_ID, 'ASSISTANT');

    expect(roleFindUnique).toHaveBeenCalledWith({ where: { key: 'assistant' } });
    expect(personRoleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ personId: 'person-2' }) }),
    );
  });

  it('never consults the user-wide Person lookup that used to gate this', async () => {
    await syncPersonFromClinicMember('clinic-2', USER_ID, 'DOCTOR');

    expect(personFindUnique).not.toHaveBeenCalled();
  });
});

describe('syncPersonFromSupplierMember', () => {
  beforeEach(() => {
    userFindUnique.mockReset().mockResolvedValue({ id: USER_ID, firstName: 'A', lastName: 'B', phone: null, email: 'a@b.com' });
    organizationFindFirst.mockReset().mockResolvedValue({ id: 'org-1' });
    personFindFirst.mockReset().mockResolvedValue({ id: 'person-1' });
    personFindUnique.mockReset();
    personCreate.mockReset();
    personUpdate.mockReset().mockResolvedValue({ id: 'person-1' });
    roleFindUnique.mockReset().mockResolvedValue({ id: 'role-1' });
    personRoleUpsert.mockReset();
  });

  it('assigns the fixed "seller" role, keyed by the SupplierMember row id', async () => {
    await syncPersonFromSupplierMember('member-1', 'supplier-1', USER_ID);
    expect(organizationFindFirst).toHaveBeenCalledWith({ where: { originalType: 'Supplier', originalId: 'supplier-1' } });
    expect(personFindFirst).toHaveBeenCalledWith({ where: { originalType: 'SupplierMember', originalId: 'member-1' } });
    expect(roleFindUnique).toHaveBeenCalledWith({ where: { key: 'seller' } });
    expect(personRoleUpsert).toHaveBeenCalledOnce();
  });

  it('no-ops when the Supplier has no matching Organization yet', async () => {
    organizationFindFirst.mockResolvedValueOnce(null);
    await syncPersonFromSupplierMember('member-1', 'supplier-1', USER_ID);
    expect(personCreate).not.toHaveBeenCalled();
    expect(personUpdate).not.toHaveBeenCalled();
  });
});

describe('syncPersonFromLecturer', () => {
  beforeEach(() => {
    userFindUnique.mockReset().mockResolvedValue({ id: USER_ID, firstName: 'A', lastName: 'B', phone: null, email: 'a@b.com' });
    organizationFindFirst.mockReset().mockResolvedValue({ id: 'org-1' });
    personFindFirst.mockReset().mockResolvedValue({ id: 'person-1' });
    personFindUnique.mockReset();
    personCreate.mockReset();
    personUpdate.mockReset().mockResolvedValue({ id: 'person-1' });
    roleFindUnique.mockReset().mockResolvedValue({ id: 'role-1' });
    personRoleUpsert.mockReset();
  });

  it('assigns the fixed "lecturer" role, keyed by the Lecturer row id', async () => {
    await syncPersonFromLecturer('lecturer-1', USER_ID, 'academy-1');
    expect(organizationFindFirst).toHaveBeenCalledWith({ where: { originalType: 'Academy', originalId: 'academy-1' } });
    expect(personFindFirst).toHaveBeenCalledWith({ where: { originalType: 'Lecturer', originalId: 'lecturer-1' } });
    expect(roleFindUnique).toHaveBeenCalledWith({ where: { key: 'lecturer' } });
    expect(personRoleUpsert).toHaveBeenCalledOnce();
  });

  it('tolerates a lecturer with no academy (no Organization lookup, still syncs)', async () => {
    await syncPersonFromLecturer('lecturer-1', USER_ID, null);
    expect(organizationFindFirst).not.toHaveBeenCalled();
    expect(personRoleUpsert).toHaveBeenCalledOnce();
  });
});

describe('syncPersonFromSupportUser', () => {
  beforeEach(() => {
    userFindUnique.mockReset().mockResolvedValue({ id: USER_ID, firstName: 'S', lastName: 'Upport', email: 's@dentvision.local' });
    personFindFirst.mockReset().mockResolvedValue({ id: 'person-1' });
    personFindUnique.mockReset();
    personCreate.mockReset();
    personUpdate.mockReset().mockResolvedValue({ id: 'person-1' });
    roleFindUnique.mockReset().mockResolvedValue({ id: 'role-1' });
    personRoleUpsert.mockReset();
  });

  it('assigns a platform-scoped "support" PersonRole', async () => {
    await syncPersonFromSupportUser(USER_ID);
    expect(personFindFirst).toHaveBeenCalledWith({ where: { originalType: 'User', originalId: USER_ID } });
    expect(roleFindUnique).toHaveBeenCalledWith({ where: { key: 'support' } });
    expect(personRoleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ scopeType: 'platform' }) }),
    );
  });

  it('no-ops when the user does not exist', async () => {
    userFindUnique.mockResolvedValueOnce(null);
    await syncPersonFromSupportUser('missing-user');
    expect(personFindFirst).not.toHaveBeenCalled();
  });
});
