import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';

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
