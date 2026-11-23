import { describe, expect, it } from 'vitest';
import { canAccessPatientBranch, canManagePatientBranch, type PatientBranchContext } from './patientBranchScope.js';

const context = (
  kind: PatientBranchContext['scope']['kind'],
  branchIds: string[],
  selectedBranchId: string | null = null,
): PatientBranchContext => ({
  clinicId: 'clinic-a',
  userId: 'user-a',
  role: kind === 'organization' ? 'OWNER' : kind === 'branch' ? 'MANAGER' : 'DOCTOR',
  branchId: selectedBranchId,
  allowedBranchIds: branchIds,
  scope: { kind, branchIds: selectedBranchId ? [selectedBranchId] : branchIds },
});

describe('patient branch scope', () => {
  it('allows an organization role to access every active branch when no branch is selected', () => {
    const actor = context('organization', ['branch-a', 'branch-b']);
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(actor, 'branch-b')).toBe(true);
    expect(canAccessPatientBranch(actor, null)).toBe(true);
  });

  it('narrows organization reads to the explicitly selected branch', () => {
    const actor = context('organization', ['branch-a', 'branch-b'], 'branch-a');
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(actor, 'branch-b')).toBe(false);
    expect(canAccessPatientBranch(actor, null)).toBe(false);
    expect(canManagePatientBranch(actor, 'branch-b')).toBe(true);
  });

  it('keeps manager access inside the assigned branch', () => {
    const actor = context('branch', ['branch-a']);
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(actor, 'branch-b')).toBe(false);
    expect(canAccessPatientBranch(actor, null)).toBe(false);
  });

  it('keeps doctor access inside the assigned branch', () => {
    const actor = context('assigned', ['branch-a']);
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(actor, 'branch-b')).toBe(false);
  });

  it('fails closed for unauthorized or revoked branch contexts', () => {
    const actor = context('assigned', []);
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(false);
    expect(canAccessPatientBranch(actor, null)).toBe(false);
  });

  it('fails closed for branchless records in a selected or assigned scope', () => {
    const actor = context('assigned', ['branch-a']);
    expect(canAccessPatientBranch(actor, null)).toBe(false);
  });
});
