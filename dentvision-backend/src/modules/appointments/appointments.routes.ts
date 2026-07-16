import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import type { AppointmentStatus } from '@prisma/client';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);

appointmentsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip, take } = paginate(page, limit);

    const { from, to, doctorId, status } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = { clinicId };

    if (from || to) {
      where.date = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }

    if (doctorId) {
      where.doctorId = doctorId;
    }

    if (status) {
      where.status = status as AppointmentStatus;
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take,
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.appointment.count({ where }),
    ]);

    const result = paginatedResponse(appointments, total, page, limit);

    return res.json({ ok: true, data: result } satisfies ApiResponse);
  } catch (error) {
    console.error('List appointments error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении списка записей' } satisfies ApiResponse);
  }
});

appointmentsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const { patientId, doctorId, date, time, duration, type, notes } = req.body;

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

    const appointment = await prisma.appointment.create({
      data: {
        id: uid(),
        clinicId,
        patientId,
        doctorId,
        date: new Date(date),
        time: time || null,
        duration: duration || 30,
        type: type || null,
        notes: notes || null,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    return res.status(201).json({ ok: true, data: appointment } satisfies ApiResponse);
  } catch (error) {
    console.error('Create appointment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании записи' } satisfies ApiResponse);
  }
});

appointmentsRouter.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const { status } = req.body;
    const validStatuses: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: `Статус обязателен. Допустимые: ${validStatuses.join(', ')}`,
      } satisfies ApiResponse);
    }

    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id as string, clinicId },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Запись не найдена' } satisfies ApiResponse);
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id as string },
      data: { status },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    return res.json({ ok: true, data: appointment } satisfies ApiResponse);
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
      where: { id: req.params.id as string },
      data: { status: 'CANCELLED' },
    });

    return res.json({ ok: true, data: appointment } satisfies ApiResponse);
  } catch (error) {
    console.error('Cancel appointment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при отмене записи' } satisfies ApiResponse);
  }
});
