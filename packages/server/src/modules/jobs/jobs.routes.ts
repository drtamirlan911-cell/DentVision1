import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

const SEED = [
  {
    title: 'Врач-стоматолог-терапевт', clinicName: 'KazDent', city: 'Алматы',
    salary: '450 000 — 700 000 ₸', employmentType: 'Полная занятость',
    description: 'Требуется опытный стоматолог-терапевт. Современное оборудование, цифровая рентгенография.',
    tags: ['Терапия', 'Эндодонтия'],
  },
  {
    title: 'Дентальный гигиенист', clinicName: 'Smile Clinic', city: 'Астана',
    salary: '300 000 — 450 000 ₸', employmentType: 'Полная занятость',
    description: 'Ищем гигиениста для профилактических процедур и чистки.',
    tags: ['Профилактика'],
  },
  {
    title: 'Врач-ортодонт', clinicName: 'Dental Premium', city: 'Алматы',
    salary: '600 000 — 900 000 ₸', employmentType: 'Полная занятость',
    description: 'Ортодонт с опытом работы с элайнерами и брекетами.',
    tags: ['Ортодонтия', 'Элайнеры'],
  },
];

export const jobsRouter = Router();

async function ensureSeed() {
  const count = await prisma.jobVacancy.count();
  if (count === 0) {
    await prisma.jobVacancy.createMany({
      data: SEED.map((s) => ({ id: uid(), ...s, status: 'open', tags: s.tags })),
    });
  }
}

jobsRouter.get('/', optionalAuth, async (req, res) => {
  try {
    await ensureSeed();
    const { q, city } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { status: 'open' };
    if (city && city !== 'all') where.city = city;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { clinicName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    const list = await prisma.jobVacancy.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json(list);
  } catch (error) {
    console.error('List jobs error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить вакансии' } satisfies ApiResponse);
  }
});

jobsRouter.get('/me/applications', authenticate, async (req: AuthRequest, res) => {
  try {
    const apps = await prisma.jobApplication.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(apps);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

jobsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, clinicName, city, salary, employmentType, description, tags, kind } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: 'title обязателен' } satisfies ApiResponse);

    const vacancy = await prisma.jobVacancy.create({
      data: {
        id: uid(),
        title: String(title),
        clinicName: clinicName || [req.user!.firstName, req.user!.lastName].filter(Boolean).join(' ') || 'Клиника',
        city: city || '',
        salary: salary || '',
        employmentType: employmentType || (kind === 'resume' ? 'Ищу работу' : 'Полная занятость'),
        description: description || '',
        tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []),
        status: 'open',
        userId: req.user!.id,
        clinicId: req.user!.clinicId || null,
        kind: kind === 'resume' ? 'resume' : 'vacancy',
      },
    });
    return res.status(201).json(vacancy);
  } catch (error) {
    console.error('Create job error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось разместить объявление' } satisfies ApiResponse);
  }
});

jobsRouter.post('/:id/apply', authenticate, async (req: AuthRequest, res) => {
  try {
    const vacancy = await prisma.jobVacancy.findUnique({ where: { id: req.params.id as string } });
    if (!vacancy) return res.status(404).json({ ok: false, error: 'Вакансия не найдена' } satisfies ApiResponse);

    const existing = await prisma.jobApplication.findFirst({
      where: { vacancyId: vacancy.id, userId: req.user!.id },
    });
    if (existing) return res.json(existing);

    const application = await prisma.jobApplication.create({
      data: {
        id: uid(),
        vacancyId: vacancy.id,
        userId: req.user!.id,
        userName: [req.user!.firstName, req.user!.lastName].filter(Boolean).join(' ') || req.user!.email,
        coverNote: req.body?.coverNote || '',
        status: 'new',
      },
    });
    return res.status(201).json(application);
  } catch (error) {
    console.error('Apply job error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось откликнуться' } satisfies ApiResponse);
  }
});

export default jobsRouter;
