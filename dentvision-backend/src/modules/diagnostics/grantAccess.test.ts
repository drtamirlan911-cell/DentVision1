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
  branchFindFirst: vi.fn(),
  branchMemberUpsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    $transaction: mocks.transaction,
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
    branch: { findFirst: mocks.branchFindFirst },
    branchMember: { upsert: mocks.branchMemberUpsert },
  },
}));

import { DIAGNOSTICS_ROLE_TO_ROLE_KEY, grantDiagnosticsAccess } from './diagnostics.service.js';

const CENTER_ID = 'center-1';
const USER_ID = 'user-1';

beforeEach(() => {
  for (const [key, fn] of Object.entries(mocks)) {
    if (key !== 'transaction') fn.mockReset();
  }
  mocks.transaction.mockReset();
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
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
    branch: { findFirst: mocks.branchFindFirst },
    branchMember: { upsert: mocks.branchMemberUpsert },
  }));
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
  mocks.branchFindFirst.mockResolvedValue({ id: 'branch-default' });
  mocks.branchMemberUpsert.mockResolvedValue({ id: 'branch-member-1' });
});

describe('DIAGNOSTICS_ROLE_TO_ROLE_KEY', () => {
  it('maps seeded diagnostic roles and never grants an organization-admin fallback', () => {
    expect(DIAGNOSTICS_ROLE_TO_ROLE_KEY.owner).toBe('diagnostic_owner');
    expect(DIAGNOSTICS_ROLE_TO_ROLE_KEY.admin).toBe('diagnostic_admin');
    expect(DIAGNOSTICS_ROLE_TO_ROLE_KEY.manager).toBe('diagnostic_manager');
    expect(DIAGNOSTICS_ROLE_TO_ROLE_KEY.radiologist).toBe('radiologist');
    expect(DIAGNOSTICS_ROLE_TO_ROLE_KEY.operator).toBe('diagnostic_operator');
    expect(Object.values(DIAGNOSTICS_ROLE_TO_ROLE_KEY)).not.toContain('org_admin');
  });

  it('never maps anything to org_admin', () => {
    expect(Object.values(DIAGNOSTICS_ROLE_TO_ROLE_KEY)).not.toContain('org_admin');
  });
});

describe('grantDiagnosticsAccess — unified role', () => {
  it('assigns the role the member actually has', async () => {
    await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'manager');

    expect(mocks.roleFindUnique).toHaveBeenCalledWith({ where: { key: 'diagnostic_manager' } });
    expect(mocks.personRoleUpsert).toHaveBeenCalledOnce();
    expect(mocks.branchFindFirst).toHaveBeenCalledOnce();
  });

  it('is case-insensitive about the stored member role', async () => {
    await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'OWNER');

    expect(mocks.roleFindUnique).toHaveBeenCalledWith({ where: { key: 'diagnostic_owner' } });
  });

  it('assigns a branch-scoped diagnostic operator to only the active default branch', async () => {
    await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'operator');

    expect(mocks.branchFindFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-center', active: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    expect(mocks.branchMemberUpsert).toHaveBeenCalledWith({
      where: { personId_branchId: { personId: 'person-1', branchId: 'branch-default' } },
      update: { active: true },
      create: { id: expect.any(String), personId: 'person-1', branchId: 'branch-default', active: true },
    });
  });

  it('does not assign an assigned-work radiologist to an arbitrary default branch', async () => {
    await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'radiologist');

    expect(mocks.branchFindFirst).not.toHaveBeenCalled();
    expect(mocks.branchMemberUpsert).not.toHaveBeenCalled();
  });

  it('fails closed for a role with no unified counterpart', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await grantDiagnosticsAccess('DiagnosticCenter', CENTER_ID, USER_ID, 'custom_unmapped_role');

    expect(ok).toBe(false);
    expect(mocks.centerMemberUpsert).not.toHaveBeenCalled();
    expect(mocks.personCreate).not.toHaveBeenCalled();
    expect(mocks.personRoleUpsert).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('does not persist a legacy membership when a canonical DB role is missing', async () => {
    mocks.roleFindUnique.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ok = await grantDiagnosticsAccess('Laboratory', 'lab-missing-role', USER_ID, 'medical_lab_finance');

    expect(ok).toBe(false);
    expect(mocks.labMemberUpsert).not.toHaveBeenCalled();
    expect(mocks.personCreate).not.toHaveBeenCalled();
    expect(mocks.personRoleUpsert).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
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

  it('maps a legacy owner to the canonical dental-lab owner role when the organization is dental', async () => {
    mocks.labFindUnique.mockResolvedValue({ id: 'lab-dental', name: 'Dental Lab', city: null, address: null, phone: null, email: null });
    mocks.organizationFindFirst.mockResolvedValue({ id: 'org-dental', settings: { laboratoryType: 'DENTAL_LAB' } });

    await grantDiagnosticsAccess('Laboratory', 'lab-dental', USER_ID, 'owner');

    expect(mocks.labMemberUpsert).toHaveBeenCalledWith({
      where: { labId_userId: { labId: 'lab-dental', userId: USER_ID } },
      update: { role: 'owner' },
      create: { id: expect.any(String), labId: 'lab-dental', userId: USER_ID, role: 'owner' },
    });
    expect(mocks.roleFindUnique).toHaveBeenCalledWith({ where: { key: 'dental_lab_owner' } });
    expect(mocks.branchFindFirst).not.toHaveBeenCalled();
  });

  it('maps a legacy owner to the canonical medical-lab owner role when the organization is medical', async () => {
    mocks.labFindUnique.mockResolvedValue({ id: 'lab-medical', name: 'Medical Lab', city: null, address: null, phone: null, email: null });
    mocks.organizationFindFirst.mockResolvedValue({ id: 'org-medical', settings: { laboratoryType: 'MEDICAL_LAB' } });

    await grantDiagnosticsAccess('Laboratory', 'lab-medical', USER_ID, 'owner');

    expect(mocks.roleFindUnique).toHaveBeenCalledWith({ where: { key: 'medical_lab_owner' } });
    expect(mocks.branchFindFirst).not.toHaveBeenCalled();
  });

  it('uses the laboratory member key for laboratories', async () => {
    mocks.labFindUnique.mockResolvedValue({ id: 'lab-1', name: 'Lab', city: null, address: null, phone: null, email: null });

    await grantDiagnosticsAccess('Laboratory', 'lab-1', USER_ID, 'admin');

    expect(mocks.labMemberUpsert).toHaveBeenCalledOnce();
    expect(mocks.personFindFirst).toHaveBeenCalledWith({
      where: { originalType: 'LaboratoryMember', originalId: `lab-1:${USER_ID}` },
    });
  });

  it('assigns canonical medical-lab roles and creates only the default branch membership for branch-scoped staff', async () => {
    mocks.labFindUnique.mockResolvedValue({ id: 'lab-1', name: 'Medical Lab', city: null, address: null, phone: null, email: null });

    await grantDiagnosticsAccess('Laboratory', 'lab-1', USER_ID, 'medical_lab_technician');

    expect(mocks.labMemberUpsert).toHaveBeenCalledWith({
      where: { labId_userId: { labId: 'lab-1', userId: USER_ID } },
      update: { role: 'medical_lab_technician' },
      create: { id: expect.any(String), labId: 'lab-1', userId: USER_ID, role: 'medical_lab_technician' },
    });
    expect(mocks.roleFindUnique).toHaveBeenCalledWith({ where: { key: 'medical_lab_technician' } });
    expect(mocks.personRoleUpsert).toHaveBeenCalledOnce();
    expect(mocks.branchMemberUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { personId_branchId: { personId: 'person-1', branchId: 'branch-default' } },
    }));
  });

  it('keeps assigned dental technicians in the dental role family without granting an arbitrary branch', async () => {
    mocks.labFindUnique.mockResolvedValue({ id: 'lab-2', name: 'Dental Lab', city: null, address: null, phone: null, email: null });

    await grantDiagnosticsAccess('Laboratory', 'lab-2', USER_ID, 'dental_technician');

    expect(mocks.labMemberUpsert).toHaveBeenCalledWith({
      where: { labId_userId: { labId: 'lab-2', userId: USER_ID } },
      update: { role: 'dental_technician' },
      create: { id: expect.any(String), labId: 'lab-2', userId: USER_ID, role: 'dental_technician' },
    });
    expect(mocks.roleFindUnique).toHaveBeenCalledWith({ where: { key: 'dental_technician' } });
    expect(mocks.personRoleUpsert).toHaveBeenCalledOnce();
    expect(mocks.branchFindFirst).not.toHaveBeenCalled();
    expect(mocks.branchMemberUpsert).not.toHaveBeenCalled();
  });

  it('keeps the dental administrator canonical while preserving the legacy manager role', async () => {
    mocks.labFindUnique.mockResolvedValue({ id: 'lab-3', name: 'Dental Lab', city: null, address: null, phone: null, email: null });

    await grantDiagnosticsAccess('Laboratory', 'lab-3', USER_ID, 'dental_lab_admin');

    expect(mocks.labMemberUpsert).toHaveBeenCalledWith({
      where: { labId_userId: { labId: 'lab-3', userId: USER_ID } },
      update: { role: 'admin' },
      create: { id: expect.any(String), labId: 'lab-3', userId: USER_ID, role: 'admin' },
    });
    expect(mocks.roleFindUnique).toHaveBeenCalledWith({ where: { key: 'dental_lab_admin' } });
  });
});
