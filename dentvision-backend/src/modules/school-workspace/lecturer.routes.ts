import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import { serializeBigInt, tengeToMinor } from '../../lib/money.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// School Workspace — Lecturer cabinet (self-service). All routes operate on the
// lecturer from the active LECTURER context (req.user.lecturerId), so a lecturer
// only ever sees/manages their own courses/wallet. Enter via
// POST /api/iam/switch-context { scopeType: "LECTURER", scopeId }.
// ─────────────────────────────────────────────────────────────────────────────
export const lecturerRouter = Router();

lecturerRouter.use(authenticate);

/** Self-serve: create lecturer profile for the current user (no prior context needed). */
lecturerRouter.post('/register', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const existing = await prisma.lecturer.findUnique({ where: { userId } });
    if (existing) {
      return res.json({ ok: true, data: existing } satisfies ApiResponse);
    }
    const lecturer = await prisma.lecturer.create({
      data: {
        id: uid(),
        userId,
        level: 'NEW',
        bio: typeof req.body?.bio === 'string' ? req.body.bio : null,
        academyId: typeof req.body?.academyId === 'string' ? req.body.academyId : null,
      },
    });
    await getOrCreateWallet('LECTURER', lecturer.id).catch(() => null);
    return res.status(201).json({ ok: true, data: lecturer } satisfies ApiResponse);
  } catch (error) {
    console.error('Lecturer register error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать профиль лектора' } satisfies ApiResponse);
  }
});

function requireLecturerContext(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.lecturerId) {
    return res.status(403).json({ ok: false, error: 'Требуется контекст лектора (switch-context)' } satisfies ApiResponse);
  }
  next();
}

lecturerRouter.use(requireLecturerContext);

// ─── Profile ───
lecturerRouter.get('/me', async (req: AuthRequest, res) => {
  const lecturer = await prisma.lecturer.findUnique({
    where: { id: req.user!.lecturerId },
    include: { academy: { select: { id: true, name: true } }, _count: { select: { courses: true } } },
  });
  if (!lecturer) {
    return res.status(404).json({ ok: false, error: 'Лектор не найден' } satisfies ApiResponse);
  }
  return res.json({ ok: true, data: lecturer } satisfies ApiResponse);
});

// Update own bio. Expert level stays platform-controlled (verification pipeline).
lecturerRouter.patch('/me', async (req: AuthRequest, res) => {
  const { bio } = req.body || {};
  const lecturer = await prisma.lecturer.update({
    where: { id: req.user!.lecturerId },
    data: { ...(bio !== undefined && { bio: bio || null }) },
  });
  return res.json({ ok: true, data: lecturer } satisfies ApiResponse);
});

// ─── Own courses ───
lecturerRouter.get('/courses', async (req: AuthRequest, res) => {
  const courses = await prisma.course.findMany({
    where: { lecturerId: req.user!.lecturerId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { enrollments: true, lessons: true } } },
  });
  return res.json({ ok: true, data: courses } satisfies ApiResponse);
});

lecturerRouter.post('/courses', async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.title) {
      return res.status(400).json({ ok: false, error: 'title обязателен' } satisfies ApiResponse);
    }
    const lecturer = await prisma.lecturer.findUnique({ where: { id: req.user!.lecturerId } });
    const course = await prisma.course.create({
      data: {
        id: uid(),
        title: b.title,
        description: b.description || null,
        category: b.category || null,
        price: b.price !== undefined ? Number(b.price) : null,
        duration: b.duration || null,
        lecturerId: req.user!.lecturerId, // forced to own lecturer
        academyId: lecturer?.academyId || null,
      },
    });
    return res.status(201).json({ ok: true, data: course } satisfies ApiResponse);
  } catch (error) {
    console.error('Lecturer create course error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании курса' } satisfies ApiResponse);
  }
});

lecturerRouter.patch('/courses/:id', async (req: AuthRequest, res) => {
  const existing = await prisma.course.findFirst({
    where: { id: req.params.id as string, lecturerId: req.user!.lecturerId },
  });
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'Курс не найден' } satisfies ApiResponse);
  }
  const b = req.body || {};
  const course = await prisma.course.update({
    where: { id: existing.id },
    data: {
      ...(b.title !== undefined && { title: b.title }),
      ...(b.description !== undefined && { description: b.description || null }),
      ...(b.category !== undefined && { category: b.category || null }),
      ...(b.price !== undefined && { price: Number(b.price) }),
      ...(b.duration !== undefined && { duration: b.duration || null }),
    },
  });
  return res.json({ ok: true, data: course } satisfies ApiResponse);
});

lecturerRouter.delete('/courses/:id', async (req: AuthRequest, res) => {
  const existing = await prisma.course.findFirst({
    where: { id: req.params.id as string, lecturerId: req.user!.lecturerId },
  });
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'Курс не найден' } satisfies ApiResponse);
  }
  await prisma.course.delete({ where: { id: existing.id } });
  return res.json({ ok: true, data: { id: existing.id } } satisfies ApiResponse);
});

// ─── Wallet + payouts ───
lecturerRouter.get('/wallet', async (req: AuthRequest, res) => {
  const wallet = await getOrCreateWallet('LECTURER', req.user!.lecturerId!);
  return res.json({ ok: true, data: serializeBigInt(wallet) } satisfies ApiResponse);
});

lecturerRouter.post('/payouts', async (req: AuthRequest, res) => {
  const { amount, amountMinor } = req.body || {};
  if (amount === undefined && amountMinor === undefined) {
    return res.status(400).json({ ok: false, error: 'amount обязателен' } satisfies ApiResponse);
  }
  const minor = amountMinor !== undefined ? BigInt(amountMinor) : tengeToMinor(Number(amount));
  const wallet = await getOrCreateWallet('LECTURER', req.user!.lecturerId!);
  if (wallet.balance < minor) {
    return res.status(409).json({ ok: false, error: 'Недостаточно средств' } satisfies ApiResponse);
  }
  const payout = await prisma.payout.create({ data: { walletId: wallet.id, amount: minor, status: 'requested' } });
  return res.status(201).json({ ok: true, data: serializeBigInt(payout) } satisfies ApiResponse);
});

// ─── Analytics (own wallet ledger + enrollments) ───
lecturerRouter.get('/analytics', async (req: AuthRequest, res) => {
  const wallet = await getOrCreateWallet('LECTURER', req.user!.lecturerId!);
  const courses = await prisma.course.findMany({
    where: { lecturerId: req.user!.lecturerId },
    select: { id: true },
  });
  const courseIds = courses.map((c) => c.id);
  const [creditAgg, students] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { walletId: wallet.id, direction: 'credit' },
      _sum: { amount: true },
      _count: true,
    }),
    courseIds.length ? prisma.schoolEnrollment.count({ where: { courseId: { in: courseIds } } }) : Promise.resolve(0),
  ]);
  return res.json({
    ok: true,
    data: {
      balanceMinor: wallet.balance.toString(),
      earnedMinor: (creditAgg._sum.amount ?? 0n).toString(),
      salesCount: creditAgg._count,
      courseCount: courseIds.length,
      studentCount: students,
      currency: wallet.currency,
    },
  } satisfies ApiResponse);
});

export default lecturerRouter;
