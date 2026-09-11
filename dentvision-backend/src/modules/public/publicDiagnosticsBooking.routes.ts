import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { authenticate } from '../../middleware/auth.js';

type AuthRequest = any;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Слишком много заявок. Подождите минуту.' },
});

const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Слишком много запросов. Подождите минуту.' },
});

export const publicDiagnosticsBookingRouter = Router();

function normalizePhone(phone: unknown): string {
  return String(phone || '').replace(/\D/g, '');
}

function validDate(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasCenterClaim(user: any, centerId: string): boolean {
  return user?.role === 'SUPERADMIN' ||
    (user?.organizationType === 'DIAGNOSTIC_CENTER' && user?.organizationId === centerId);
}

async function canAccessCenter(user: any, centerId: string): Promise<boolean> {
  if (user?.role === 'SUPERADMIN') return true;
  if (hasCenterClaim(user, centerId)) return true;

  const member = await (prisma as any).diagnosticCenterMember.findFirst({
    where: { centerId, userId: user?.id },
    select: { id: true },
  });
  if (member) return true;

  const org = await prisma.organization.findFirst({
    where: { originalType: 'DiagnosticCenter', originalId: centerId },
    select: { id: true },
  });
  if (!org) return false;
  const person = await prisma.person.findFirst({
    where: { userId: user?.id, organizationId: org.id },
    select: { id: true },
  });
  return !!person;
}

/** Public diagnostic order. Creates a real DiagnosticBooking; no medical data is accepted. */
publicDiagnosticsBookingRouter.post('/diagnostics/order', limiter, async (req, res) => {
  try {
    const body = req.body || {};
    const centerId = String(body.centerId || '').trim();
    const studyId = String(body.studyId || '').trim();
    const patientName = String(body.patientName || '').trim();
    const patientPhone = normalizePhone(body.patientPhone || body.phone);
    const date = String(body.date || '').trim();
    const time = String(body.time || '').trim();
    const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null;

    if (!centerId || !studyId || !patientName || !patientPhone || !validDate(date) || !time) {
      return res.status(400).json({ ok: false, error: 'Заполните исследование, ФИО, телефон, дату и время' });
    }
    if (patientName.length < 2 || patientName.length > 120) {
      return res.status(400).json({ ok: false, error: 'Некорректное ФИО' });
    }
    if (patientPhone.length < 10 || patientPhone.length > 15) {
      return res.status(400).json({ ok: false, error: 'Некорректный номер телефона' });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return res.status(400).json({ ok: false, error: 'Некорректное время' });
    }

    const study = await prisma.diagnosticStudy.findFirst({
      where: { id: studyId, centerId, active: true },
      select: { id: true, centerId: true, name: true, price: true, durationMin: true },
    });
    if (!study) return res.status(404).json({ ok: false, error: 'Исследование недоступно в выбранном центре' });

    const center = await prisma.diagnosticCenter.findFirst({
      where: { id: centerId, active: true },
      select: { id: true, name: true },
    });
    if (!center) return res.status(404).json({ ok: false, error: 'Диагностический центр не найден' });

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    if (Number.isNaN(dayStart.getTime())) return res.status(400).json({ ok: false, error: 'Некорректная дата' });
    if (dayStart < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')) {
      return res.status(400).json({ ok: false, error: 'Нельзя выбрать прошедшую дату' });
    }

    const conflict = await prisma.diagnosticBooking.findFirst({
      where: {
        centerId,
        date: { gte: dayStart, lte: dayEnd },
        time,
        status: { in: ['pending', 'confirmed'] },
      },
      select: { id: true },
    });
    if (conflict) return res.status(409).json({ ok: false, error: 'Это время уже занято. Выберите другое.' });

    const row = await prisma.diagnosticBooking.create({
      data: {
        id: uid(),
        centerId,
        studyId,
        patientName,
        patientPhone,
        date: dayStart,
        time,
        durationMin: study.durationMin,
        notes,
        status: 'pending',
      },
    });

    return res.status(201).json({
      ok: true,
      data: {
        id: row.id,
        centerId,
        centerName: center.name,
        studyId,
        studyName: study.name,
        price: study.price,
        patientName: row.patientName,
        patientPhone: row.patientPhone,
        date,
        time,
        status: row.status,
      },
    });
  } catch (error) {
    console.error('[Public] diagnostics order', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать заявку на исследование' });
  }
});

/** Public status lookup requires both booking ID and the phone used for the order. */
publicDiagnosticsBookingRouter.get('/diagnostics/order/:id', trackingLimiter, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const phone = normalizePhone(req.query.phone);
    if (!id || phone.length < 10 || phone.length > 15) {
      return res.status(400).json({ ok: false, error: 'Укажите номер заявки и телефон' });
    }

    const booking = await prisma.diagnosticBooking.findFirst({
      where: { id, patientPhone: phone },
      include: {
        center: { select: { id: true, name: true, city: true, address: true, phone: true } },
        study: { select: { id: true, name: true, category: true, price: true, durationMin: true } },
      },
    });
    if (!booking) return res.status(404).json({ ok: false, error: 'Заявка не найдена' });

    return res.json({
      ok: true,
      data: {
        id: booking.id,
        patientName: booking.patientName,
        patientPhone: booking.patientPhone,
        date: booking.date.toISOString().slice(0, 10),
        time: booking.time,
        status: booking.status,
        notes: booking.notes,
        center: booking.center,
        study: booking.study,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Public] diagnostics order status', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить статус заявки' });
  }
});

/**
 * Authenticated center inbox for online diagnostic bookings.
 * Kept on the already-mounted router, but protected by the normal JWT boundary.
 * No medical data is exposed here; this is a scheduling/order surface.
 */
publicDiagnosticsBookingRouter.get('/diagnostics/center/:centerId/bookings', authenticate, async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.centerId || '').trim();
    if (!centerId) return res.status(400).json({ ok: false, error: 'centerId required' });
    if (!(await canAccessCenter(req.user, centerId))) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к диагностическому центру' });
    }

    const status = String(req.query.status || '').trim();
    const allowedStatuses = new Set(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'declined']);
    if (status && !allowedStatuses.has(status)) {
      return res.status(400).json({ ok: false, error: 'Некорректный статус' });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    const bookings = await (prisma as any).diagnosticBooking.findMany({
      where: { centerId, ...(status ? { status } : {}) },
      select: {
        id: true,
        studyId: true,
        patientName: true,
        patientPhone: true,
        date: true,
        time: true,
        durationMin: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        study: { select: { id: true, name: true, category: true, price: true, durationMin: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });

    const counts = await Promise.all(
      [...allowedStatuses].map(async (value) => [value, await (prisma as any).diagnosticBooking.count({ where: { centerId, status: value } })] as const),
    );

    return res.json({ ok: true, data: { bookings, counts: Object.fromEntries(counts) } });
  } catch (error) {
    console.error('[Diagnostics] center booking inbox', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить заявки' });
  }
});

publicDiagnosticsBookingRouter.patch('/diagnostics/center/:centerId/bookings/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const centerId = String(req.params.centerId || '').trim();
    const id = String(req.params.id || '').trim();
    if (!centerId || !id) return res.status(400).json({ ok: false, error: 'centerId и booking id обязательны' });
    if (!(await canAccessCenter(req.user, centerId))) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к диагностическому центру' });
    }

    const requestedStatus = String(req.body?.status || '').trim();
    const allowedTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'declined', 'cancelled'],
      confirmed: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
      declined: [],
    };

    const current = await (prisma as any).diagnosticBooking.findFirst({
      where: { id, centerId },
      select: { id: true, centerId: true, status: true, patientName: true, studyId: true, date: true, time: true },
    });
    if (!current) return res.status(404).json({ ok: false, error: 'Заявка не найдена' });
    if (!requestedStatus || !Object.prototype.hasOwnProperty.call(allowedTransitions, current.status) || !allowedTransitions[current.status].includes(requestedStatus)) {
      return res.status(409).json({ ok: false, error: `Переход ${current.status} → ${requestedStatus} недоступен` });
    }

    const updated = await (prisma as any).diagnosticBooking.update({
      where: { id },
      data: { status: requestedStatus },
      select: { id: true, centerId: true, studyId: true, patientName: true, patientPhone: true, date: true, time: true, durationMin: true, notes: true, status: true, createdAt: true, updatedAt: true },
    });

    // Keep the existing in-app notification source of truth. Staff are alerted
    // on a new public order; status changes are visible in the live inbox.
    if (requestedStatus === 'confirmed' || requestedStatus === 'declined') {
      const members = await (prisma as any).diagnosticCenterMember.findMany({ where: { centerId }, select: { userId: true } });
      await Promise.all(members.map((member: any) => prisma.notification.create({
        data: {
          id: uid(),
          userId: member.userId,
          type: 'system',
          title: requestedStatus === 'confirmed' ? 'Заявка на диагностику подтверждена' : 'Заявка на диагностику отклонена',
          message: `${updated.patientName} · ${updated.date.toISOString().slice(0, 10)} ${updated.time}`,
          link: '/diagnostics',
        },
      }).catch(() => null)));
    }

    return res.json({ ok: true, data: updated });
  } catch (error) {
    console.error('[Diagnostics] center booking update', error);
    return res.status(500).json({ ok: false, error: 'Не удалось изменить заявку' });
  }
});
