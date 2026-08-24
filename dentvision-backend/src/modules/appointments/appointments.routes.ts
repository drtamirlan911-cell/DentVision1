import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { publish } from '../../lib/events.js';
import { auditFromReq } from '../compliance/audit.service.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import {
  buildMeta,
  findScheduleConflicts,
  parseMeta,
  serializeAppointment,
  toDbStatus,
} from '../crm/appointmentMeta.js';
import { metaFromClosedVisit } from '../crm/payroll.js';
import { loadClinicAccess, requireClinicWritable } from '../../middleware/planGate.js';
import { isClinicMember } from '../../lib/orgContext.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);
appointmentsRouter.use(loadClinicAccess);

const patientSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
} as const;

appointmentsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const { skip, take } = paginate(page, limit);
    const { from, to, doctorId, status } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = { clinicId };

    if (from || to) {
      where.date = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = toDbStatus(status);

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take,
        include: { patient: { select: patientSelect } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      }),
      prisma.appointment.count({ where }),
    ]);

    const rows = appointments.map(serializeAppointment);
    return res.json({ ok: true, data: paginatedResponse(rows, total, page, limit) } satisfies ApiResponse);
  } catch (error) {
    console.error('List appointments error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении списка записей' } satisfies ApiResponse);
  }
});

appointmentsRouter.get('/conflicts', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const { doctorId, date, time, duration, excludeId, patientId, chairId } = req.query as Record<string, string>;
    if (!date || !time) {
      return res.status(400).json({ ok: false, error: 'date и time обязательны' } satisfies ApiResponse);
    }

    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const dur = parseInt(duration || '30', 10) || 30;

    const candidates = await prisma.appointment.findMany({
      where: {
        clinicId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['cancelled', 'no_show'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: { patient: { select: patientSelect } },
    });

    const conflicts = findScheduleConflicts({
      candidates,
      doctorId,
      patientId,
      chairId,
      time,
      duration: dur,
      excludeId,
    });

    return res.json({
      ok: true,
      data: {
        hasConflict: conflicts.length > 0,
        conflicts: conflicts.map(serializeAppointment),
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Appointment conflicts error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось проверить конфликты' } satisfies ApiResponse);
  }
});

appointmentsRouter.post('/', requirePermission('appointment.write'), requireClinicWritable, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const body = req.body || {};
    const {
      id,
      patientId: bodyPatientId,
      doctorId: bodyDoctorId,
      date: bodyDate,
      time,
      duration,
      type,
      notes,
      status,
      force,
      chairId,
    } = body;

    const existing = id
      ? await prisma.appointment.findFirst({ where: { id, clinicId } })
      : null;

    // Partial updates (e.g. paymentStatus only) must reuse existing core fields.
    const patientId = bodyPatientId || existing?.patientId;
    const doctorId = bodyDoctorId || existing?.doctorId;
    const date = bodyDate || (existing?.date ? existing.date.toISOString().slice(0, 10) : undefined);

    if (!patientId || !doctorId || !date) {
      return res.status(400).json({ ok: false, error: 'Пациент, врач и дата обязательны' } satisfies ApiResponse);
    }
    // bodyDoctorId is caller-supplied and was previously written straight into
    // the appointment with no check that it belongs to this clinic — a valid
    // user id from anywhere in the system would silently attach the
    // appointment to a doctor with no relationship to this tenant.
    if (bodyDoctorId && bodyDoctorId !== existing?.doctorId && !(await isClinicMember(doctorId, clinicId))) {
      return res.status(400).json({ ok: false, error: 'Указанный врач не найден в этой клинике' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const apptTime = time || existing?.time || '09:00';
    const apptDuration = duration || existing?.duration || 30;
    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Skip conflict scan for meta-only patches (paymentStatus etc.) that keep slot fields.
    const slotChanged = Boolean(
      bodyPatientId || bodyDoctorId || bodyDate || time !== undefined || duration !== undefined || chairId !== undefined,
    );

    let scheduleWarnings: ReturnType<typeof serializeAppointment>[] = [];
    if (!force && slotChanged) {
      const candidates = await prisma.appointment.findMany({
        where: {
          clinicId,
          date: { gte: dayStart, lte: dayEnd },
          status: { notIn: ['cancelled', 'no_show'] },
          ...(id ? { id: { not: id } } : {}),
        },
      });
      const conflicts = findScheduleConflicts({
        candidates,
        doctorId,
        patientId,
        chairId: chairId || body.chairId,
        time: apptTime,
        duration: apptDuration,
        excludeId: id,
      });
      if (conflicts.length > 0) {
        // Default is a soft warning ("предупреждать, но пускать"); a clinic can opt into
        // a hard block via settings.scheduleConflictMode = 'block'.
        const clinicSettings = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { settings: true } });
        const mode = String(
          ((clinicSettings?.settings && typeof clinicSettings.settings === 'object'
            ? (clinicSettings.settings as Record<string, unknown>).scheduleConflictMode
            : '') || 'warn'),
        );
        if (mode === 'block') {
          return res.status(409).json({
            ok: false,
            error: 'Конфликт записи: врач, пациент или кресло уже заняты в это время',
            data: { conflicts: conflicts.map(serializeAppointment) },
          });
        }
        scheduleWarnings = conflicts.map(serializeAppointment);
      }
    }

    const meta = buildMeta(body, parseMeta(existing?.meta));
    const serviceLabel = meta.serviceName || type || existing?.type || null;

    const appointment = existing
      ? await prisma.appointment.update({
          where: { id: existing.id },
          data: {
            patientId,
            doctorId,
            date: new Date(date),
            time: apptTime,
            duration: apptDuration,
            type: serviceLabel,
            notes: notes ?? existing.notes,
            status: status ? toDbStatus(status) : existing.status,
            meta: meta as any,
          },
          include: { patient: { select: patientSelect } },
        })
      : await prisma.appointment.create({
          data: {
            id: id || uid(),
            clinicId,
            patientId,
            doctorId,
            date: new Date(date),
            time: apptTime,
            duration: apptDuration,
            type: serviceLabel,
            notes: notes || null,
            status: toDbStatus(status),
            meta: meta as any,
          },
          include: { patient: { select: patientSelect } },
        });

    if (!existing) {
      publish('appointment.created', {
        clinicId,
        appointmentId: appointment.id,
        userId: req.user?.id,
      });
    } else {
      await auditFromReq(req, {
        action: 'appointment.updated',
        entity: 'appointment',
        entityId: appointment.id,
      });
    }

    return res.status(existing ? 200 : 201).json({
      ok: true,
      data: serializeAppointment(appointment),
      ...(scheduleWarnings.length > 0 ? { warnings: { conflicts: scheduleWarnings } } : {}),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Upsert appointment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при сохранении записи' } satisfies ApiResponse);
  }
});

appointmentsRouter.patch('/:id/status', requirePermission('appointment.write'), requireClinicWritable, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id as string, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Запись не найдена' } satisfies ApiResponse);
    }

    const status = req.body?.status;
    const meta = buildMeta({ status }, parseMeta(existing.meta));

    const appointment = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        status: toDbStatus(status),
        meta: meta as any,
      },
      include: { patient: { select: patientSelect } },
    });

    await auditFromReq(req, {
      action: 'appointment.status_changed',
      entity: 'appointment',
      entityId: appointment.id,
      details: { from: existing.status, to: appointment.status },
    });

    return res.json({ ok: true, data: serializeAppointment(appointment) } satisfies ApiResponse);
  } catch (error) {
    console.error('Update appointment status error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении статуса записи' } satisfies ApiResponse);
  }
});

appointmentsRouter.post('/:id/close', requireClinicWritable, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    const userId = req.user?.id;
    if (!clinicId || !userId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id as string, clinicId },
      include: { patient: { select: patientSelect } },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Запись не найдена' } satisfies ApiResponse);
    }

    const role = String(req.user?.role || '').toUpperCase();
    const isPrivileged = ['OWNER', 'ADMIN', 'MANAGER', 'SUPERADMIN'].includes(role);
    if (!isPrivileged && existing.doctorId !== userId) {
      return res.status(403).json({ ok: false, error: 'Можно закрыть только свои приёмы' } satisfies ApiResponse);
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const prevMeta = parseMeta(existing.meta);
    const meta = metaFromClosedVisit(prevMeta, body);
    const deducted: string[] = [];

    // Atomically transition to completed; only the FIRST close deducts inventory,
    // so concurrent /close calls can't double-deduct.
    const firstClose = await prisma.appointment.updateMany({
      where: { id: existing.id, clinicId, status: { not: 'completed' } },
      data: { status: 'completed' },
    });
    if (firstClose.count === 1 && !prevMeta.inventoryDeducted) {
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { settings: true },
      });
      const settings = (clinic?.settings && typeof clinic.settings === 'object'
        ? clinic.settings
        : {}) as Record<string, unknown>;
      const autoItems = String(settings.autoDeductItems || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const itemName of autoItems) {
        const item = await prisma.inventoryItem.findFirst({
          where: { clinicId, name: { equals: itemName, mode: 'insensitive' } },
          select: { id: true, name: true },
        });
        if (!item) continue;
        // Atomic guarded decrement — never drives quantity below zero.
        const dec = await prisma.inventoryItem.updateMany({
          where: { id: item.id, quantity: { gte: 1 } },
          data: { quantity: { decrement: 1 } },
        });
        if (dec.count === 1) deducted.push(item.name);
      }
      if (deducted.length > 0) meta.inventoryDeducted = true;
    }

    const appointment = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        status: 'completed',
        notes: body.notes !== undefined ? String(body.notes) : existing.notes,
        type: meta.serviceName || existing.type,
        meta: meta as any,
      },
      include: { patient: { select: patientSelect } },
    });

    await auditFromReq(req, {
      action: 'appointment.closed',
      entity: 'appointment',
      entityId: appointment.id,
      details: { deducted },
    });

    return res.json({
      ok: true,
      data: {
        appointment: serializeAppointment(appointment),
        deducted,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Close appointment error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось закрыть приём' } satisfies ApiResponse);
  }
});

appointmentsRouter.delete('/:id', requirePermission('appointment.write'), requireClinicWritable, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id as string, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Запись не найдена' } satisfies ApiResponse);
    }

    const appointment = await prisma.appointment.update({
      where: { id: existing.id },
      data: { status: 'cancelled' },
      include: { patient: { select: patientSelect } },
    });

    await auditFromReq(req, {
      action: 'appointment.cancelled',
      entity: 'appointment',
      entityId: appointment.id,
    });

    return res.json({ ok: true, data: serializeAppointment(appointment) } satisfies ApiResponse);
  } catch (error) {
    console.error('Cancel appointment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при отмене записи' } satisfies ApiResponse);
  }
});
