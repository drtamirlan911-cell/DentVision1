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

import { assertClinicMemberAccess, assertClinicBillingAccess } from './clinicSubscription.service.js';

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
