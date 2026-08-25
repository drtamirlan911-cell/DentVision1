import { describe, expect, it, vi } from 'vitest';
import { assertSameClinic, requireClinicScope, resolveScopeId } from './clinicAccess.js';
import type { AuthRequest } from '../types/index.js';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(user: Partial<AuthRequest['user']> | null): AuthRequest {
  return { user: user as AuthRequest['user'] } as AuthRequest;
}

describe('assertSameClinic', () => {
  it('SUPERADMIN can access any clinic\'s resource, including one they are not scoped to', () => {
    const req = mockReq({ role: 'SUPERADMIN', clinicId: 'clinic-a' } as any);
    const res = mockRes();
    expect(assertSameClinic(req, res, 'clinic-b')).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('non-superadmin can read their own clinic\'s resource', () => {
    const req = mockReq({ role: 'OWNER', clinicId: 'clinic-a' } as any);
    const res = mockRes();
    expect(assertSameClinic(req, res, 'clinic-a')).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('non-superadmin is denied access to another clinic\'s resource (403 CLINIC_MISMATCH)', () => {
    const req = mockReq({ role: 'OWNER', clinicId: 'clinic-a' } as any);
    const res = mockRes();
    expect(assertSameClinic(req, res, 'clinic-b')).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CLINIC_MISMATCH' }));
  });

  it('a user with no clinic scope at all is denied (403 CLINIC_REQUIRED)', () => {
    const req = mockReq({ role: 'OWNER', clinicId: null } as any);
    const res = mockRes();
    expect(assertSameClinic(req, res, 'clinic-a')).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CLINIC_REQUIRED' }));
  });

  it('guests are denied outright', () => {
    const req = mockReq({ role: 'OWNER', clinicId: 'clinic-a', isGuest: true } as any);
    const res = mockRes();
    expect(assertSameClinic(req, res, 'clinic-a')).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GUEST_FORBIDDEN' }));
  });
});

describe('resolveScopeId', () => {
  it('resolves the caller\'s clinicId', () => {
    const req = mockReq({ clinicId: 'legacy-clinic-1' } as any);
    expect(resolveScopeId(req)).toBe('legacy-clinic-1');
  });

  it('returns null when the user has no clinicId', () => {
    const req = mockReq({ clinicId: null } as any);
    expect(resolveScopeId(req)).toBe(null);
  });
});

describe('requireClinicScope', () => {
  it('SUPERADMIN with an explicit paramClinicId gets that clinic scoped', () => {
    const req = mockReq({ role: 'SUPERADMIN', clinicId: 'clinic-a' } as any);
    const res = mockRes();
    expect(requireClinicScope(req, res, { paramClinicId: 'clinic-b' })).toBe('clinic-b');
  });

  it('non-superadmin passing a mismatched paramClinicId is denied', () => {
    const req = mockReq({ role: 'OWNER', clinicId: 'clinic-a' } as any);
    const res = mockRes();
    expect(requireClinicScope(req, res, { paramClinicId: 'clinic-b' })).toBe(null);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CLINIC_MISMATCH' }));
  });
});
