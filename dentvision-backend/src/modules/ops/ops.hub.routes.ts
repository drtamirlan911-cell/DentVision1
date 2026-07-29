import { Router } from 'express';
import type { ClinicPlan, ExpertLevel, WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePlatformOps } from '../../middleware/platformOps.js';
import { publish } from '../../lib/events.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

/**
 * Platform Ops Command Center API — hidden behind SUPERADMIN + ops key.
 * Mounted at /api/ops/*
 */
export const opsHubRouter = Router();
opsHubRouter.use(authenticate);
opsHubRouter.use(requirePlatformOps);

const UI_TO_CLINIC_PLAN: Record<string, ClinicPlan> = {
  demo: 'DEMO',
  starter: 'STANDARD',
  standard: 'STANDARD',
  pro: 'PRO',
  professional: 'PRO',
  enterprise: 'ENTERPRISE',
};

/** Attach display name/email from User — Lecturer has no name fields of its own. */
async function withLecturerUsers<T extends { userId: string }>(rows: T[]) {
  if (!rows.length) return [] as Array<T & { name: string; email: string | null }>;
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return rows.map((row) => {
    const u = byId[row.userId];
    const name = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
    return {
      ...row,
      name: name || 'Лектор',
      email: u?.email || null,
    };
  });
}

const CLINIC_TO_SAAS: Record<string, string> = {
  DEMO: 'professional',
  STANDARD: 'starter',
  PRO: 'professional',
  ENTERPRISE: 'enterprise',
};

const LEVEL_TRANSITIONS: Record<ExpertLevel, ExpertLevel[]> = {
  new: ['verified'],
  verified: ['expert', 'new'],
  expert: ['international_speaker', 'verified'],
  international_speaker: ['expert'],
};

async function upsertClinicSubscription(clinicId: string, plan: ClinicPlan, periodEnd?: Date | null, status?: string) {
  const saasPlan = CLINIC_TO_SAAS[plan] || 'free';
  return prisma.subscription.upsert({
    where: { ownerType_ownerId: { ownerType: 'CLINIC' as WalletOwnerType, ownerId: clinicId } },
    create: {
      ownerType: 'CLINIC',
      ownerId: clinicId,
      plan: saasPlan,
      status: status || 'active',
      periodEnd: periodEnd ?? null,
    },
    update: {
      plan: saasPlan,
      ...(periodEnd !== undefined && { periodEnd }),
      ...(status !== undefined && { status }),
    },
  });
}

// ─── Overview / command queue (Apple/Kaspi-style inbox) ───
opsHubRouter.get('/overview', async (_req: AuthRequest, res) => {
  try {
    const now = new Date();
    const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const [
      clinics, activeClinics, users, patients,
      suppliers, pendingSuppliers, verifiedSuppliers,
      academies, lecturers, newLecturers, courses, products,
      expiringSubs, suspendedSubs, saleAgg,
    ] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.count({ where: { active: true } }),
      prisma.user.count(),
      prisma.patient.count(),
      prisma.supplier.count(),
      prisma.supplier.count({ where: { status: { in: ['pending', 'documents_review'] } } }),
      prisma.supplier.count({ where: { status: { in: ['verified', 'official_partner'] } } }),
      prisma.academy.count(),
      prisma.lecturer.count(),
      prisma.lecturer.count({ where: { level: 'new' } }),
      prisma.course.count(),
      prisma.product.count(),
      prisma.subscription.count({
        where: {
          ownerType: 'CLINIC',
          status: 'active',
          periodEnd: { gte: now, lte: in14d },
        },
      }),
      prisma.subscription.count({ where: { ownerType: 'CLINIC', status: 'suspended' } }),
      prisma.transaction.aggregate({ where: { type: 'sale' }, _sum: { amount: true }, _count: true }),
    ]);

    const platformWallet = await getOrCreateWallet('PLATFORM', 'system');

    // Estimated MRR from active clinic subscriptions (rough tier prices in KZT)
    const activeSubs = await prisma.subscription.findMany({
      where: { ownerType: 'CLINIC', status: 'active' },
      select: { plan: true },
    });
    const PRICE: Record<string, number> = { free: 0, starter: 0, professional: 49900, enterprise: 149900 };
    const mrr = activeSubs.reduce((s, x) => s + (PRICE[x.plan] || 0), 0);

    const [pendingSupplierRows, newLecturerRows, expiringClinicRows] = await Promise.all([
      prisma.supplier.findMany({
        where: { status: { in: ['pending', 'documents_review'] } },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: { _count: { select: { documents: true, members: true } } },
      }),
      prisma.lecturer.findMany({
        where: { level: 'new' },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: { academy: { select: { id: true, name: true } }, _count: { select: { courses: true, verifications: true } } },
      }),
      prisma.subscription.findMany({
        where: { ownerType: 'CLINIC', status: 'active', periodEnd: { gte: now, lte: in14d } },
        orderBy: { periodEnd: 'asc' },
        take: 20,
      }),
    ]);

    // Attach clinic names for expiring
    const clinicIds = expiringClinicRows.map((s) => s.ownerId);
    const clinicMap = Object.fromEntries(
      (await prisma.clinic.findMany({ where: { id: { in: clinicIds } }, select: { id: true, name: true, plan: true, active: true } }))
        .map((c) => [c.id, c]),
    );

    return res.json({
      ok: true,
      data: {
        stats: {
          clinics,
          activeClinics,
          blockedClinics: clinics - activeClinics,
          users,
          patients,
          suppliers,
          verifiedSuppliers,
          academies,
          lecturers,
          courses,
          products,
          salesCount: saleAgg._count,
          gmvMinor: (saleAgg._sum.amount ?? 0n).toString(),
          platformRevenueMinor: platformWallet.balance.toString(),
          mrr,
          expiringSoon: expiringSubs,
          suspendedSubs,
          currency: 'KZT',
        },
        queues: {
          suppliersPending: pendingSupplierRows,
          lecturersNew: await withLecturerUsers(newLecturerRows),
          clinicsExpiring: expiringClinicRows.map((s) => ({
            ...s,
            clinic: clinicMap[s.ownerId] || null,
          })),
        },
        attentionCount: pendingSuppliers + newLecturers + expiringSubs,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[ops/overview]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка overview' } satisfies ApiResponse);
  }
});

// ─── Clinics + subscriptions ───
opsHubRouter.get('/clinics', async (_req: AuthRequest, res) => {
  try {
    const clinics = await prisma.clinic.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true, patients: true } } },
    });
    const subs = await prisma.subscription.findMany({
      where: { ownerType: 'CLINIC', ownerId: { in: clinics.map((c) => c.id) } },
    });
    const subBy = Object.fromEntries(subs.map((s) => [s.ownerId, s]));

    return res.json({
      ok: true,
      data: clinics.map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        phone: c.phone,
        plan: c.plan,
        active: c.active,
        members: c._count.members,
        patients: c._count.patients,
        subscription: subBy[c.id] || {
          plan: CLINIC_TO_SAAS[c.plan] || 'free',
          status: c.active ? 'active' : 'suspended',
          periodEnd: null,
        },
        createdAt: c.createdAt,
      })),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[ops/clinics]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

opsHubRouter.post('/clinics/:id/plan', async (req: AuthRequest, res) => {
  try {
    const planRaw = String(req.body?.plan || '').toLowerCase();
    const clinicPlan = UI_TO_CLINIC_PLAN[planRaw];
    if (!clinicPlan) return res.status(400).json({ ok: false, error: 'Некорректный план' } satisfies ApiResponse);

    const clinic = await prisma.clinic.update({
      where: { id: req.params.id as string },
      data: { plan: clinicPlan },
    });
    const sub = await upsertClinicSubscription(clinic.id, clinicPlan);
    return res.json({ ok: true, data: { clinic, subscription: sub } } satisfies ApiResponse);
  } catch (error) {
    console.error('[ops/clinics plan]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка смены плана' } satisfies ApiResponse);
  }
});

opsHubRouter.post('/clinics/:id/extend', async (req: AuthRequest, res) => {
  try {
    const months = Math.min(Math.max(parseInt(String(req.body?.months || 1), 10) || 1, 1), 24);
    const clinic = await prisma.clinic.findUnique({ where: { id: req.params.id as string } });
    if (!clinic) return res.status(404).json({ ok: false, error: 'Not found' } satisfies ApiResponse);

    const existing = await prisma.subscription.findUnique({
      where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinic.id } },
    });
    const base = existing?.periodEnd && existing.periodEnd > new Date() ? existing.periodEnd : new Date();
    const periodEnd = new Date(base);
    periodEnd.setMonth(periodEnd.getMonth() + months);

    const sub = await upsertClinicSubscription(clinic.id, clinic.plan, periodEnd, 'active');
    if (!clinic.active) {
      await prisma.clinic.update({ where: { id: clinic.id }, data: { active: true } });
    }
    return res.json({ ok: true, data: { periodEnd, subscription: sub, months } } satisfies ApiResponse);
  } catch (error) {
    console.error('[ops/clinics extend]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка продления' } satisfies ApiResponse);
  }
});

opsHubRouter.post('/clinics/:id/suspend', async (req: AuthRequest, res) => {
  try {
    const clinic = await prisma.clinic.update({
      where: { id: req.params.id as string },
      data: { active: false },
    });
    await upsertClinicSubscription(clinic.id, clinic.plan, undefined, 'suspended');
    return res.json({ ok: true, data: clinic } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка блокировки' } satisfies ApiResponse);
  }
});

opsHubRouter.post('/clinics/:id/activate', async (req: AuthRequest, res) => {
  try {
    const clinic = await prisma.clinic.update({
      where: { id: req.params.id as string },
      data: { active: true },
    });
    await upsertClinicSubscription(clinic.id, clinic.plan, undefined, 'active');
    return res.json({ ok: true, data: clinic } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка активации' } satisfies ApiResponse);
  }
});

// ─── School governance ───
opsHubRouter.get('/school', async (_req: AuthRequest, res) => {
  try {
    const [academies, lecturers, courses] = await Promise.all([
      prisma.academy.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { lecturers: true, courses: true } } },
        take: 100,
      }),
      prisma.lecturer.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          academy: { select: { id: true, name: true } },
          _count: { select: { courses: true, verifications: true } },
        },
        take: 100,
      }),
      prisma.course.count(),
    ]);
    return res.json({
      ok: true,
      data: {
        academies,
        lecturers: await withLecturerUsers(lecturers),
        courseCount: courses,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[ops/school]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка school' } satisfies ApiResponse);
  }
});

opsHubRouter.post('/lecturers/:id/level', async (req: AuthRequest, res) => {
  try {
    const target = req.body?.level as ExpertLevel | undefined;
    if (!target || !(target in LEVEL_TRANSITIONS)) {
      return res.status(400).json({ ok: false, error: 'Некорректный level' } satisfies ApiResponse);
    }
    const existing = await prisma.lecturer.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Not found' } satisfies ApiResponse);
    if (existing.level === target) {
      return res.json({ ok: true, data: existing } satisfies ApiResponse);
    }
    const allowed = LEVEL_TRANSITIONS[existing.level] || [];
    if (!allowed.includes(target)) {
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
    console.error('[ops/lecturer level]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

// ─── Automations (one-click queues) ───
opsHubRouter.post('/automations/advance-supplier-reviews', async (req: AuthRequest, res) => {
  try {
    // PENDING with ≥1 document → DOCUMENTS_REVIEW; DOCUMENTS_REVIEW → VERIFIED (ops one-click batch)
    const pending = await prisma.supplier.findMany({
      where: { status: 'pending' },
      include: { _count: { select: { documents: true } } },
    });
    const toReview = pending.filter((s) => s._count.documents > 0);
    let advanced = 0;
    for (const s of toReview) {
      await prisma.supplier.update({ where: { id: s.id }, data: { status: 'documents_review' } });
      publish('supplier.status_changed', {
        supplierId: s.id,
        status: 'documents_review',
        from: 'pending',
        to: 'documents_review',
        userId: req.user?.id,
      });
      advanced += 1;
    }

    const autoVerify = req.body?.verify === true || req.body?.verifyReviewed === true;
    let verified = 0;
    if (autoVerify) {
      const reviewed = await prisma.supplier.findMany({ where: { status: 'documents_review' } });
      for (const s of reviewed) {
        await prisma.supplier.update({ where: { id: s.id }, data: { status: 'verified' } });
        publish('supplier.status_changed', {
          supplierId: s.id,
          status: 'verified',
          from: 'documents_review',
          to: 'verified',
          userId: req.user?.id,
        });
        verified += 1;
      }
    }

    return res.json({
      ok: true,
      data: { advancedToReview: advanced, verified, skippedNoDocs: pending.length - toReview.length },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[ops/automations suppliers]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка автоматизации' } satisfies ApiResponse);
  }
});

opsHubRouter.post('/automations/verify-new-lecturers', async (req: AuthRequest, res) => {
  try {
    // NEW lecturers with ≥1 verification doc → VERIFIED
    const news = await prisma.lecturer.findMany({
      where: { level: 'new' },
      include: { _count: { select: { verifications: true } } },
    });
    const ready = news.filter((l) => l._count.verifications > 0);
    let verified = 0;
    for (const l of ready) {
      await prisma.lecturer.update({ where: { id: l.id }, data: { level: 'verified' } });
      publish('lecturer.level_changed', {
        lecturerId: l.id,
        level: 'verified',
        from: 'new',
        to: 'verified',
        userId: req.user?.id,
      });
      verified += 1;
    }
    return res.json({
      ok: true,
      data: { verified, skippedNoDocs: news.length - ready.length },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[ops/automations lecturers]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка автоматизации' } satisfies ApiResponse);
  }
});

opsHubRouter.post('/automations/extend-expiring-clinics', async (req: AuthRequest, res) => {
  try {
    const months = Math.min(Math.max(parseInt(String(req.body?.months || 1), 10) || 1, 1), 12);
    const now = new Date();
    const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const expiring = await prisma.subscription.findMany({
      where: { ownerType: 'CLINIC', status: 'active', periodEnd: { gte: now, lte: in14d } },
    });
    let extended = 0;
    for (const s of expiring) {
      const base = s.periodEnd && s.periodEnd > now ? s.periodEnd : now;
      const periodEnd = new Date(base);
      periodEnd.setMonth(periodEnd.getMonth() + months);
      await prisma.subscription.update({
        where: { id: s.id },
        data: { periodEnd, status: 'active' },
      });
      await prisma.clinic.updateMany({ where: { id: s.ownerId }, data: { active: true } });
      extended += 1;
    }
    return res.json({ ok: true, data: { extended, months } } satisfies ApiResponse);
  } catch (error) {
    console.error('[ops/automations extend]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка автоматизации' } satisfies ApiResponse);
  }
});

export default opsHubRouter;
