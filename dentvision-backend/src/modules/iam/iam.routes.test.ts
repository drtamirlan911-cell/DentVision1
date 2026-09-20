import { beforeEach, describe, expect, it, vi } from 'vitest';

const { userFindUnique, organizationFindFirst, personFindFirst, clinicMemberFindUnique, diagnosticCenterMemberFindFirst, laboratoryMemberFindFirst } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  organizationFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  clinicMemberFindUnique: vi.fn(),
  diagnosticCenterMemberFindFirst: vi.fn(),
  laboratoryMemberFindFirst: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    user: { findUnique: userFindUnique },
    organization: { findFirst: organizationFindFirst },
    person: { findFirst: personFindFirst },
    clinicMember: { findUnique: clinicMemberFindUnique },
    diagnosticCenterMember: { findFirst: diagnosticCenterMemberFindFirst },
    laboratoryMember: { findFirst: laboratoryMemberFindFirst },
  },
}));

import { canManageRolesFor } from './iam.routes.js';

const USER_ID = 'user-1';

beforeEach(() => {
  userFindUnique.mockReset();
  organizationFindFirst.mockReset();
  personFindFirst.mockReset();
  clinicMemberFindUnique.mockReset();
  diagnosticCenterMemberFindFirst.mockReset();
  laboratoryMemberFindFirst.mockReset();
});

describe('canManageRolesFor', () => {
  it('admits SUPERADMIN unconditionally, without any DB lookup', async () => {
    const result = await canManageRolesFor({ id: USER_ID, role: 'SUPERADMIN' }, null);
    expect(result).toBe(true);
    expect(organizationFindFirst).not.toHaveBeenCalled();
  });

  it('rejects when the person has no organization at all', async () => {
    const result = await canManageRolesFor({ id: USER_ID, role: 'DOCTOR' }, null);
    expect(result).toBe(false);
  });

  it('rejects a non-manager clinic member (e.g. DOCTOR)', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' },
    );
    expect(result).toBe(false);
  });

  it('admits a clinic OWNER', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    organizationFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'OWNER' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'OWNER' },
      { id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' },
    );
    expect(result).toBe(true);
  });

  it('admits a clinic ADMIN', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    organizationFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'ADMIN' },
      { id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' },
    );
    expect(result).toBe(true);
  });

  it('rejects when the caller has no membership in the clinic at all', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    organizationFindFirst.mockResolvedValueOnce(null);
    personFindFirst.mockResolvedValueOnce(null);
    clinicMemberFindUnique.mockResolvedValueOnce(null);
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'CLINIC', originalId: 'clinic-1' },
    );
    expect(result).toBe(false);
  });

  it('admits a diagnostic-center manager', async () => {
    diagnosticCenterMemberFindFirst.mockResolvedValueOnce({ role: 'admin' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'DIAGNOSTIC_CENTER', originalId: 'center-1' },
    );
    expect(result).toBe(true);
  });

  it('rejects a diagnostic-center member without a manager role', async () => {
    diagnosticCenterMemberFindFirst.mockResolvedValueOnce({ role: 'radiologist' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'DIAGNOSTIC_CENTER', originalId: 'center-1' },
    );
    expect(result).toBe(false);
  });

  it('admits a laboratory manager', async () => {
    laboratoryMemberFindFirst.mockResolvedValueOnce({ role: 'owner' });
    const result = await canManageRolesFor(
      { id: USER_ID, role: 'DOCTOR' },
      { id: 'org-1', type: 'LABORATORY', originalId: 'lab-1' },
    );
    expect(result).toBe(true);
  });
});
