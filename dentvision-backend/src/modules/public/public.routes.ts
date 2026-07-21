/**
 * Public routes — online patient booking (no auth).
 * KazDent donor: /book/:clinicId patient flow.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { mergeClinicSettings } from '../clinics/clinicSettings.js';
import {
  buildTimeSlots,
  filterAvailableSlots,
  isWorkingDay,
  splitPatientName,
} from './bookingSlots.js';

const publicBookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Слишком много заявок. Подождите минуту.' },
});

export const publicRouter = Router();

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

publicRouter.get('/clinic/:clinicId', async (req, res) => {
  try {
    const clinicId = req.params.clinicId as string;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        phone: true,
        logo: true,
        settings: true,
      },
    });
    if (!clinic) {
      return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    }

    const settings = mergeClinicSettings(clinic.settings);
    if (settings.onlineBookingEnabled === false) {
      return res.status(403).json({ ok: false, error: 'Онлайн-запись временно недоступна' });
    }

    const members = await prisma.clinicMember.findMany({
      where: {
        clinicId,
        role: { in: ['DOCTOR', 'OWNER'] },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, spec: true, avatar: true, phone: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const doctors = members.map((m) => ({
      id: m.user.id,
      name: [m.user.firstName, m.user.lastName].filter(Boolean).join(' ').trim(),
      spec: m.user.spec || undefined,
      avatar: m.user.avatar || undefined,
      phone: m.user.phone || undefined,
    }));

    const priceRows = await prisma.priceListItem.findMany({
      where: { clinicId, active: true },
      orderBy: { name: 'asc' },
      take: 200,
    });

    const services = priceRows.map((p) => {
      const name = p.name || 'Услуга';
      return {
        id: p.serviceCode,
        name,
        price: p.price,
        category: name.includes('·') ? name.split('·')[0].trim() : 'Услуги',
      };
    });

    return res.json({
      ok: true,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        city: clinic.city,
        address: clinic.address,
        phone: clinic.phone,
        logo: clinic.logo,
      },
      doctors,
      services,
      settings: {
        workStart: settings.workStart,
        workEnd: settings.workEnd,
        workDays: settings.workDays,
        lunchStart: settings.lunchStart,
        lunchEnd: settings.lunchEnd,
        bookingSlotMinutes: settings.bookingSlotMinutes,
        defaultAppointmentDuration: settings.defaultAppointmentDuration,
        currency: settings.currency,
      },
    });
  } catch (error) {
    console.error('[Public] clinic', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить клинику' });
  }
});

/** GET /api/public/clinic/:clinicId/slots?date=YYYY-MM-DD&doctorId= */
publicRouter.get('/clinic/:clinicId/slots', async (req, res) => {
  try {
    const clinicId = req.params.clinicId as string;
    const dateStr = String(req.query.date || '');
    const doctorId = (req.query.doctorId as string) || null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ ok: false, error: 'Укажите дату YYYY-MM-DD' });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { settings: true },
    });
    if (!clinic) {
      return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    }

    const settings = mergeClinicSettings(clinic.settings);
    const doctorCount = doctorId
      ? 1
      : await prisma.clinicMember.count({
          where: { clinicId, role: { in: ['DOCTOR', 'OWNER'] } },
        }) || 1;
    const day = new Date(`${dateStr}T12:00:00.000Z`);
    if (!isWorkingDay(day, settings)) {
      return res.json({ ok: true, data: { date: dateStr, slots: [], workingDay: false } });
    }

    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const [appointments, bookings] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          clinicId,
          date: { gte: dayStart, lte: dayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          ...(doctorId ? { doctorId } : {}),
        },
        select: { time: true, doctorId: true },
      }),
      prisma.booking.findMany({
        where: {
          clinicId,
          date: dayStart,
          status: { in: ['pending', 'confirmed'] },
          ...(doctorId ? { doctorId } : {}),
        },
        select: { time: true, doctorId: true },
      }),
    ]);

    const occupied = [
      ...appointments.filter((a) => a.time).map((a) => ({ time: a.time!, doctorId: a.doctorId })),
      ...bookings.map((b) => ({ time: b.time, doctorId: b.doctorId })),
    ];

    const allSlots = buildTimeSlots(settings);
    const slots = filterAvailableSlots(allSlots, occupied, doctorId, doctorCount);

    return res.json({
      ok: true,
      data: {
        date: dateStr,
        slots,
        workingDay: true,
        slotMinutes: settings.bookingSlotMinutes || 30,
      },
    });
  } catch (error) {
    console.error('[Public] slots', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить слоты' });
  }
});

/** POST /api/public/booking */
publicRouter.post('/booking', publicBookingLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const clinicId = b.clinic_id || b.clinicId;
    const patientName = String(b.patient_name || b.patientName || '').trim();
    const phone = normalizePhone(b.phone || '');
    const email = b.email ? String(b.email).trim() : null;
    const doctorId = b.doctor_id || b.doctorId || null;
    const serviceName = b.service_name || b.serviceName || null;
    const dateStr = b.date;
    const time = String(b.time || '').trim();
    const notes = b.notes ? String(b.notes).trim() : null;

    if (!clinicId || !patientName || !phone || !dateStr || !time) {
      return res.status(400).json({ ok: false, error: 'Заполните обязательные поля' });
    }
    if (phone.length < 10 || phone.length > 15) {
      return res.status(400).json({ ok: false, error: 'Некорректный номер телефона' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ ok: false, error: 'Некорректная дата' });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, settings: true },
    });
    if (!clinic) {
      return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    }

    const settings = mergeClinicSettings(clinic.settings);
    if (settings.onlineBookingEnabled === false) {
      return res.status(403).json({ ok: false, error: 'Онлайн-запись временно недоступна' });
    }

    const day = new Date(`${dateStr}T12:00:00.000Z`);
    if (!isWorkingDay(day, settings)) {
      return res.status(400).json({ ok: false, error: 'Клиника не работает в выбранный день' });
    }

    const allSlots = buildTimeSlots(settings);
    if (!allSlots.includes(time)) {
      return res.status(400).json({ ok: false, error: 'Выбранное время недоступно' });
    }

    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const conflictAppt = await prisma.appointment.findFirst({
      where: {
        clinicId,
        date: { gte: dayStart, lte: dayEnd },
        time,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(doctorId ? { doctorId } : {}),
      },
    });
    if (conflictAppt) {
      return res.status(409).json({ ok: false, error: 'Это время уже занято. Выберите другое.' });
    }

    const conflictBooking = await prisma.booking.findFirst({
      where: {
        clinicId,
        date: dayStart,
        time,
        status: { in: ['pending', 'confirmed'] },
        ...(doctorId ? { doctorId } : {}),
      },
    });
    if (conflictBooking) {
      return res.status(409).json({ ok: false, error: 'Это время уже занято. Выберите другое.' });
    }

    let doctorName: string | null = null;
    if (doctorId) {
      const member = await prisma.clinicMember.findFirst({
        where: { clinicId, userId: doctorId },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (!member) {
        return res.status(400).json({ ok: false, error: 'Врач не найден' });
      }
      doctorName = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim();
    }

    const row = await prisma.booking.create({
      data: {
        id: uid(),
        clinicId,
        patientName,
        phone,
        email,
        doctorId,
        doctorName,
        serviceName,
        date: dayStart,
        time,
        notes,
        status: 'pending',
        source: 'online',
      },
    });

    return res.status(201).json({
      ok: true,
      data: {
        id: row.id,
        clinicId: row.clinicId,
        patientName: row.patientName,
        phone: row.phone,
        date: dateStr,
        time: row.time,
        status: row.status,
      },
    });
  } catch (error) {
    console.error('[Public] booking', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отправить заявку' });
  }
});
