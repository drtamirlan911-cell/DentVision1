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
  if (firstName || lastName) {
    return {
      firstName: stripHtmlTags(firstName || name || 'Пациент') || 'Пациент',
      lastName: stripHtmlTags(lastName || '') || '-',
    };
  }
  const parts = stripHtmlTags(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Пациент', lastName: '-' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function serializePatient(p: {
  id: string;
  clinicId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  birthDate: Date | null;
  gender: string | null;
  address: string | null;
  notes: string | null;
  medicalHistory: unknown;
  createdAt: Date;
  updatedAt: Date;
  teeth?: Array<{ number: number; condition: string | null; diagnosis: string | null; notes: string | null }>;
}) {
  const history = (p.medicalHistory && typeof p.medicalHistory === 'object'
    ? p.medicalHistory
    : {}) as Record<string, unknown>;
  const teethMap: Record<string, unknown> = {};

  // Prefer full odontogram from medicalHistory (includes surfaces).
  if (history.teeth && typeof history.teeth === 'object') {
    Object.assign(teethMap, history.teeth as object);
  }

  if (Array.isArray(p.teeth)) {
    for (const t of p.teeth) {
      const key = String(t.number);
      let surfaces: Record<string, string> | undefined;
      if (t.notes) {
        try {
          const parsed = JSON.parse(t.notes);
          if (parsed && typeof parsed === 'object' && parsed.surfaces) surfaces = parsed.surfaces;
        } catch { /* plain notes */ }
      }
      const existing = teethMap[key];
      if (existing && typeof existing === 'object') {
        const ex = existing as Record<string, unknown>;
        if (!ex.status && t.condition) ex.status = t.condition;
        if (!ex.surfaces && surfaces) ex.surfaces = surfaces;
      } else if (!existing) {
        teethMap[key] = {
          status: t.condition || 'healthy',
          diagnosis: t.diagnosis,
          notes: surfaces ? null : t.notes,
          ...(surfaces ? { surfaces } : {}),
        };
      }
    }
  }

  return {
    id: p.id,
    clinicId: p.clinicId,
    name: `${p.firstName} ${p.lastName}`.trim(),
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone || '',
    email: p.email || '',
    dob: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : '',
    birthDate: p.birthDate,
    gender: p.gender || '',
    address: p.address || '',
    notes: p.notes || '',
    iin: decryptField((p as any).iin ?? null) || '',
    noIinReason: (p as any).noIinReason || '',
    prepaidBalance: Number((p as any).prepaidBalance || 0),
    category: (history.category as string) || 'regular',
    source: (history.source as string) || '',
    allergies: (history.allergies as string) || '',
    tags: Array.isArray(history.tags) ? history.tags : [],
    teeth: teethMap,
    medicalHistory: history,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}


patientsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const search = (req.query.search as string) || '';
    const { skip, take } = paginate(page, limit);

    // A full IIN is looked up through the blind index, never by substring:
    // `iin` is encrypted with a random IV, so `contains` compares a typed
    // number against ciphertext and matches nothing — it looked like a working
    // IIN search and found no one. The trade-off of the hash is that only a
    // complete number resolves; a partial one is not searchable by design.
    const searchIin = normalizeIin(search);
    const iinHash = searchIin.length === 12 ? hmacIin(searchIin) : null;

    const where = {
      clinicId,
      ...(iinHash
        ? { iinHash }
        : search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
    };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take,
        include: { teeth: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patient.count({ where }),
    ]);

    const rows = patients.map(serializePatient);
    return res.json({ ok: true, data: paginatedResponse(rows, total, page, limit) } satisfies ApiResponse);
  } catch (error) {
    console.error('List patients error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении списка пациентов' } satisfies ApiResponse);
  }
});

patientsRouter.post('/', requirePermission('patient.write'), guardPatientCreate, async (req: AuthRequest, res) => {
  let idempotencyKey: string | undefined;
  let idempotencyKeyCompleted = false;
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const body = req.body || {};
    const { firstName, lastName } = splitName(body.name, body.firstName, body.lastName);
    const id = body.id || uid();

    const history: Record<string, unknown> = {
      ...((body.medicalHistory && typeof body.medicalHistory === 'object') ? body.medicalHistory : {}),
    };
    if (body.category) history.category = body.category;
    if (body.source) history.source = body.source;
    if (body.allergies) history.allergies = body.allergies;
    if (body.tags) history.tags = body.tags;
    if (body.teeth) history.teeth = body.teeth;

    // Idempotency guard, create path only: `body.id` already makes an edit
    // idempotent (it upserts by id), but a *new* patient's id is generated
    // server-side, so a double-click or a retried request submitting the same
    // form twice had nothing stopping it from creating two patients with
    // identical data. Same pattern as `payments.routes.ts` — a client-supplied
    // `Idempotency-Key`, or a deterministic hash of the request when none is
    // sent, reserved via the unique index on `IdempotencyRecord.key` before
    // the row is written.
    if (!body.id) {
      idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      if (!idempotencyKey) {
        const hash = createHash('sha256')
          .update(`${req.user!.id}:${clinicId}:${JSON.stringify(body)}`)
          .digest('hex');
        idempotencyKey = `server-${hash.slice(0, 32)}`;
      }
      const reserved = await reserveIdempotencyKey(idempotencyKey);
      if (reserved.status === 'in_flight') {
        return res.status(409).json({ ok: false, error: 'Пациент уже создаётся, повторите позже' } satisfies ApiResponse);
      }
      if (reserved.status === 'exists') {
        const priorPatient = await prisma.patient.findUnique({
          where: { id: reserved.resultId },
          include: { teeth: true },
        });
        if (priorPatient) {
          return res.status(200).json({ ok: true, data: serializePatient(priorPatient) } satisfies ApiResponse);
        }
        // Stale record pointing at a deleted patient — free the key and continue.
        await deleteIdempotencyKey(idempotencyKey);
      }
    }

    const existing = body.id
      ? await prisma.patient.findFirst({ where: { id: body.id, clinicId } })
      : null;

    // A patient does not have to have an IIN on file (minors, foreign
    // patients) — validation only runs when one was actually submitted.
    //
    // Required on create, not on update: a record older than the requirement
    // has neither an IIN nor a reason, and blocking a phone-number edit over
    // that would just keep the record wrong for longer. The patient card flags
    // it instead, so the directory fills in as records are touched.
    //
    // On update, an untouched `iin` keeps the stored value verbatim — it is
    // already ciphertext, and re-encrypting it would double-wrap it.
    const iinTouched = body.iin !== undefined || body.noIinReason !== undefined;
    let iinFields: PatientIinFields | undefined;
    if (!existing || iinTouched) {
      iinFields = await buildPatientIinFields({
        iin: body.iin,
        noIinReason: body.noIinReason,
        clinicId,
        excludePatientId: existing?.id,
        birthDate: (body.dob || body.birthDate) ?? existing?.birthDate ?? null,
        gender: body.gender ?? existing?.gender ?? null,
        required: !existing,
      });
    }

    const patient = existing
      ? await prisma.patient.update({
          where: { id: existing.id },
          data: {
            firstName,
            lastName,
            phone: body.phone ?? existing.phone,
            email: body.email ?? existing.email,
            birthDate: (body.dob || body.birthDate)
              ? new Date(body.dob || body.birthDate)
              : existing.birthDate,
            gender: body.gender ?? existing.gender,
            address: body.address ?? existing.address,
            notes: body.notes ?? existing.notes,
            iin: iinFields ? iinFields.iin : (existing as any).iin,
            iinHash: iinFields ? iinFields.iinHash : undefined,
            noIinReason: iinFields ? iinFields.noIinReason : undefined,
            medicalHistory: history as Prisma.InputJsonValue,
          },
          include: { teeth: true },
        })
      : await prisma.patient.create({
          data: {
            id,
            clinicId,
            firstName,
            lastName,
            phone: body.phone || null,
            email: body.email || null,
            birthDate: (body.dob || body.birthDate) ? new Date(body.dob || body.birthDate) : null,
            gender: body.gender || null,
            address: body.address || null,
            notes: body.notes || null,
            iin: iinFields!.iin,
            iinHash: iinFields!.iinHash,
            noIinReason: iinFields!.noIinReason,
            medicalHistory: history as Prisma.InputJsonValue,
          },
          include: { teeth: true },
        });

    if (body.teeth) await syncTeeth(patient.id, body.teeth);

    const refreshed = await prisma.patient.findUnique({
      where: { id: patient.id },
      include: { teeth: true },
    });

    if (!existing) {
      publish('patient.created', {
        clinicId,
        patientId: patient.id,
        userId: req.user?.id,
        name: `${firstName} ${lastName}`.trim(),
      });
    } else {
      await auditFromReq(req, {
        action: 'patient.updated',
        entity: 'patient',
        entityId: patient.id,
        details: { name: `${firstName} ${lastName}`.trim() },
      });
    }

    if (idempotencyKey) {
      await completeIdempotencyKey(idempotencyKey, patient.id);
      idempotencyKeyCompleted = true;
    }

    return res.status(existing ? 200 : 201).json({
      ok: true,
      data: serializePatient(refreshed!),
    } satisfies ApiResponse);
  } catch (error) {
    // A reserved-but-never-completed key must not outlive the failed request —
    // otherwise a genuine retry after a transient error would be told
    // "already creating" for up to an hour.
    if (idempotencyKey && !idempotencyKeyCompleted) {
      await deleteIdempotencyKey(idempotencyKey);
    }
    if (error instanceof IinValidationError) {
      return res
        .status(error.code === 'DUPLICATE' ? 409 : 400)
        .json({ ok: false, error: error.message } satisfies ApiResponse);
    }
    console.error('Upsert patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при сохранении пациента' } satisfies ApiResponse);
  }
});

/**
 * GET /api/patients/lookup?iin=… — what happens when the desk presses «Проверить».
 *
 * Shaped after how a Kazakhstan government service treats an IIN: it is the
 * entry point, not a form field. You type the number, and the system says what
 * it already knows instead of asking you to type it again.
 *
 * Two answers, and deliberately only two:
 *
 * `derived` — birth date and sex, decoded from the number itself. eGov reads
 * these from ГБД ФЛ; they are encoded in the IIN, so no external service is
 * involved and nothing about this patient is revealed by returning them.
 *
 * `existing` — this clinic's own patient with that IIN, so a duplicate is
 * caught before saving rather than as a 400 afterwards.
 *
 * What this deliberately does NOT answer is whether the IIN is known to any
 * *other* clinic. `cross-clinic.service.ts` states the reason in its header: a
 * free-standing "does this IIN exist elsewhere" check is an enumeration oracle
 * over national IDs — anyone with a list could learn who is a patient
 * somewhere. That module collapses "check" and "request" into one action with
 * a constant response on purpose, and this route must not reopen what it
 * closed. Cross-clinic history stays where it belongs: the patient is created,
 * and their card offers to request it with the patient's consent.
 */
patientsRouter.get('/lookup', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const iin = normalizeIin(req.query.iin);
    if (iin.length !== 12) {
      return res.status(400).json({ ok: false, error: 'ИИН должен состоять из 12 цифр' } satisfies ApiResponse);
    }

    const hash = hmacIin(iin);
    const existing = hash
      ? await prisma.patient.findFirst({
          where: { clinicId, iinHash: hash, deletedAt: null },
          select: { id: true, firstName: true, lastName: true, phone: true },
        })
      : null;

    // Looking someone up by their national ID is access to personal data even
    // when nothing is found — the log is what makes it accountable.
    await auditFromReq(req, {
      action: 'patient.iin_lookup',
      entity: 'patient',
      entityId: existing?.id || null,
      details: { found: Boolean(existing) },
    });

    return res.json({
      ok: true,
      data: {
        derived: { birthDate: iinBirthDate(iin), gender: iinSex(iin) },
        existing: existing
          ? {
              id: existing.id,
              name: `${existing.firstName} ${existing.lastName}`.trim(),
              phone: existing.phone || '',
            }
          : null,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Patient IIN lookup error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось проверить ИИН' } satisfies ApiResponse);
  }
});

patientsRouter.get('/:id/summary', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
      include: { teeth: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const now = new Date();
    const [nextAppt, openPlans, unpaid, paid] = await Promise.all([
      prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          clinicId,
          date: { gte: now },
          status: { notIn: ['cancelled', 'no_show', 'completed'] },
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      }),
      prisma.treatmentPlan.count({
        where: {
          patientId: patient.id,
          status: { in: ['draft', 'proposed', 'accepted', 'in_progress', 'active'] },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          clinicId,
          patientId: patient.id,
          status: { in: ['pending', 'unpaid', 'partial', 'overdue'] },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { clinicId, patientId: patient.id, status: 'paid' },
        _sum: { amount: true },
      }),
    ]);

    return res.json({
      ok: true,
      data: {
        patient: serializePatient(patient),
        balance: unpaid._sum.amount || 0,
        paidTotal: paid._sum.amount || 0,
        openPlans,
        nextVisit: nextAppt
          ? {
              id: nextAppt.id,
              date: nextAppt.date.toISOString().slice(0, 10),
              time: nextAppt.time,
              status: nextAppt.status,
              service: nextAppt.type,
            }
          : null,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Patient summary error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить сводку пациента' } satisfies ApiResponse);
  }
});

patientsRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
      include: {
        visits: { orderBy: { date: 'desc' } },
        appointments: { orderBy: { date: 'desc' } },
        teeth: { orderBy: { number: 'asc' } },
        treatmentPlans: { orderBy: { createdAt: 'desc' } },
        images: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    return res.json({ ok: true, data: serializePatient(patient) } satisfies ApiResponse);
  } catch (error) {
    console.error('Get patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении пациента' } satisfies ApiResponse);
  }
});

patientsRouter.patch('/:id', requirePermission('patient.write'), requireClinicWritable, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const existing = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const body = req.body || {};
    const names = (body.name || body.firstName || body.lastName)
      ? splitName(body.name, body.firstName, body.lastName)
      : { firstName: existing.firstName, lastName: existing.lastName };

    const prevHistory = (existing.medicalHistory && typeof existing.medicalHistory === 'object'
      ? existing.medicalHistory
      : {}) as Record<string, unknown>;
    const history = {
      ...prevHistory,
      ...((body.medicalHistory && typeof body.medicalHistory === 'object') ? body.medicalHistory : {}),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.source !== undefined && { source: body.source }),
      ...(body.allergies !== undefined && { allergies: body.allergies }),
      ...(body.teeth !== undefined && { teeth: body.teeth }),
    };

    const patient = await prisma.patient.update({
      where: { id: existing.id },
      data: {
        firstName: names.firstName,
        lastName: names.lastName,
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...((body.dob || body.birthDate) !== undefined && {
          birthDate: (body.dob || body.birthDate) ? new Date(body.dob || body.birthDate) : null,
        }),
        ...(body.gender !== undefined && { gender: body.gender || null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.address !== undefined && { address: body.address || null }),
        medicalHistory: history as Prisma.InputJsonValue,
      },
      include: { teeth: true },
    });

    if (body.teeth) await syncTeeth(patient.id, body.teeth);

    const refreshed = await prisma.patient.findUnique({
      where: { id: patient.id },
      include: { teeth: true },
    });

    await auditFromReq(req, {
      action: 'patient.updated',
      entity: 'patient',
      entityId: patient.id,
    });

    return res.json({ ok: true, data: serializePatient(refreshed!) } satisfies ApiResponse);
  } catch (error) {
    console.error('Update patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении пациента' } satisfies ApiResponse);
  }
});

patientsRouter.delete('/:id', requirePermission('patient.delete'), requireClinicWritable, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const existing = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }
    await prisma.patient.delete({ where: { id: existing.id } });
    publish('patient.deleted', { clinicId, patientId: existing.id, userId: req.user?.id });
    return res.json({ ok: true, data: { id: existing.id } } satisfies ApiResponse);
  } catch (error) {
    console.error('Delete patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при удалении пациента' } satisfies ApiResponse);
  }
});

patientsRouter.get('/:id/history', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip, take } = paginate(page, limit);
    const where = { patientId: req.params.id as string };

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({ where, skip, take, orderBy: { date: 'desc' } }),
      prisma.visit.count({ where }),
    ]);

    return res.json({ ok: true, data: paginatedResponse(visits, total, page, limit) } satisfies ApiResponse);
  } catch (error) {
    console.error('Get patient history error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении истории визитов' } satisfies ApiResponse);
  }
});

patientsRouter.get('/:id/images', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const images = await prisma.patientImage.findMany({
      where: { patientId: req.params.id as string },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ ok: true, data: images } satisfies ApiResponse);
  } catch (error) {
    console.error('Get patient images error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении изображений пациента' } satisfies ApiResponse);
  }
});

patientsRouter.get('/:id/treatment-plan', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const plans = await prisma.treatmentPlan.findMany({
      where: { patientId: req.params.id as string },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ ok: true, data: plans } satisfies ApiResponse);
  } catch (error) {
    console.error('Get patient treatment plans error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении планов лечения' } satisfies ApiResponse);
  }
});

/** KazDent donor: prepaid deposit / credit balance */
patientsRouter.post('/:id/deposit', requireClinicWritable, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const amount = Number(req.body?.amount || 0);
    if (!amount || Number.isNaN(amount)) {
      return res.status(400).json({ ok: false, error: 'Укажите сумму' } satisfies ApiResponse);
    }
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }
    const next = Math.max(0, Number(patient.prepaidBalance || 0) + amount);
    const updated = await prisma.patient.update({
      where: { id: patient.id },
      data: { prepaidBalance: next },
      include: { teeth: true },
    });
    await auditFromReq(req, {
      action: 'patient.deposit',
      entity: 'patient',
      entityId: patient.id,
      details: { amount, previousBalance: patient.prepaidBalance, newBalance: next },
    });
    return res.json({ ok: true, data: serializePatient(updated) } satisfies ApiResponse);
  } catch (error) {
    console.error('Patient deposit error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось пополнить баланс' } satisfies ApiResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Responsible staff (PatientAssignment)
//
// Read by the AI kernel's patient-scope check when `AI_PATIENT_SCOPE=on`
// (`modules/ai/os/kernel.ts` step 5). Rows accrue automatically as
// appointments are booked (see `lib/patientAssignment.ts`); these routes exist
// so a clinic can also see and correct that list by hand — assign a second
// doctor, add an assistant, or take someone off a patient they no longer treat.
//
// Deliberately does NOT gate human access to the patient: whoever may read the
// card may read who is responsible for it. Only the AI layer treats the list
// as a boundary.
// ─────────────────────────────────────────────────────────────────────────────

async function loadClinicPatient(req: AuthRequest, res: any): Promise<{ clinicId: string; patientId: string } | null> {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    return null;
  }
  const patient = await prisma.patient.findFirst({
    where: { id: req.params.id as string, clinicId },
    select: { id: true },
  });
  if (!patient) {
    res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    return null;
  }
  return { clinicId, patientId: patient.id };
}

/** Resolve staff names in one query — PatientAssignment holds no relation to User. */
async function serializeAssignments(rows: Array<{ id: string; userId: string; role: string; createdAt: Date }>) {
  if (rows.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, firstName: true, lastName: true, role: true, spec: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((row) => {
    const user = byId.get(row.userId);
    return {
      id: row.id,
      userId: row.userId,
      role: row.role,
      createdAt: row.createdAt,
      name: user ? `${user.firstName} ${user.lastName}`.trim() : 'Сотрудник удалён',
      spec: user?.spec || null,
      systemRole: user?.role || null,
    };
  });
}

patientsRouter.get('/:id/assignments', async (req: AuthRequest, res) => {
  try {
    const scope = await loadClinicPatient(req, res);
    if (!scope) return;
    const rows = await prisma.patientAssignment.findMany({
      where: { patientId: scope.patientId, clinicId: scope.clinicId, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, role: true, createdAt: true },
    });
    return res.json({ ok: true, data: await serializeAssignments(rows) } satisfies ApiResponse);
  } catch (error) {
    console.error('List patient assignments error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить ответственных' } satisfies ApiResponse);
  }
});

patientsRouter.post('/:id/assignments', requirePermission('patient.write'), requireClinicWritable, async (req: AuthRequest, res) => {
  try {
    const scope = await loadClinicPatient(req, res);
    if (!scope) return;

    const userId = String(req.body?.userId || '');
    const role = req.body?.role;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'Укажите сотрудника' } satisfies ApiResponse);
    }
    if (role !== undefined && !isAssignmentRole(role)) {
      return res.status(400).json({ ok: false, error: 'Неизвестная роль' } satisfies ApiResponse);
    }
    // Assigning someone from another clinic would hand them a patient they may
    // not read — the same check `createAppointment` makes before booking.
    if (!(await isClinicMember(userId, scope.clinicId))) {
      return res.status(400).json({ ok: false, error: 'Сотрудник не работает в этой клинике' } satisfies ApiResponse);
    }

    const written = await ensurePatientAssignment({
      clinicId: scope.clinicId,
      patientId: scope.patientId,
      userId,
      role,
    });
    if (!written) {
      return res.status(500).json({ ok: false, error: 'Не удалось назначить ответственного' } satisfies ApiResponse);
    }

    await auditFromReq(req, {
      action: 'patient.assignment.added',
      entity: 'patient',
      entityId: scope.patientId,
      details: { userId, role: role || 'treating_doctor' },
    });

    const rows = await prisma.patientAssignment.findMany({
      where: { patientId: scope.patientId, clinicId: scope.clinicId, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, role: true, createdAt: true },
    });
    return res.status(201).json({ ok: true, data: await serializeAssignments(rows) } satisfies ApiResponse);
  } catch (error) {
    console.error('Add patient assignment error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось назначить ответственного' } satisfies ApiResponse);
  }
});

patientsRouter.delete('/:id/assignments/:assignmentId', requirePermission('patient.write'), requireClinicWritable, async (req: AuthRequest, res) => {
  try {
    const scope = await loadClinicPatient(req, res);
    if (!scope) return;

    // `revokePatientAssignment` filters on clinicId itself, so an id from
    // another clinic finds nothing rather than being revoked.
    const revoked = await revokePatientAssignment(scope.clinicId, req.params.assignmentId as string);
    if (!revoked) {
      return res.status(404).json({ ok: false, error: 'Назначение не найдено' } satisfies ApiResponse);
    }

    await auditFromReq(req, {
      action: 'patient.assignment.removed',
      entity: 'patient',
      entityId: scope.patientId,
      details: { assignmentId: req.params.assignmentId },
    });

    return res.json({ ok: true, data: { id: req.params.assignmentId } } satisfies ApiResponse);
  } catch (error) {
    console.error('Revoke patient assignment error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось снять ответственного' } satisfies ApiResponse);
  }
});
