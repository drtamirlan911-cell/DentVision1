import { Router } from 'express';
import { createHash } from 'node:crypto';
import prisma from '../../lib/prisma.js';
import { syncTeeth } from './teethStore.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { publish } from '../../lib/events.js';
import { auditFromReq } from '../compliance/audit.service.js';
import { uid, paginate, paginatedResponse, stripHtmlTags } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import type { Prisma } from '@prisma/client';
import { loadClinicAccess, requireClinicWritable, guardPatientCreate } from '../../middleware/planGate.js';
import { buildPatientIinFields, IinValidationError, type PatientIinFields } from '../../lib/patientIin.js';
import { decryptField, hmacIin } from '../../lib/phi.js';
import { normalizeIin, iinBirthDate, iinSex } from '../../lib/iin.js';
import { ensurePatientAssignment, revokePatientAssignment, isAssignmentRole } from '../../lib/patientAssignment.js';
import { isClinicMember } from '../../lib/orgContext.js';
import { reserveIdempotencyKey, completeIdempotencyKey, deleteIdempotencyKey } from '../../lib/idempotency.js';

export const patientsRouter = Router();
patientsRouter.use(authenticate);
patientsRouter.use(loadClinicAccess);

function splitName(name?: string, firstName?: string, lastName?: string) {
  if (firstName || lastName) return { firstName: stripHtmlTags(firstName || name || 'Пациент') || 'Пациент', lastName: stripHtmlTags(lastName || '') || '-' };
  const parts = stripHtmlTags(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Пациент', lastName: '-' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function serializePatient(p: any) {
  const history = (p.medicalHistory && typeof p.medicalHistory === 'object' ? p.medicalHistory : {}) as Record<string, unknown>;
  const teethMap: Record<string, unknown> = {};
  if (history.teeth && typeof history.teeth === 'object') Object.assign(teethMap, history.teeth as object);
  if (Array.isArray(p.teeth)) for (const t of p.teeth) {
    let surfaces: Record<string, string> | undefined;
    if (t.notes) { try { const parsed = JSON.parse(t.notes); if (parsed && typeof parsed === 'object' && parsed.surfaces) surfaces = parsed.surfaces; } catch {} }
    const key = String(t.number); const existing = teethMap[key];
    if (existing && typeof existing === 'object') { const ex = existing as Record<string, unknown>; if (!ex.status && t.condition) ex.status = t.condition; if (!ex.surfaces && surfaces) ex.surfaces = surfaces; }
    else if (!existing) teethMap[key] = { status: t.condition || 'healthy', diagnosis: t.diagnosis, notes: surfaces ? null : t.notes, ...(surfaces ? { surfaces } : {}) };
  }
  return {
    id: p.id, clinicId: p.clinicId, name: `${p.firstName} ${p.lastName}`.trim(), firstName: p.firstName, lastName: p.lastName,
    phone: p.phone || '', email: p.email || '', dob: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : '', birthDate: p.birthDate,
    gender: p.gender || '', address: p.address || '', notes: p.notes || '', iin: decryptField((p as any).iin ?? null) || '', noIinReason: (p as any).noIinReason || '',
    prepaidBalance: Number((p as any).prepaidBalance || 0), category: (history.category as string) || 'regular', source: (history.source as string) || '',
    allergies: (history.allergies as string) || '', tags: Array.isArray(history.tags) ? history.tags : [], teeth: teethMap, medicalHistory: history, createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

patientsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const search = (req.query.search as string) || '';
    const { skip, take } = paginate(page, limit);
    const searchIin = normalizeIin(search);
    const iinHash = searchIin.length === 12 ? hmacIin(searchIin) : null;
    const where = { clinicId, ...(iinHash ? { iinHash } : search ? { OR: [
      { firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } },
      { phone: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } },
    ] } : {}) };
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({ where, skip, take, include: { teeth: true }, orderBy: { createdAt: 'desc' } }),
      prisma.patient.count({ where }),
    ]);
    return res.json({ ok: true, data: paginatedResponse(patients.map(serializePatient), total, page, limit) } satisfies ApiResponse);
  } catch (error) {
    console.error('List patients error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении списка пациентов' } satisfies ApiResponse);
  }
});

patientsRouter.post('/', requirePermission('patient.write'), guardPatientCreate, async (req: AuthRequest, res) => {
  let idempotencyKey: string | undefined; let idempotencyKeyCompleted = false;
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const body = req.body || {};
    const { firstName, lastName } = splitName(body.name, body.firstName, body.lastName);
    const id = body.id || uid();
    const history: Record<string, unknown> = { ...((body.medicalHistory && typeof body.medicalHistory === 'object') ? body.medicalHistory : {}) };
    if (body.category) history.category = body.category; if (body.source) history.source = body.source; if (body.allergies) history.allergies = body.allergies; if (body.tags) history.tags = body.tags; if (body.teeth) history.teeth = body.teeth;
    if (!body.id) {
      idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      if (!idempotencyKey) idempotencyKey = `server-${createHash('sha256').update(`${req.user!.id}:${clinicId}:${JSON.stringify(body)}`).digest('hex').slice(0, 32)}`;
      const reserved = await reserveIdempotencyKey(idempotencyKey);
      if (reserved.status === 'in_flight') return res.status(409).json({ ok: false, error: 'Пациент уже создаётся, повторите позже' } satisfies ApiResponse);
      if (reserved.status === 'exists') {
        const priorPatient = await prisma.patient.findUnique({ where: { id: reserved.resultId }, include: { teeth: true } });
        if (priorPatient) return res.status(200).json({ ok: true, data: serializePatient(priorPatient) } satisfies ApiResponse);
        await deleteIdempotencyKey(idempotencyKey);
      }
    }
    const existing = body.id ? await prisma.patient.findFirst({ where: { id: body.id, clinicId } }) : null;
    const iinTouched = body.iin !== undefined || body.noIinReason !== undefined;
    let iinFields: PatientIinFields | undefined;
    if (!existing || iinTouched) iinFields = await buildPatientIinFields({ iin: body.iin, noIinReason: body.noIinReason, clinicId, excludePatientId: existing?.id, birthDate: (body.dob || body.birthDate) ?? existing?.birthDate ?? null, gender: body.gender ?? existing?.gender ?? null, required: !existing });
    const patient = existing ? await prisma.patient.update({ where: { id: existing.id }, data: {
      firstName, lastName, phone: body.phone ?? existing.phone, email: body.email ?? existing.email, birthDate: (body.dob || body.birthDate) ? new Date(body.dob || body.birthDate) : existing.birthDate,
      gender: body.gender ?? existing.gender, address: body.address ?? existing.address, notes: body.notes ?? existing.notes, iin: iinFields ? iinFields.iin : (existing as any).iin,
      iinHash: iinFields ? iinFields.iinHash : undefined, noIinReason: iinFields ? iinFields.noIinReason : undefined, medicalHistory: history as Prisma.InputJsonValue,
    }, include: { teeth: true } }) : await prisma.patient.create({ data: {
      id, clinicId, firstName, lastName, phone: body.phone || null, email: body.email || null, birthDate: (body.dob || body.birthDate) ? new Date(body.dob || body.birthDate) : null,
      gender: body.gender || null, address: body.address || null, notes: body.notes || null, iin: iinFields!.iin, iinHash: iinFields!.iinHash, noIinReason: iinFields!.noIinReason, medicalHistory: history as Prisma.InputJsonValue,
    }, include: { teeth: true } });
    if (body.teeth) await syncTeeth(patient.id, body.teeth);
    const refreshed = await prisma.patient.findUnique({ where: { id: patient.id }, include: { teeth: true } });
    if (!existing) {
      const complaints = history.complaints ?? history.chiefComplaint ?? body.complaints ?? body.chiefComplaint;
      publish('patient.created', { clinicId, patientId: patient.id, userId: req.user?.id, name: `${firstName} ${lastName}`.trim(), ...(complaints ? { complaints: Array.isArray(complaints) ? complaints.map(String).slice(0, 12) : [String(complaints).slice(0, 500)] } : {}) });
    } else {
      await auditFromReq(req, { action: 'patient.updated', entity: 'patient', entityId: patient.id, details: { name: `${firstName} ${lastName}`.trim() } });
    }
    if (idempotencyKey) { await completeIdempotencyKey(idempotencyKey, patient.id); idempotencyKeyCompleted = true; }
    return res.status(existing ? 200 : 201).json({ ok: true, data: serializePatient(refreshed!) } satisfies ApiResponse);
  } catch (error) {
    if (idempotencyKey && !idempotencyKeyCompleted) await deleteIdempotencyKey(idempotencyKey).catch(() => undefined);
    if (error instanceof IinValidationError) return res.status(400).json({ ok: false, error: error.message } satisfies ApiResponse);
    console.error('Create/update patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при сохранении пациента' } satisfies ApiResponse);
  }
});
