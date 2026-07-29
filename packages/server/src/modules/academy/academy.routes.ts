import { Router } from 'express';
import { ExpertLevel } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { publish } from '../../lib/events.js';
import { paginate, paginatedResponse } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// School Governance — Academies & Lecturers (Phase 3,
// DENTVISION_V2_INTEGRATION_PLAN.md §5.2). Platform-managed registry + expert
// verification pipeline. Reads open to any authenticated user; writes require
// `academy.manage` (platform / SUPERADMIN today).
// ─────────────────────────────────────────────────────────────────────────────

// Expert verification pipeline (linear).
const LEVEL_TRANSITIONS: Record<ExpertLevel, ExpertLevel[]> = {
  new: ['verified'],
  verified: ['expert'],
  expert: ['international_speaker'],
  international_speaker: [],
};

// ─── Academies ───
export const academiesRouter = Router();
academiesRouter.use(authenticate);

academiesRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const { skip, take } = paginate(page, limit);
    const [data, total] = await Promise.all([
      prisma.academy.findMany({
        where: {},
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { _count: { select: { lecturers: true, courses: true } } },
      }),
      prisma.academy.count(),
    ]);
    return res.json({ ok: true, data: paginatedResponse(data, total, page, limit) } satisfies ApiResponse);
  } catch (error) {
    console.error('List academies error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении академий' } satisfies ApiResponse);
  }
});

academiesRouter.post('/', requirePermission('academy.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, city, ownerId } = req.body || {};
    if (!name) {
      return res.status(400).json({ ok: false, error: 'Название обязательно' } satisfies ApiResponse);
    }
    const academy = await prisma.academy.create({
      data: { name, city: city || null, ownerId: ownerId || null },
    });
    return res.status(201).json({ ok: true, data: academy } satisfies ApiResponse);
  } catch (error) {
    console.error('Create academy error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании академии' } satisfies ApiResponse);
  }
});

// ─── Lecturers ───
export const lecturersRouter = Router();
lecturersRouter.use(authenticate);

lecturersRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const { skip, take } = paginate(page, limit);
    const { level, academyId } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (academyId) where.academyId = academyId;

    const [data, total] = await Promise.all([
      prisma.lecturer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { academy: { select: { id: true, name: true } }, _count: { select: { courses: true } } },
      }),
      prisma.lecturer.count({ where }),
    ]);
    return res.json({ ok: true, data: paginatedResponse(data, total, page, limit) } satisfies ApiResponse);
  } catch (error) {
    console.error('List lecturers error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении лекторов' } satisfies ApiResponse);
  }
});

lecturersRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const lecturer = await prisma.lecturer.findUnique({
      where: { id: req.params.id as string },
      include: { verifications: true, academy: { select: { id: true, name: true } } },
    });
    if (!lecturer) {
      return res.status(404).json({ ok: false, error: 'Лектор не найден' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: lecturer } satisfies ApiResponse);
  } catch (error) {
    console.error('Get lecturer error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении лектора' } satisfies ApiResponse);
  }
});

lecturersRouter.post('/', requirePermission('academy.manage'), async (req: AuthRequest, res) => {
  try {
    const { userId, bio, academyId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId обязателен' } satisfies ApiResponse);
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Пользователь не найден' } satisfies ApiResponse);
    }
    const existing = await prisma.lecturer.findUnique({ where: { userId } });
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Профиль лектора уже существует' } satisfies ApiResponse);
    }
    const lecturer = await prisma.lecturer.create({
      data: { userId, bio: bio || null, academyId: academyId || null },
    });
    return res.status(201).json({ ok: true, data: lecturer } satisfies ApiResponse);
  } catch (error) {
    console.error('Create lecturer error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании лектора' } satisfies ApiResponse);
  }
});

// Expert verification transition.
lecturersRouter.post('/:id/level', requirePermission('academy.manage'), async (req: AuthRequest, res) => {
  try {
    const target = req.body?.level as ExpertLevel | undefined;
    if (!target || !(target in LEVEL_TRANSITIONS)) {
      return res.status(400).json({ ok: false, error: 'Некорректный уровень' } satisfies ApiResponse);
    }
    const existing = await prisma.lecturer.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Лектор не найден' } satisfies ApiResponse);
    }
    if (existing.level === target) {
      return res.json({ ok: true, data: existing } satisfies ApiResponse);
    }
    if (!(LEVEL_TRANSITIONS[existing.level] || []).includes(target)) {
      return res.status(409).json({
        ok: false,
        error: `Недопустимый переход: ${existing.level} → ${target}`,
      } satisfies ApiResponse);
    }
    const lecturer = await prisma.lecturer.update({
      where: { id: existing.id },
      data: { level: target },
    });
    publish('lecturer.level_changed', {
      lecturerId: lecturer.id,
      level: target,
      from: existing.level,
      to: target,
      userId: req.user?.id,
    });
    return res.json({ ok: true, data: lecturer } satisfies ApiResponse);
  } catch (error) {
    console.error('Lecturer level error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при смене уровня' } satisfies ApiResponse);
  }
});

// Attach a verification document (diploma/certificate/publication/clinical_case).
lecturersRouter.post('/:id/verifications', requirePermission('academy.manage'), async (req: AuthRequest, res) => {
  try {
    const { type, url } = req.body || {};
    if (!type) {
      return res.status(400).json({ ok: false, error: 'type обязателен' } satisfies ApiResponse);
    }
    const lecturer = await prisma.lecturer.findUnique({ where: { id: req.params.id as string } });
    if (!lecturer) {
      return res.status(404).json({ ok: false, error: 'Лектор не найден' } satisfies ApiResponse);
    }
    const doc = await prisma.expertVerification.create({
      data: { lecturerId: lecturer.id, type, url: url || null },
    });
    return res.status(201).json({ ok: true, data: doc } satisfies ApiResponse);
  } catch (error) {
    console.error('Lecturer verification error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при добавлении верификации' } satisfies ApiResponse);
  }
});
