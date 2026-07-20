import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import type { Prisma } from '@prisma/client';

export const patientsRouter = Router();

patientsRouter.use(authenticate);

function splitName(name?: string, firstName?: string, lastName?: string) {
  if (firstName || lastName) {
    return {
      firstName: (firstName || name || 'Пациент').trim() || 'Пациент',
      lastName: (lastName || '').trim() || '-',
    };
  }
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
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
  if (Array.isArray(p.teeth)) {
    for (const t of p.teeth) {
      teethMap[String(t.number)] = {
        status: t.condition || 'healthy',
        diagnosis: t.diagnosis,
        notes: t.notes,
      };
    }
  } else if (history.teeth && typeof history.teeth === 'object') {
    Object.assign(teethMap, history.teeth as object);
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

async function syncTeeth(patientId: string, teeth: Record<string, any> | undefined) {
  if (!teeth || typeof teeth !== 'object') return;
  for (const [num, val] of Object.entries(teeth)) {
    const number = parseInt(num, 10);
    if (!Number.isFinite(number)) continue;
    const condition = typeof val === 'string' ? val : val?.status || val?.condition || 'healthy';
    const diagnosis = typeof val === 'object' ? val?.diagnosis || null : null;
    const notes = typeof val === 'object' ? val?.notes || null : null;
    await prisma.tooth.upsert({
      where: { patientId_number: { patientId, number } },
      create: { id: uid(), patientId, number, condition, diagnosis, notes },
      update: { condition, diagnosis, notes },
    });
  }
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

    const where = {
      clinicId,
      ...(search
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

patientsRouter.post('/', requirePermission('patient.write'), async (req: AuthRequest, res) => {
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

    const existing = body.id
      ? await prisma.patient.findFirst({ where: { id: body.id, clinicId } })
      : null;

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
            medicalHistory: history as Prisma.InputJsonValue,
          },
          include: { teeth: true },
        });

    if (body.teeth) await syncTeeth(patient.id, body.teeth);

    const refreshed = await prisma.patient.findUnique({
      where: { id: patient.id },
      include: { teeth: true },
    });

    return res.status(existing ? 200 : 201).json({
      ok: true,
      data: serializePatient(refreshed!),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Upsert patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при сохранении пациента' } satisfies ApiResponse);
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
          status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
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
          status: { in: ['PENDING', 'UNPAID', 'PARTIAL', 'OVERDUE'] },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: { clinicId, patientId: patient.id, status: 'PAID' },
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

patientsRouter.patch('/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
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

    return res.json({ ok: true, data: serializePatient(refreshed!) } satisfies ApiResponse);
  } catch (error) {
    console.error('Update patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении пациента' } satisfies ApiResponse);
  }
});

patientsRouter.delete('/:id', requirePermission('patient.delete'), async (req: AuthRequest, res) => {
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
