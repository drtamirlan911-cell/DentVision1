import { describe, expect, it, vi } from 'vitest';

const { resolveClinicAccess, userFindUnique } = vi.hoisted(() => ({
  resolveClinicAccess: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('../../lib/orgContext.js', () => ({ resolveClinicAccess }));
vi.mock('../../lib/prisma.js', () => ({
  default: {
    user: { findUnique: userFindUnique },
  },
}));

import {
  assertClinicMemberAccess,
  assertClinicBillingAccess,
  getClinicSubscriptionAmountMinor,
  upsertClinicSubscription,
} from './clinicSubscription.service.js';

describe('assertClinicMemberAccess', () => {
  it('rejects a missing clinicId with 400', async () => {
    await expect(assertClinicMemberAccess('u1', '')).rejects.toMatchObject({ status: 400 });
  });

  it('allows any resolved clinic role (unified Person/PersonRole path)', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'ASSISTANT' });
    const result = await assertClinicMemberAccess('u1', 'c1');
    expect(result).toEqual({ source: 'unified', role: 'ASSISTANT' });
  });

  it('falls back to platform SUPERADMIN when the clinic resolver finds nothing', async () => {
    resolveClinicAccess.mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ role: 'SUPERADMIN' });
    const result = await assertClinicMemberAccess('u1', 'c1');
    expect(result).toEqual({ source: 'superadmin', role: 'SUPERADMIN' });
  });

  it('rejects with 403 when neither the clinic resolver nor SUPERADMIN applies', async () => {
    resolveClinicAccess.mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    await expect(assertClinicMemberAccess('u1', 'c1')).rejects.toMatchObject({ status: 403 });
  });

  it('treats a resolver DB error as non-fatal and still allows the SUPERADMIN fallback', async () => {
    resolveClinicAccess.mockRejectedValueOnce(new Error('db down'));
    userFindUnique.mockResolvedValueOnce({ role: 'SUPERADMIN' });
    const result = await assertClinicMemberAccess('u1', 'c1');
    expect(result).toEqual({ source: 'superadmin', role: 'SUPERADMIN' });
  });
});

describe('assertClinicBillingAccess', () => {
  it('rejects a missing clinicId with 400', async () => {
    await expect(assertClinicBillingAccess('u1', '')).rejects.toMatchObject({ status: 400 });
  });

  it('allows OWNER and ADMIN clinic roles', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'OWNER' });
    const owner = await assertClinicBillingAccess('u1', 'c1');
    expect(owner.role).toBe('OWNER');

    resolveClinicAccess.mockResolvedValueOnce({ role: 'ADMIN' });
    const admin = await assertClinicBillingAccess('u1', 'c1');
    expect(admin.role).toBe('ADMIN');
  });

  it('rejects a resolved clinic role outside OWNER/ADMIN/SUPERADMIN, even without a platform SUPERADMIN', async () => {
    resolveClinicAccess.mockResolvedValueOnce({ role: 'ASSISTANT' });
    userFindUnique.mockResolvedValueOnce({ role: 'ASSISTANT' });
    await expect(assertClinicBillingAccess('u1', 'c1')).rejects.toMatchObject({ status: 403 });
  });

  it('allows a platform SUPERADMIN even with no clinic-level role', async () => {
    resolveClinicAccess.mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValueOnce({ role: 'SUPERADMIN' });
    const result = await assertClinicBillingAccess('u1', 'c1');
    expect(result).toEqual({ source: 'superadmin', role: 'SUPERADMIN' });
  });
});


describe('canonical clinic subscription pricing', () => {
  it.each([
    ['starter', 19900, 1, 1990000n],
    ['professional', 39900, 1, 3990000n],
    ['enterprise', 79900, 1, 7990000n],
    ['professional', 39900, 3, 11970000n],
    ['enterprise', 79900, 12, 95880000n],
  ])('computes the expected amount for plan %s', (plan, _monthlyTenge, months, expected) => {
    expect(getClinicSubscriptionAmountMinor(plan, months)).toBe(expected);
  });

  it.each([
    ['unknown', 1],
    ['network', 1],
    ['professional', 0],
    ['professional', 25],
    ['professional', 1.5],
    ['professional', '3'],
    ['', 1],
  ])('rejects invalid plan/months (%s, %s)', (plan, months) => {
    expect(getClinicSubscriptionAmountMinor(plan, months)).toBeNull();
  });
});


describe('clinic subscription expiry keeps tenant lifecycle separate', () => {
  it('preserves Clinic.active when the subscription status becomes expired', async () => {
    const db = {
      clinic: { update: vi.fn().mockResolvedValue({ id: 'c1', active: true }) },
      subscription: { upsert: vi.fn().mockResolvedValue({ id: 's1', status: 'expired' }) },
    };
    await upsertClinicSubscription({
      clinicId: 'c1', saasPlan: 'enterprise', clinicPlan: 'ENTERPRISE' as any,
      status: 'expired', periodEnd: new Date('2026-10-01T00:00:00.000Z'),
    }, db as any);
    expect(db.clinic.update).toHaveBeenCalledWith({
      where: { id: 'c1' }, data: { plan: 'ENTERPRISE' },
    });
    expect(db.subscription.upsert).toHaveBeenCalledOnce();
  });

  it('keeps explicit suspension distinct from subscription expiry', async () => {
    const db = {
      clinic: { update: vi.fn().mockResolvedValue({ id: 'c1', active: false }) },
      subscription: { upsert: vi.fn().mockResolvedValue({ id: 's1', status: 'suspended' }) },
    };
    await upsertClinicSubscription({
      clinicId: 'c1', saasPlan: 'enterprise', clinicPlan: 'ENTERPRISE' as any,
      status: 'suspended', periodEnd: new Date('2026-10-01T00:00:00.000Z'),
    }, db as any);
    expect(db.clinic.update).toHaveBeenCalledWith({
      where: { id: 'c1' }, data: { plan: 'ENTERPRISE', active: false },
    });
  });
});
