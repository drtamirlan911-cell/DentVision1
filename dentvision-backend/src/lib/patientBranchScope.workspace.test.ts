import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveClinicBranchAccess } = vi.hoisted(() => ({
  resolveClinicBranchAccess: vi.fn(),
}));
vi.mock('./clinicBranchAccess.js', () => ({ resolveClinicBranchAccess }));

import {
  canAccessPatientBranch,
  canManagePatientBranch,
  resolvePatientBranchContext,
} from './patientBranchScope.js';

beforeEach(() => resolveClinicBranchAccess.mockReset());

describe('patient branch workspace context', () => {
  it('keeps an unfiltered organization context distinct from its full branch allow-list', async () => {
    resolveClinicBranchAccess.mockResolvedValue({
      roleScope: 'ORGANIZATION',
      branchId: null,
      allowedBranchIds: ['branch-a', 'branch-b'],
    });
    const context = await resolvePatientBranchContext('owner-a', 'clinic-a', 'OWNER', {
      organizationId: 'org-a',
    });
    expect(context.scope).toEqual({ kind: 'organization', branchIds: ['branch-a', 'branch-b'] });
    expect(context.allowedBranchIds).toEqual(['branch-a', 'branch-b']);
    expect(canAccessPatientBranch(context, null)).toBe(true);
    expect(canAccessPatientBranch(context, 'branch-b')).toBe(true);
  });

  it('narrows reads to the explicitly selected branch but retains the authorized management list', async () => {
    resolveClinicBranchAccess.mockResolvedValue({
      roleScope: 'ORGANIZATION',
      branchId: 'branch-a',
      allowedBranchIds: ['branch-a', 'branch-b'],
    });
    const context = await resolvePatientBranchContext('owner-a', 'clinic-a', 'OWNER', {
      organizationId: 'org-a',
      requestedBranchId: 'branch-a',
    });
    expect(context.scope).toEqual({ kind: 'organization', branchIds: ['branch-a'] });
    expect(canAccessPatientBranch(context, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(context, 'branch-b')).toBe(false);
    expect(canAccessPatientBranch(context, null)).toBe(false);
    expect(canManagePatientBranch(context, 'branch-b')).toBe(true);
  });

  it('fails closed when the active organization or branch membership cannot be resolved', async () => {
    resolveClinicBranchAccess.mockResolvedValue(null);
    const context = await resolvePatientBranchContext('user-a', 'clinic-a', 'DOCTOR', {
      organizationId: 'org-a',
      requestedBranchId: 'foreign-branch',
    });
    expect(context.branchId).toBeNull();
    expect(context.allowedBranchIds).toEqual([]);
    expect(context.scope).toEqual({ kind: 'assigned', branchIds: [] });
    expect(canAccessPatientBranch(context, 'foreign-branch')).toBe(false);
  });
});
