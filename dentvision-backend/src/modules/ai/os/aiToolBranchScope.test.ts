import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveAccess } = vi.hoisted(() => ({ resolveAccess: vi.fn() }));
vi.mock('../../../lib/clinicBranchAccess.js', () => ({
  resolveClinicBranchAccess: resolveAccess,
}));

import {
  resolveAiToolBranchScope,
  isNarrowAiToolBranchScope,
  patientBranchWhere,
  appointmentBranchWhere,
  invoiceBranchWhere,
  inventoryBranchWhere,
  labOrderBranchWhere,
} from './aiToolBranchScope.js';

const input = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  clinicId: 'clinic-1',
  organizationId: 'org-1',
  role: 'DOCTOR',
  requestedBranchId: null,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('resolveAiToolBranchScope', () => {
  it('delegates identity and branch selectors to the shared server-side IAM resolver', async () => {
    const expected = { roleScope: 'ASSIGNED', branchId: 'branch-1', allowedBranchIds: ['branch-1'] };
    resolveAccess.mockResolvedValue(expected);
    await expect(resolveAiToolBranchScope(input())).resolves.toEqual(expected);
    expect(resolveAccess).toHaveBeenCalledWith(input());
  });

  it('returns deny when the shared resolver rejects the active workspace', async () => {
    resolveAccess.mockResolvedValue(null);
    await expect(resolveAiToolBranchScope(input({ requestedBranchId: 'branch-victim' }))).resolves.toBeNull();
  });

  it('preserves organization-wide access only when no branch is selected', async () => {
    resolveAccess.mockResolvedValue({
      roleScope: 'ORGANIZATION', branchId: null, allowedBranchIds: ['branch-1', 'branch-2'],
    });
    const scope = await resolveAiToolBranchScope(input({ role: 'OWNER' }));
    expect(scope).toMatchObject({ roleScope: 'ORGANIZATION', branchId: null });
    expect(isNarrowAiToolBranchScope(scope!)).toBe(false);
  });
});

describe('branch-aware Prisma predicates', () => {
  const narrow = { roleScope: 'ASSIGNED' as const, branchId: 'branch-1', allowedBranchIds: ['branch-1'] };

  it('filters patients, inventory and patient-linked lab orders', () => {
    expect(patientBranchWhere(narrow)).toEqual({ branchId: 'branch-1' });
    expect(inventoryBranchWhere(narrow)).toEqual({ branchId: 'branch-1' });
    expect(labOrderBranchWhere(narrow)).toEqual({ patient: { branchId: 'branch-1' } });
  });

  it('requires appointment and invoice branch to agree with linked patient branch', () => {
    const expected = {
      patient: { branchId: 'branch-1' },
      OR: [{ branchId: 'branch-1' }, { branchId: null }],
    };
    expect(appointmentBranchWhere(narrow)).toEqual(expected);
    expect(invoiceBranchWhere(narrow)).toEqual(expected);
  });

  it('does not narrow an organization-wide scope with no selected branch', () => {
    const wide = { roleScope: 'ORGANIZATION' as const, branchId: null, allowedBranchIds: ['branch-1', 'branch-2'] };
    expect(patientBranchWhere(wide)).toEqual({});
    expect(appointmentBranchWhere(wide)).toEqual({});
    expect(invoiceBranchWhere(wide)).toEqual({});
    expect(inventoryBranchWhere(wide)).toEqual({});
    expect(labOrderBranchWhere(wide)).toEqual({});
  });
});
