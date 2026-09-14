import { describe, expect, it } from 'vitest';
import { canAccessPatientBranch, type PatientBranchContext } from './patientBranchScope.js';

const context = (kind: PatientBranchContext['scope']['kind'], branchIds: string[]): PatientBranchContext => ({
  clinicId: 'clinic-a',
  userId: 'user-a',
  role: kind === 'organization' ? 'OWNER' : kind === 'branch' ? 'MANAGER' : 'DOCTOR',
  branchId: branchIds[0] ?? null,
  scope: { kind, branchIds },
});

describe('patient branch scope', () => {
  it('allows organization roles to access all assigned organization branches', () => {
    const actor = context('organization', ['branch-a', 'branch-b']);
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(actor, 'branch-b')).toBe(true);
  });

  it('keeps manager access inside the assigned branch', () => {
    const actor = context('branch', ['branch-a']);
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(actor, 'branch-b')).toBe(false);
  });

  it('keeps doctor access inside the assigned branch', () => {
    const actor = context('assigned', ['branch-a']);
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(actor, 'branch-b')).toBe(false);
  });

  it('fails closed for legacy patients without a branch', () => {
    const actor = context('assigned', ['branch-a']);
    expect(canAccessPatientBranch(actor, null)).toBe(false);
  });
});