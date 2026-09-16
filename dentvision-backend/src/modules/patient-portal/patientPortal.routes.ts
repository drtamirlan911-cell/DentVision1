import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { authenticate } from '../../middleware/auth.js';
import { requireConsent } from '../../middleware/consentGate.js';
import { decryptPatientFields, encryptField } from '../../lib/phi.js';
import { resolvePatientForUser } from './patientLink.js';
import { isStorageKey, keyFromStorageUrl, signedDownloadUrl, storageConfigured } from '../../lib/storage.js';
import * as crossClinicSvc from '../cross-clinic/cross-clinic.service.js';
import * as portalSvc from './patientPortal.service.js';
import type { AuthRequest } from '../../types/index.js';
import { hmacIin } from '../../lib/phi.js';

export const patientPortalRouter = Router();
patientPortalRouter.use(authenticate);
patientPortalRouter.use(requireConsent());

async function getPatientRecord(user: { id: string; email?: string | null; phone?: string | null }) {
  const match = await resolvePatientForUser(user);
  if (!match) return null;
  const patient = await (prisma as any).patient.findUnique({
    where: { id: match.id },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, iin: true, medicalHistory: true, clinicId: true, clinic: { select: { id: true, name: true } } },
  });
  return decryptPatientFields(patient);
}

patientPortalRouter.get('/me', async (req: AuthRequest, res) => {
  try {
    const patient = await getPatientRecord(req.user!);
    if (!patient) return res.json({ ok: true, data: { noPatientRecord: true } });
    return res.json({ ok: true, data: patient });
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); }
});

/**
 * Secure patient onboarding claim. The IIN is never placed in a URL. When a
 * public treatment-plan release is supplied, its clinic becomes the only
 * allowed scope, and the submitted IIN must match that release's existing
 * patient card. No patient card is created here.
 */
patientPortalRouter.post('/claim', async (req: AuthRequest, res) => {
  try {
    const iin = String(req.body?.iin || '');
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : null;
    const releaseId = typeof req.body?.releaseId === 'string' ? req.body.releaseId : null;
    const hash = hmacIin(iin);
    if (!hash) return res.status(400).json({ ok: false, error: 'ИИН обязателен и должен содержать 12 цифр' });

    let clinicId: string | null = null;
    let releasePatientId: string | null = null;
    if (releaseId) {
      const release = await prisma.treatmentPlanRelease.findFirst({
        where: { id: releaseId, status: 'approved', publishedAt: { not: null } },
        select: { clinicId: true, patientId: true },
      });
      if (!release) return res.status(404).json({ ok: false, error: 'Публичный план не найден или больше недоступен' });
      clinicId = release.clinicId;
      releasePatientId = release.patientId;
    }

    const patient = await prisma.patient.findFirst({
      where: { iinHash: hash, userId: null, ...(clinicId ? { clinicId } : {}) },
      select: { id: true, clinicId: true, phone: true },
    });
    if (!patient) return res.status(404).json({ ok: false, error: 'Не найдена подходящая карточка пациента в этой клинике' });
    if (releasePatientId && patient.id !== releasePatientId) return res.status(403).json({ ok: false, error: 'Данные пациента не совпадают с карточкой плана' });

    const existing = await prisma.patient.findFirst({ where: { userId: req.user!.id }, select: { id: true, clinicId: true } });
    if (existing && existing.id !== patient.id) return res.status(409).json({ ok: false, error: 'Аккаунт уже привязан к другой карточке пациента' });

    const linked = await prisma.patient.updateMany({ where: { id: patient.id, userId: null }, data: { userId: req.user!.id } });
    if (linked.count !== 1) return res.status(409).json({ ok: false, error: 'Карточка уже была привязана. Повторите вход.' });

    return res.json({ ok: true, data: { linked: true, patientId: patient.id, clinicId: patient.clinicId, matchedBy: 'iin' } });
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); }
});

function resolvePatientId(req: AuthRequest): string | null { return (req as any)._patientId || req.user?.id || null; }
async function ensurePatient(req: AuthRequest, res: any, next: any) {
  const match = await resolvePatientForUser(req.user!);
  if (!match) return res.status(403).json({ ok: false, error: 'Patient record not found. Ask your clinic to link your account.' });
  (req as any)._patientId = match.id;
  return next();
}

patientPortalRouter.get('/appointments', ensurePatient, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await portalSvc.getAppointments(resolvePatientId(req)) }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.get('/treatments', ensurePatient, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await portalSvc.getTreatments(resolvePatientId(req)) }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.get('/treatment-plans', ensurePatient, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await portalSvc.getTreatmentPlans(resolvePatientId(req)) }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.get('/visits', ensurePatient, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await portalSvc.getVisits(resolvePatientId(req)) }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.get('/invoices', ensurePatient, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await portalSvc.getInvoices(resolvePatientId(req)) }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.get('/documents', ensurePatient, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await portalSvc.getDocuments(resolvePatientId(req)) }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.get('/documents/:id/content', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req);
    const doc = await (prisma as any).document.findFirst({ where: { id: req.params.id, patientId: pid }, select: { url: true, type: true, name: true } });
    if (!doc) return res.status(404).json({ ok: false, error: 'Документ не найден' });
    const url = String(doc.url || '');
    if (url.startsWith('data:text/plain')) {
      const base64Match = url.match(/;base64,(.+)$/);
      const content = base64Match ? Buffer.from(base64Match[1], 'base64').toString('utf-8') : decodeURIComponent(url.replace(/^data:text\/plain;charset=utf-8,/, ''));
      res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.name || 'document')}.txt"`); return res.send(content);
    }
    if (url.startsWith('http://') || url.startsWith('https://')) return res.redirect(url);
    if (isStorageKey(url)) { if (!storageConfigured()) return res.status(503).json({ ok: false, error: 'Файловое хранилище не настроено' }); return res.redirect(await signedDownloadUrl(keyFromStorageUrl(url))); }
    return res.status(410).json({ ok: false, error: 'Документ недоступен для скачивания' });
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); }
});
patientPortalRouter.get('/diagnostics', ensurePatient, async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await portalSvc.getDiagnostics(resolvePatientId(req)) }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });

patientPortalRouter.put('/me/profile', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const pid = resolvePatientId(req); const body = req.body || {}; const data: Record<string, unknown> = {};
    if (body.phone !== undefined) data.phone = String(body.phone); if (body.email !== undefined) data.email = String(body.email); if (body.address !== undefined) data.address = String(body.address); if (body.medicalHistory !== undefined) data.medicalHistory = encryptField(String(body.medicalHistory));
    if (Object.keys(data).length === 0) return res.status(400).json({ ok: false, error: 'Нет полей для обновления' });
    await (prisma as any).patient.update({ where: { id: pid }, data }); return res.json({ ok: true, data: { updated: Object.keys(data) } });
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); }
});

patientPortalRouter.get('/clinics', async (req: AuthRequest, res) => {
  try { const search = String(req.query.search || '').trim(); if (!search || search.length < 2) return res.json({ ok: true, data: [] }); const clinics = await (prisma as any).clinic.findMany({ where: { name: { contains: search, mode: 'insensitive' } }, select: { id: true, name: true, city: true }, take: 10 }); return res.json({ ok: true, data: clinics }); }
  catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); }
});

patientPortalRouter.post('/link', async (req: AuthRequest, res) => {
  try {
    const body = req.body || {}; const clinicId = body.clinicId as string;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'clinicId обязателен' });
    const clinic = await (prisma as any).clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true } });
    if (!clinic) return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    const phoneHint = typeof body.phone === 'string' ? body.phone : null;
    const match = await resolvePatientForUser(req.user!, { clinicId: clinic.id, phoneHint });
    if (match) return res.json({ ok: true, data: { patientId: match.id, clinicName: clinic.name, alreadyLinked: match.via === 'userId', linkedExisting: match.via !== 'userId', matchedBy: match.via } });
    return res.status(403).json({ ok: false, error: 'Не найдено существующее приглашение или карточка пациента для этой клиники' });
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); }
});

patientPortalRouter.post('/appointments/:id/cancel', ensurePatient, async (req: AuthRequest, res) => { try { const result = await portalSvc.cancelAppointment(resolvePatientId(req), String(req.params.id)); return res.json({ ok: true, data: result }); } catch (e: any) { if (e instanceof portalSvc.PortalActionError) return res.status(e.code === 'NOT_FOUND' ? 404 : 400).json({ ok: false, error: e.message }); return res.status(500).json({ ok: false, error: e.message }); } });

async function resolvePatientClinicId(patientId: string): Promise<string | null> { const patient = await (prisma as any).patient.findUnique({ where: { id: patientId }, select: { clinicId: true } }); return patient?.clinicId ?? null; }
patientPortalRouter.get('/available-slots', ensurePatient, async (req: AuthRequest, res) => {
  try { const clinicId = await resolvePatientClinicId(resolvePatientId(req)!); if (!clinicId) return res.status(404).json({ ok: false, error: 'Клиника не найдена' }); const date = String(req.query.date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ ok: false, error: 'Ожидается дата в формате YYYY-MM-DD' }); const doctorId = req.query.doctorId ? String(req.query.doctorId) : null; return res.json({ ok: true, data: await portalSvc.getAvailableSlots(clinicId, date, doctorId) }); }
  catch (e: any) { if (e instanceof portalSvc.PortalActionError) return res.status(e.code === 'NOT_FOUND' ? 404 : 400).json({ ok: false, error: e.message }); return res.status(500).json({ ok: false, error: e.message }); }
});
patientPortalRouter.post('/appointments/request', ensurePatient, async (req: AuthRequest, res) => {
  try {
    const patientId = resolvePatientId(req)!; const clinicId = await resolvePatientClinicId(patientId); if (!clinicId) return res.status(404).json({ ok: false, error: 'Клиника не найдена' }); const body = (req.body || {}) as Record<string, unknown>; const date = String(body.date || ''); const time = String(body.time || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ ok: false, error: 'Ожидается дата в формате YYYY-MM-DD' }); if (!time) return res.status(400).json({ ok: false, error: 'Не выбрано время' });
    const result = await portalSvc.requestAppointment({ patientId, clinicId, date, time, doctorId: body.doctorId ? String(body.doctorId) : null, serviceName: body.serviceName ? String(body.serviceName).slice(0, 200) : null, notes: body.notes ? String(body.notes).slice(0, 500) : null, releaseId: body.releaseId ? String(body.releaseId) : null });
    return res.json({ ok: true, data: result });
  } catch (e: any) { if (e instanceof portalSvc.PortalActionError) return res.status(e.code === 'NOT_FOUND' ? 404 : 400).json({ ok: false, error: e.message }); return res.status(500).json({ ok: false, error: e.message }); }
});

patientPortalRouter.get('/access-requests', async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await crossClinicSvc.listAccessRequests(req.user!.id) }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.post('/access-requests/:grantId/approve', async (req: AuthRequest, res) => { try { const ok = await crossClinicSvc.approveRequest(String(req.params.grantId), req.user!.id); if (!ok) return res.status(404).json({ ok: false, error: 'Запрос не найден' }); return res.json({ ok: true, data: { approved: true } }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.post('/access-requests/:grantId/decline', async (req: AuthRequest, res) => { try { const ok = await crossClinicSvc.declineRequest(String(req.params.grantId), req.user!.id); if (!ok) return res.status(404).json({ ok: false, error: 'Запрос не найден' }); return res.json({ ok: true, data: { declined: true } }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.get('/access-grants', async (req: AuthRequest, res) => { try { return res.json({ ok: true, data: await crossClinicSvc.listAccessGrants(req.user!.id) }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.post('/access-grants/:grantId/revoke', async (req: AuthRequest, res) => { try { const ok = await crossClinicSvc.revokeGrant(String(req.params.grantId), req.user!.id); if (!ok) return res.status(404).json({ ok: false, error: 'Доступ не найден' }); return res.json({ ok: true, data: { revoked: true } }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
patientPortalRouter.get('/access-log', async (req: AuthRequest, res) => { try { const log = await crossClinicSvc.getAccessLog(req.user!.id); return res.json({ ok: true, data: log }); } catch (e: any) { return res.status(500).json({ ok: false, error: e.message }); } });
