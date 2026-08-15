import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireClinicScope } from '../../lib/clinicAccess.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import * as svc from './cross-clinic.service.js';

export const crossClinicRouter = Router();

crossClinicRouter.use(authenticate);

/**
 * Clinic staff request access to a walk-in's history at other clinics.
 * `receivingPatientId` must be a patient already created in the caller's own
 * clinic — see cross-clinic.service.ts's requestAccess() doc comment for why
 * the response is always the same regardless of outcome.
 */
crossClinicRouter.post('/request', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinicScope(req, res);
    if (!clinicId) return;

    const receivingPatientId = String(req.body?.receivingPatientId || '');
    if (!receivingPatientId) {
      return res.status(400).json({ ok: false, error: 'receivingPatientId обязателен' } satisfies ApiResponse);
    }

    const result = await svc.requestAccess(clinicId, receivingPatientId, req.user!.id, req.ip);
    return res.json({ ok: true, data: result } satisfies ApiResponse);
  } catch (error) {
    console.error('Cross-clinic request error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отправить запрос' } satisfies ApiResponse);
  }
});

crossClinicRouter.get('/status/:receivingPatientId', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinicScope(req, res);
    if (!clinicId) return;

    const status = await svc.getStatus(clinicId, req.params.receivingPatientId as string);
    return res.json({ ok: true, data: { status } } satisfies ApiResponse);
  } catch (error) {
    console.error('Cross-clinic status error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить статус' } satisfies ApiResponse);
  }
});

/**
 * The grant itself is the security boundary here, not this route: every
 * CrossClinicAccessGrant row's (receivingClinicId, receivingPatientId) pair
 * was set at request time to the requesting clinic's own id and its own
 * local patient row, so a grant can only ever match when `clinicId` (from
 * the caller's verified JWT via requireClinicScope) is the same clinic that
 * actually requested it — a different clinic passing the same patient id
 * simply matches zero grants.
 */
crossClinicRouter.get('/history/:receivingPatientId', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinicScope(req, res);
    if (!clinicId) return;

    const receivingPatientId = req.params.receivingPatientId as string;
    const owned = await prisma.patient.findFirst({ where: { id: receivingPatientId, clinicId }, select: { id: true } });
    if (!owned) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const history = await svc.getHistory(clinicId, receivingPatientId, req.user!.id);
    return res.json({ ok: true, data: history } satisfies ApiResponse);
  } catch (error) {
    console.error('Cross-clinic history error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить историю' } satisfies ApiResponse);
  }
});
