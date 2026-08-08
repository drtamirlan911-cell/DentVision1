import { beforeEach, describe, expect, it, vi } from 'vitest';

const { referralFindUnique, clinicMemberFindFirst } = vi.hoisted(() => ({
  referralFindUnique: vi.fn(),
  clinicMemberFindFirst: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    referral: { findUnique: referralFindUnique },
    clinicMember: { findFirst: clinicMemberFindFirst },
  },
}));

import { authorizeReferralListScope, requireReferralAccess } from './diagnostics.routes.js';

beforeEach(() => {
  referralFindUnique.mockReset();
  clinicMemberFindFirst.mockReset();
});

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireReferralAccess middleware', () => {
  const referral = { clinicId: 'clinic-1', doctorId: 'doc-1', centerId: 'center-1', labId: null };

  it('admits SUPERADMIN unconditionally', async () => {
    referralFindUnique.mockResolvedValueOnce(referral);
    const req: any = { params: { id: 'r1' }, user: { id: 'someone', role: 'SUPERADMIN' } };
    const res = mockRes();
    const next = vi.fn();
    await requireReferralAccess()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('admits the referring doctor', async () => {
    referralFindUnique.mockResolvedValueOnce(referral);
    const req: any = { params: { id: 'r1' }, user: { id: 'doc-1', role: 'DOCTOR' } };
    const res = mockRes();
    const next = vi.fn();
    await requireReferralAccess()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('admits a member of the referring clinic', async () => {
    referralFindUnique.mockResolvedValueOnce(referral);
    clinicMemberFindFirst.mockResolvedValueOnce({ id: 'm1' });
    const req: any = { params: { id: 'r1' }, user: { id: 'staff-1', role: 'ASSISTANT' } };
    const res = mockRes();
    const next = vi.fn();
    await requireReferralAccess()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(clinicMemberFindFirst).toHaveBeenCalledWith({ where: { userId: 'staff-1', clinicId: 'clinic-1' } });
  });

  it('rejects an unrelated user with 403 when includeCenterLab is false (default)', async () => {
    referralFindUnique.mockResolvedValueOnce(referral);
    clinicMemberFindFirst.mockResolvedValueOnce(null);
    const req: any = {
      params: { id: 'r1' },
      user: { id: 'center-staff', role: 'DOCTOR', organizationType: 'DIAGNOSTIC_CENTER', organizationId: 'center-1' },
    };
    const res = mockRes();
    const next = vi.fn();
    await requireReferralAccess()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('admits the executing center staff only when includeCenterLab is true', async () => {
    referralFindUnique.mockResolvedValueOnce(referral);
    clinicMemberFindFirst.mockResolvedValueOnce(null);
    const req: any = {
      params: { id: 'r1' },
      user: { id: 'center-staff', role: 'DOCTOR', organizationType: 'DIAGNOSTIC_CENTER', organizationId: 'center-1' },
    };
    const res = mockRes();
    const next = vi.fn();
    await requireReferralAccess(true)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects staff of a DIFFERENT center even with includeCenterLab true', async () => {
    referralFindUnique.mockResolvedValueOnce(referral);
    clinicMemberFindFirst.mockResolvedValueOnce(null);
    const req: any = {
      params: { id: 'r1' },
      user: { id: 'other-center-staff', role: 'DOCTOR', organizationType: 'DIAGNOSTIC_CENTER', organizationId: 'center-99' },
    };
    const res = mockRes();
    const next = vi.fn();
    await requireReferralAccess(true)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('admits the executing lab staff when includeCenterLab is true', async () => {
    referralFindUnique.mockResolvedValueOnce({ ...referral, centerId: null, labId: 'lab-1' });
    clinicMemberFindFirst.mockResolvedValueOnce(null);
    const req: any = {
      params: { id: 'r1' },
      user: { id: 'lab-staff', role: 'LAB', organizationType: 'LABORATORY', organizationId: 'lab-1' },
    };
    const res = mockRes();
    const next = vi.fn();
    await requireReferralAccess(true)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 404 for a non-existent referral', async () => {
    referralFindUnique.mockResolvedValueOnce(null);
    const req: any = { params: { id: 'missing' }, user: { id: 'u1', role: 'DOCTOR' } };
    const res = mockRes();
    const next = vi.fn();
    await requireReferralAccess()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('authorizeReferralListScope', () => {
  it('allows SUPERADMIN with no scope at all', async () => {
    const result = await authorizeReferralListScope({ id: 'admin', role: 'SUPERADMIN' } as any, {});
    expect(result).toEqual({ ok: true });
  });

  it('rejects a non-superadmin query with no scope (would enumerate the whole platform)', async () => {
    const result = await authorizeReferralListScope({ id: 'u1', role: 'DOCTOR' } as any, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('allows a clinicId the caller is a member of', async () => {
    clinicMemberFindFirst.mockResolvedValueOnce({ id: 'm1' });
    const result = await authorizeReferralListScope({ id: 'u1', role: 'DOCTOR' } as any, { clinicId: 'clinic-1' });
    expect(result).toEqual({ ok: true });
  });

  it('rejects a clinicId the caller is NOT a member of', async () => {
    clinicMemberFindFirst.mockResolvedValueOnce(null);
    const result = await authorizeReferralListScope({ id: 'u1', role: 'DOCTOR' } as any, { clinicId: 'someone-elses-clinic' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('allows a centerId matching the caller\'s own organization context', async () => {
    const result = await authorizeReferralListScope(
      { id: 'u1', role: 'DOCTOR', organizationType: 'DIAGNOSTIC_CENTER', organizationId: 'center-1' } as any,
      { centerId: 'center-1' },
    );
    expect(result).toEqual({ ok: true });
  });

  it('rejects a centerId that does not match the caller\'s organization', async () => {
    const result = await authorizeReferralListScope(
      { id: 'u1', role: 'DOCTOR', organizationType: 'DIAGNOSTIC_CENTER', organizationId: 'center-1' } as any,
      { centerId: 'center-99' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('rejects a labId that does not match the caller\'s organization', async () => {
    const result = await authorizeReferralListScope(
      { id: 'u1', role: 'DOCTOR', organizationType: 'LABORATORY', organizationId: 'lab-1' } as any,
      { labId: 'lab-99' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
