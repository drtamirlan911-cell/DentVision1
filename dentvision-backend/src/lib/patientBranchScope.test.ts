import { describe, expect, it } from 'vitest';
import { canAccessPatientBranch, resolvePatientBranchContext, type PatientBranchContext } from './patientBranchScope.js';

const context = (kind: PatientBranchContext['scope']['kind'], branchIds: string[]): PatientBranchContext => ({
  clinicId: 'clinic-a',
  userId: 'user-a',
  role: kind === 'organization' ? 'OWNER' : kind === 'branch' ? 'MANAGER' : 'DOCTOR',
  branchId: branchIds[0] ?? null,
  scope: { kind, branchIds },
});

describe('patient branch scope', () => {
  it('uses trusted canonical BranchMember allow-lists without requiring ClinicMember reads', async () => {
    const actor = await resolvePatientBranchContext('user-a', 'clinic-a', 'DOCTOR', ['branch-a', 'branch-b'], 'branch-a');
    expect(actor.scope).toEqual({ kind: 'assigned', branchIds: ['branch-a', 'branch-b'] });
    expect(actor.branchId).toBe('branch-a');
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(actor, 'branch-c')).toBe(false);
  });

  it('fails closed for organization roles when auth supplies no active branches', async () => {
    const actor = await resolvePatientBranchContext('owner-a', 'clinic-a', 'OWNER', [], null);
    expect(actor.scope).toEqual({ kind: 'organization', branchIds: [] });
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(false);
  });

  it('does not widen a manager beyond their authenticated branch allow-list', async () => {
    const actor = await resolvePatientBranchContext('manager-a', 'clinic-a', 'MANAGER', ['branch-a'], 'branch-a');
    expect(actor.scope).toEqual({ kind: 'branch', branchIds: ['branch-a'] });
    expect(canAccessPatientBranch(actor, 'branch-b')).toBe(false);
  });

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