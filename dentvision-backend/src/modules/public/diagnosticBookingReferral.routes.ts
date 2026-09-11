import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { authenticate } from '../../middleware/auth.js';

export const diagnosticBookingReferralRouter = Router();

type AuthRequest = any;

function normalizePhone(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

async function canAccessCenter(user: any, centerId: string): Promise<boolean> {
  if (user?.role === 'SUPERADMIN') return true;
  if (user?.organizationType === 'DIAGNOSTIC_CENTER' && user?.organizationId === centerId) return true;

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

/**
 * Attach an online diagnostic booking to an already-authorized clinic referral.
 * This is deliberately explicit: a public booking must never guess a clinic or
 * doctor from a patient's name/phone and must never cross a tenant boundary.
 */
diagnosticBookingReferralRouter.post('/diagnostics/center/:centerId/bookings/:bookingId/link-referral', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const centerId = String(req.params.centerId || '').trim();
    const bookingId = String(req.params.bookingId || '').trim();
    const referralId = String(req.body?.referralId || '').trim();
    if (!centerId || !bookingId || !referralId) {
      return res.status(400).json({ ok: false, error: 'centerId, bookingId и referralId обязательны' });
    }
    if (!(await canAccessCenter(req.user, centerId))) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к диагностическому центру' });
    }

    const booking = await (prisma as any).diagnosticBooking.findFirst({
      where: { id: bookingId, centerId },
      include: { study: { select: { id: true, name: true } } },
    });
    if (!booking) return res.status(404).json({ ok: false, error: 'Заявка не найдена' });
    if (['cancelled', 'declined'].includes(String(booking.status))) {
      return res.status(409).json({ ok: false, error: 'Нельзя привязать направление к отменённой заявке' });
    }

    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        id: true,
        clinicId: true,
        patientId: true,
        patientName: true,
        patientPhone: true,
        doctorId: true,
        centerId: true,
        status: true,
        result: { select: { id: true } },
      },
    });
    if (!referral) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (referral.centerId !== centerId) {
      return res.status(403).json({ ok: false, error: 'Направление относится к другому диагностическому центру' });
    }
    if (!referral.clinicId) {
      return res.status(409).json({ ok: false, error: 'У направления отсутствует клиника-получатель' });
    }

    const bookingPhone = normalizePhone(booking.patientPhone);
    const referralPhone = normalizePhone(referral.patientPhone);
    if (bookingPhone && referralPhone && bookingPhone !== referralPhone) {
      return res.status(409).json({ ok: false, error: 'Телефон заявки не совпадает с направлением' });
    }

    const existing = await prisma.$queryRawUnsafe<any[]>(
      'SELECT id, booking_id, referral_id, clinic_id, doctor_id FROM "diagnostic_booking_referrals" WHERE booking_id = $1 OR referral_id = $2 LIMIT 1',
      bookingId,
      referralId,
    );
    if (existing.length) {
      const row = existing[0];
      if (row.booking_id !== bookingId || row.referral_id !== referralId) {
        return res.status(409).json({ ok: false, error: 'Заявка или направление уже привязаны к другой записи' });
      }
      return res.json({ ok: true, data: { bookingId, referralId, clinicId: row.clinic_id, doctorId: row.doctor_id, resultReady: !!referral.result } });
    }

    const id = uid();
    await prisma.$executeRawUnsafe(
      'INSERT INTO "diagnostic_booking_referrals" (id, booking_id, referral_id, center_id, clinic_id, doctor_id) VALUES ($1,$2,$3,$4,$5,$6)',
      id,
      bookingId,
      referralId,
      centerId,
      referral.clinicId,
      referral.doctorId || null,
    );

    // Keep the public booking state aligned with the existing referral lifecycle.
    if (String(booking.status) === 'pending' || String(booking.status) === 'confirmed') {
      await (prisma as any).diagnosticBooking.update({ where: { id: bookingId }, data: { status: 'in_progress' } });
    }

    return res.status(201).json({
      ok: true,
      data: {
        bookingId,
        referralId,
        clinicId: referral.clinicId,
        doctorId: referral.doctorId,
        resultReady: !!referral.result,
        resultId: referral.result?.id || null,
      },
    });
  } catch (error) {
    console.error('[Diagnostics] booking/referral link', error);
    return res.status(500).json({ ok: false, error: 'Не удалось привязать заявку к направлению' });
  }
});

/** Center-side status bridge. Medical result data is never exposed here. */
diagnosticBookingReferralRouter.get('/diagnostics/center/:centerId/bookings/:bookingId/referral', authenticate, async (req: AuthRequest, res: any) => {
  try {
    const centerId = String(req.params.centerId || '').trim();
    const bookingId = String(req.params.bookingId || '').trim();
    if (!(await canAccessCenter(req.user, centerId))) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к диагностическому центру' });
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT booking_id, referral_id, clinic_id, doctor_id FROM "diagnostic_booking_referrals" WHERE booking_id = $1 AND center_id = $2 LIMIT 1',
      bookingId,
      centerId,
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Направление ещё не привязано' });

    const row = rows[0];
    const result = await prisma.diagnosticResult.findUnique({
      where: { referralId: row.referral_id },
      select: { id: true, signedAt: true, signedBy: true },
    });

    return res.json({
      ok: true,
      data: {
        bookingId: row.booking_id,
        referralId: row.referral_id,
        clinicId: row.clinic_id,
        doctorId: row.doctor_id,
        resultReady: !!result,
        resultId: result?.id || null,
        resultSignedAt: result?.signedAt || null,
        resultSignedBy: result?.signedBy || null,
      },
    });
  } catch (error) {
    console.error('[Diagnostics] booking/referral status', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить статус направления' });
  }
});
