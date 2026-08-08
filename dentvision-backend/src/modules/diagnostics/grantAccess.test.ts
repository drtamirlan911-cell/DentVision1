import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  centerFindUnique: vi.fn(),
  labFindUnique: vi.fn(),
  organizationFindFirst: vi.fn(),
  organizationUpsert: vi.fn(),
  centerMemberUpsert: vi.fn(),
  labMemberUpsert: vi.fn(),
  personFindFirst: vi.fn(),
  personFindUnique: vi.fn(),
  personCreate: vi.fn(),
  personUpdate: vi.fn(),
  roleFindUnique: vi.fn(),
  personRoleUpsert: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    diagnosticCenter: { findUnique: mocks.centerFindUnique },
    laboratory: { findUnique: mocks.labFindUnique },
    organization: { findFirst: mocks.organizationFindFirst, upsert: mocks.organizationUpsert },
    diagnosticCenterMember: { upsert: mocks.centerMemberUpsert },
    laboratoryMember: { upsert: mocks.labMemberUpsert },
    person: {
      findFirst: mocks.personFindFirst,
      findUnique: mocks.personFindUnique,
      create: mocks.personCreate,
      update: mocks.personUpdate,
    },
    role: { findUnique: mocks.roleFindUnique },
    personRole: { upsert: mocks.personRoleUpsert },
  },
}));

import { DIAGNOSTICS_ROLE_TO_ROLE_KEY, grantDiagnosticsAccess } from './diagnostics.service.js';

const CENTER_ID = 'center-1';
const USER_ID = 'user-1';

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.userFindUnique.mockResolvedValue({
    id: USER_ID, firstName: 'A', lastName: 'B', email: 'a@b.com', phone: null,
  });
  mocks.centerFindUnique.mockResolvedValue({ id: CENTER_ID, name: 'Center', city: null, address: null, phone: null, email: null });
  mocks.organizationFindFirst.mockResolvedValue({ id: 'org-center' });
  mocks.organizationUpsert.mockResolvedValue({ id: 'org-center' });
  mocks.personFindFirst.mockResolvedValue(null);
  mocks.personCreate.mockResolvedValue({ id: 'person-1' });
  mocks.personUpdate.mockResolvedValue({ id: 'person-1' });
  mocks.roleFindUnique.mockResolvedValue({ id: 'role-1' });
});

describe('DIAGNOSTICS_ROLE_TO_ROLE_KEY', () => {
  it('omits roles that have no seeded counterpart', () => {
    expect(DIAGNOSTICS_ROLE_TO_ROLE_KEY.radiologist).toBeUndefined();
    expect(DIAGNOSTICS_ROLE_TO_ROLE_KEY.operator).toBeUndefined();
  });

  it('never maps anything to org_admin', () => {
    expect(Object.values(DIAGNOSTICS_ROLE_TO_ROLE_KEY)).not.toContain('org_admin');
  });
});

describe('grantDiagnosticsAccess — unified role', () => {
  it('assigns the role the member actually has', async () => {
    await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'manager');

    expect(mocks.roleFindUnique).toHaveBeenCalledWith({ where: { key: 'manager' } });
    expect(mocks.personRoleUpsert).toHaveBeenCalledOnce();
  });

  it('is case-insensitive about the stored member role', async () => {
    await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'OWNER');

    expect(mocks.roleFindUnique).toHaveBeenCalledWith({ where: { key: 'owner' } });
  });

  it('fails closed for a role with no unified counterpart', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'radiologist');

    expect(ok).toBe(true); // membership still granted
    expect(mocks.personRoleUpsert).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('still records the legacy membership and the Person when the role is unmapped', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'operator');

    expect(mocks.centerMemberUpsert).toHaveBeenCalledOnce();
    expect(mocks.personCreate).toHaveBeenCalledOnce();
  });
});

describe('grantDiagnosticsAccess — organization isolation', () => {
  it('keys the Person on this membership instead of stealing the user’s existing one', async () => {
    await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'owner');

    // The user-wide lookup is what used to relocate a clinic Person into the
    // diagnostics organization, severing the clinic membership.
    expect(mocks.personFindUnique).not.toHaveBeenCalled();
    expect(mocks.personFindFirst).toHaveBeenCalledWith({
      where: { originalType: 'DiagnosticCenterMember', originalId: `${CENTER_ID}:${USER_ID}` },
    });
    expect(mocks.personCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-center' }) }),
    );
  });

  it('uses the laboratory member key for laboratories', async () => {
    mocks.labFindUnique.mockResolvedValue({ id: 'lab-1', name: 'Lab', city: null, address: null, phone: null, email: null });

    await grantDiagnosticsAccess('Laboratory', 'lab-1', USER_ID, 'admin');

    expect(mocks.labMemberUpsert).toHaveBeenCalledOnce();
    expect(mocks.personFindFirst).toHaveBeenCalledWith({
      where: { originalType: 'LaboratoryMember', originalId: `lab-1:${USER_ID}` },
    });
  });
});
