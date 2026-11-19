import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock('./prisma.js', () => ({
  default: { $queryRaw: queryRaw },
}));

import { resolvePatientBranchContext } from './patientBranchScope.js';
import { resolveFinanceBranchContext } from './financeBranchScope.js';
import { resolveDiagnosticBranchContext } from './diagnosticBranchScope.js';
import { resolveInventoryBranchContext } from './inventoryBranchScope.js';

const USER_ID = 'doctor-1';
const CLINIC_ID = 'clinic-1';
const ARCHIVED_BRANCH_ID = 'branch-archived';
const ACTIVE_BRANCH_ID = 'branch-active';

beforeEach(() => {
  queryRaw.mockReset().mockResolvedValue([]);
});

describe('archived branch operational scope', () => {
  it('fails closed when authentication supplies no active patient branch assignment', async () => {
    const patient = await resolvePatientBranchContext(USER_ID, CLINIC_ID, 'DOCTOR', [], null);
    expect(patient.branchId).toBeNull();
    expect(patient.scope.branchIds).toEqual([]);
  });

  it('removes an archived legacy assignment from finance, diagnostic and inventory scope', async () => {
    queryRaw.mockResolvedValueOnce([{ branch_id: ARCHIVED_BRANCH_ID, branch_active: false, role: 'DOCTOR' }]);
    const finance = await resolveFinanceBranchContext(USER_ID, CLINIC_ID, 'DOCTOR');
    expect(finance.branchId).toBeNull();
    expect(finance.branchIds).toEqual([]);
    expect(finance.organizationWide).toBe(false);

    queryRaw.mockReset().mockResolvedValueOnce([{ branch_id: ARCHIVED_BRANCH_ID, branch_active: false, role: 'DOCTOR' }]);
    const diagnostics = await resolveDiagnosticBranchContext(USER_ID, CLINIC_ID, 'DOCTOR');
    expect(diagnostics.branchId).toBeNull();
    expect(diagnostics.branchIds).toEqual([]);
    expect(diagnostics.organizationWide).toBe(false);

    queryRaw.mockReset().mockResolvedValueOnce([{ branch_id: ARCHIVED_BRANCH_ID, branch_active: false }]);
    const inventory = await resolveInventoryBranchContext(USER_ID, CLINIC_ID, 'DOCTOR');
    expect(inventory.branchId).toBeNull();
    expect(inventory.branchIds).toEqual([]);
    expect(inventory.organizationWide).toBe(false);
  });

  it('limits organization-wide visibility to active branches only', async () => {
    queryRaw.mockResolvedValueOnce([{ branch_id: ARCHIVED_BRANCH_ID, branch_active: false }])
      .mockResolvedValueOnce([{ id: ACTIVE_BRANCH_ID }]);
    const patients = await resolvePatientBranchContext(
      USER_ID, CLINIC_ID, 'OWNER', [ACTIVE_BRANCH_ID], ARCHIVED_BRANCH_ID,
    );
    expect(patients.scope.branchIds).toEqual([ACTIVE_BRANCH_ID]);

    queryRaw.mockReset()
      .mockResolvedValueOnce([{ branch_id: ARCHIVED_BRANCH_ID, branch_active: false, role: 'OWNER' }])
      .mockResolvedValueOnce([{ id: ACTIVE_BRANCH_ID }]);
    const finance = await resolveFinanceBranchContext(USER_ID, CLINIC_ID, 'OWNER');
    expect(finance.branchIds).toEqual([ACTIVE_BRANCH_ID]);

    queryRaw.mockReset()
      .mockResolvedValueOnce([{ branch_id: ARCHIVED_BRANCH_ID, branch_active: false, role: 'OWNER' }])
      .mockResolvedValueOnce([{ id: ACTIVE_BRANCH_ID }]);
    const diagnostics = await resolveDiagnosticBranchContext(USER_ID, CLINIC_ID, 'OWNER');
    expect(diagnostics.branchIds).toEqual([ACTIVE_BRANCH_ID]);

    queryRaw.mockReset()
      .mockResolvedValueOnce([{ branch_id: ARCHIVED_BRANCH_ID, branch_active: false }])
      .mockResolvedValueOnce([{ id: ACTIVE_BRANCH_ID }]);
    const inventory = await resolveInventoryBranchContext(
      USER_ID, CLINIC_ID, 'OWNER', [], ARCHIVED_BRANCH_ID,
    );
    expect(inventory.branchIds).toEqual([ACTIVE_BRANCH_ID]);
  });
});
