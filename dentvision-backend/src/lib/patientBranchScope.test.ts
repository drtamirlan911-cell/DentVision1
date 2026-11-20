import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock('./prisma.js', () => ({ default: { $queryRaw: queryRaw } }));

import { canAccessPatientBranch, resolvePatientBranchContext, type PatientBranchContext } from './patientBranchScope.js';

const context = (kind: PatientBranchContext['scope']['kind'], branchIds: string[]): PatientBranchContext => ({
  clinicId: 'clinic-a',
  userId: 'user-a',
  role: kind === 'organization' ? 'OWNER' : kind === 'branch' ? 'MANAGER' : 'DOCTOR',
  branchId: branchIds[0] ?? null,
  scope: { kind, branchIds },
});

beforeEach(() => {
  queryRaw.mockReset().mockResolvedValue([]);
});

describe('patient branch scope', () => {
  it('keeps canonical BranchMember allow-lists when no legacy membership is present', async () => {
    queryRaw.mockResolvedValueOnce([]);
    const actor = await resolvePatientBranchContext('user-a', 'clinic-a', 'DOCTOR', ['branch-a', 'branch-b'], 'branch-a');
    expect(actor.scope).toEqual({ kind: 'assigned', branchIds: ['branch-a', 'branch-b'] });
    expect(actor.branchId).toBe('branch-a');
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
    expect(canAccessPatientBranch(actor, 'branch-c')).toBe(false);
  });

  it('fails closed for organization roles when auth and the exact clinic membership supply no active branches', async () => {
    queryRaw.mockResolvedValueOnce([]);
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

  
  it('recovers an active exact-clinic legacy assignment when an older session lacks branchIds', async () => {
    queryRaw.mockResolvedValueOnce([{ branch_id: 'branch-a', branch_active: true }]);
    const actor = await resolvePatientBranchContext('doctor-a', 'clinic-a', 'DOCTOR', [], null);
    expect(actor.scope.branchIds).toEqual(['branch-a']);
    expect(actor.branchId).toBe('branch-a');
    expect(canAccessPatientBranch(actor, 'branch-a')).toBe(true);
  });

  it('does not recover an archived legacy assignment', async () => {
    queryRaw.mockResolvedValueOnce([{ branch_id: 'branch-archived', branch_active: false }]);
    const actor = await resolvePatientBranchContext('doctor-a', 'clinic-a', 'DOCTOR', [], null);
    expect(actor.scope.branchIds).toEqual([]);
    expect(canAccessPatientBranch(actor, 'branch-archived')).toBe(false);
  });

  it('fails closed for legacy patients without a branch', () => {
    const actor = context('assigned', ['branch-a']);
    expect(canAccessPatientBranch(actor, null)).toBe(false);
  });
});