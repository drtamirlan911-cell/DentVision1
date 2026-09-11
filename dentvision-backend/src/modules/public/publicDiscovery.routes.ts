import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../../lib/prisma.js';
import { mergeClinicSettings } from '../clinics/clinicSettings.js';

const router = Router();

const discoveryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Слишком много запросов. Подождите минуту.' },
});

const clean = (value: unknown) => String(value || '').trim().toLowerCase();

/** Public discovery: clinics with online booking enabled. No patient data is exposed. */
router.get('/clinics/discover', discoveryLimiter, async (req, res) => {
  try {
    const city = clean(req.query.city);
    const q = clean(req.query.q);
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 20);

    const clinics = await prisma.clinic.findMany({
      select: { id: true, name: true, city: true, address: true, phone: true, logo: true, settings: true },
      orderBy: { name: 'asc' },
      take: 200,
    });

    const candidates = clinics
      .filter((clinic) => mergeClinicSettings(clinic.settings).onlineBookingEnabled !== false)
      .filter((clinic) => !city || clean(clinic.city).includes(city))
      .filter((clinic) => {
        if (!q) return true;
        const haystack = [clinic.name, clinic.city, clinic.address].map(clean).join(' ');
        return haystack.includes(q);
      })
      .slice(0, limit);

    const data = await Promise.all(candidates.map(async (clinic) => {
      const members = await prisma.clinicMember.findMany({
        where: { clinicId: clinic.id, role: { in: ['DOCTOR', 'OWNER'] } },
        include: { user: { select: { id: true, firstName: true, lastName: true, spec: true, avatar: true } } },
        orderBy: { joinedAt: 'asc' },
        take: 6,
      });

      return {
        id: clinic.id,
        name: clinic.name,
        city: clinic.city,
        address: clinic.address,
        phone: clinic.phone,
        logo: clinic.logo,
        doctors: members.map((member) => ({
          id: member.user.id,
          name: [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim(),
          spec: member.user.spec || undefined,
          avatar: member.user.avatar || undefined,
        })),
      };
    }));

    return res.json({ ok: true, data: { clinics: data, query: { city: city || null, q: q || null } } });
  } catch (error) {
    console.error('[Public] clinic discovery', error);
    return res.status(500).json({ ok: false, error: 'Не удалось выполнить поиск клиник' });
  }
});

export default router;
