import type { Response } from 'express';
import type { AuthRequest, ApiResponse } from '../types/index.js';
import { getClinicId } from './orgContext.js';

/** Guests never get clinic-scoped CRM / files access. */
export function denyGuest(req: AuthRequest, res: Response): boolean {
  if (req.user?.isGuest) {
    res.status(403).json({ ok: false, error: 'Гостевой доступ запрещён', code: 'GUEST_FORBIDDEN' } satisfies ApiResponse);
    return true;
  }
  return false;
}

/**
 * Resolve effective clinic scope — checks organizationId (CLINIC type) first,
 * then falls back to legacy clinicId from JWT.
 */
export function resolveScopeId(req: AuthRequest): string | null {
  const user = req.user;
  if (!user) return null;

  // Unified: if org is a CLINIC, its id is the clinic scope
  const clinicFromOrg = getClinicId(user);
  if (clinicFromOrg) return clinicFromOrg;

  // Legacy fallback
  return user.clinicId || null;
}

/**
 * Fail-closed clinic scope: JWT must carry clinicId (except SUPERADMIN).
 * Returns clinicId to use, or null after sending an error response.
 */
export function requireClinicScope(
  req: AuthRequest,
  res: Response,
  opts?: { paramClinicId?: string },
): string | null {
  if (denyGuest(req, res)) return null;

  const role = String(req.user?.role || '').toUpperCase();
  const tokenClinic = resolveScopeId(req);
  const paramClinic = opts?.paramClinicId || null;

  if (role === 'SUPERADMIN') {
    return paramClinic || tokenClinic || null;
  }

  if (!tokenClinic) {
    res.status(403).json({
      ok: false,
      error: 'Выберите клинику',
      code: 'CLINIC_REQUIRED',
    } satisfies ApiResponse);
    return null;
  }

  if (paramClinic && paramClinic !== tokenClinic) {
    res.status(403).json({
      ok: false,
      error: 'Доступ к другой клинике запрещён',
      code: 'CLINIC_MISMATCH',
    } satisfies ApiResponse);
    return null;
  }

  return tokenClinic;
}

/** Assert a resource's clinicId matches the caller's scoped clinic. */
export function assertSameClinic(
  req: AuthRequest,
  res: Response,
  resourceClinicId: string | null | undefined,
): boolean {
  if (denyGuest(req, res)) return false;
  const role = String(req.user?.role || '').toUpperCase();
  if (role === 'SUPERADMIN') return true;

  const tokenClinic = resolveScopeId(req);
  if (!tokenClinic) {
    res.status(403).json({ ok: false, error: 'Выберите клинику', code: 'CLINIC_REQUIRED' } satisfies ApiResponse);
    return false;
  }
  if (!resourceClinicId || resourceClinicId !== tokenClinic) {
    res.status(403).json({ ok: false, error: 'Доступ запрещён', code: 'CLINIC_MISMATCH' } satisfies ApiResponse);
    return false;
  }
  return true;
}
