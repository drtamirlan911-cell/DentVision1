/**
 * Authorization for patient-consented, cross-clinic access to medical
 * history (`CrossClinicAccessGrant`). Modeled on `requireReferralAccess`
 * (diagnostics.routes.ts) but deliberately only DB-verified checks —
 * `diagnostics.routes.ts`'s `hasOrgAccess` compares a JWT claim without
 * re-querying membership, which is an acceptable trade for referral-inbox
 * access but not for granting one clinic's staff a read into another
 * clinic's patient chart.
 *
 * A grant is honored only while it is `APPROVED`, not revoked, and not
 * expired — checked fresh from the database on every single call, never
 * cached in a session or JWT. The patient's revoke action must cut off
 * access on the very next request, not "eventually" or "after re-login".
 */
import type { Response } from 'express';
import prisma from './prisma.js';
import { requireClinicScope } from './clinicAccess.js';
import type { AuthRequest } from '../types/index.js';

export interface ActiveCrossClinicGrant {
  id: string;
  patientUserId: string;
  sourceClinicId: string;
  sourcePatientId: string;
  receivingClinicId: string;
  receivingPatientId: string;
}

/** The one active-grant query — every other function/middleware here funnels through it. */
export async function resolveActiveGrant(
  receivingClinicId: string,
  sourcePatientId: string,
): Promise<ActiveCrossClinicGrant | null> {
  return prisma.crossClinicAccessGrant.findFirst({
    where: {
      receivingClinicId,
      sourcePatientId,
      status: 'APPROVED',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      patientUserId: true,
      sourceClinicId: true,
      sourcePatientId: true,
      receivingClinicId: true,
      receivingPatientId: true,
    },
  });
}

/**
 * Route guard for `GET /api/cross-clinic/history/:sourcePatientId` and
 * similar reads. Requires the caller to be a real, currently-active member
 * of a clinic (fail-closed, DB-verified via `requireClinicScope` — SUPERADMIN
 * bypass included, matching every other clinic-scoped route in this
 * codebase) *and* an `APPROVED` grant naming exactly this
 * (receivingClinic, sourcePatient) pair. Attaches the resolved grant to
 * `req.crossClinicGrant` for the handler to use without a second query.
 */
export function requireCrossClinicAccess() {
  return async (req: AuthRequest, res: Response, next: any) => {
    try {
      const receivingClinicId = requireClinicScope(req, res);
      if (!receivingClinicId) return; // requireClinicScope already responded

      const sourcePatientId = req.params.sourcePatientId as string | undefined;
      if (!sourcePatientId) {
        return res.status(400).json({ ok: false, error: 'sourcePatientId обязателен' });
      }

      const grant = await resolveActiveGrant(receivingClinicId, sourcePatientId);
      if (!grant) {
        return res.status(403).json({ ok: false, error: 'Нет согласия пациента на просмотр этих данных' });
      }

      (req as AuthRequest & { crossClinicGrant?: ActiveCrossClinicGrant }).crossClinicGrant = grant;
      return next();
    } catch {
      return res.status(500).json({ ok: false, error: 'Ошибка проверки доступа' });
    }
  };
}
