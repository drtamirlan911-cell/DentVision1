import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import {
  buildMeta,
  parseMeta,
  serializeAppointment,
  timesOverlap,
  toDbStatus,
} from '../crm/appointmentMeta.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);

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

    const { doctorId, date, time, duration, excludeId, patientId } = req.query as Record<string, string>;
    if (!doctorId || !date || !time) {
      return res.status(400).json({ ok: false, error: 'doctorId, date и time обязательны' } satisfies ApiResponse);
    }

    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const dur = parseInt(duration || '30', 10) || 30;

    const candidates = await prisma.appointment.findMany({
      where: {
        clinicId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { doctorId },
          ...(patientId ? [{ patientId }] : []),
        ],
      },
      include: { patient: { select: patientSelect } },
    });

    const conflicts = candidates.filter((c) =>
      timesOverlap(time, dur, c.time || '09:00', c.duration || 30) &&
      (c.doctorId === doctorId || (patientId && c.patientId === patientId)),
    );

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

appointmentsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const body = req.body || {};
    const {
      id,
      patientId,
      doctorId,
      date,
      time,
      duration,
      type,
      notes,
      status,
      force,
    } = body;

    if (!patientId || !doctorId || !date) {
      return res.status(400).json({ ok: false, error: 'Пациент, врач и дата обязательны' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId },
      select: { id: true },
    });
    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const apptTime = time || '09:00';
    const apptDuration = duration || 30;
    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    if (!force) {
      const candidates = await prisma.appointment.findMany({
        where: {
          clinicId,
          date: { gte: dayStart, lte: dayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          ...(id ? { id: { not: id } } : {}),
          OR: [{ doctorId }, { patientId }],
        },
      });
      const conflicts = candidates.filter((c) =>
        timesOverlap(apptTime, apptDuration, c.time || '09:00', c.duration || 30) &&
        (c.doctorId === doctorId || c.patientId === patientId),
      );
      if (conflicts.length > 0) {
        return res.status(409).json({
          ok: false,
          error: 'Конфликт записи: врач или пациент уже заняты в это время',
          data: { conflicts: conflicts.map(serializeAppointment) },
        });
      }
    }

    const existing = id
      ? await prisma.appointment.findFirst({ where: { id, clinicId } })
      : null;

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

    return res.status(existing ? 200 : 201).json({
      ok: true,
      data: serializeAppointment(appointment),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Upsert appointment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при сохранении записи' } satisfies ApiResponse);
  }
});

appointmentsRouter.patch('/:id/status', async (req: AuthRequest, res) => {
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
      data: { status: toDbStatus(req.body?.status) },
      include: { patient: { select: patientSelect } },
    });

    return res.json({ ok: true, data: serializeAppointment(appointment) } satisfies ApiResponse);
  } catch (error) {
    console.error('Update appointment status error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении статуса записи' } satisfies ApiResponse);
  }
});

appointmentsRouter.delete('/:id', async (req: AuthRequest, res) => {
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
      data: { status: 'CANCELLED' },
      include: { patient: { select: patientSelect } },
    });

    return res.json({ ok: true, data: serializeAppointment(appointment) } satisfies ApiResponse);
  } catch (error) {
    console.error('Cancel appointment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при отмене записи' } satisfies ApiResponse);
  }
});
