import { Router } from 'express';
import type { WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { assertClinicBillingAccess } from './clinicSubscription.service.js';

// Subscriptions (Phase 5). SaaS plans per owner.
// Writes are restricted — use /api/clinic-billing checkout for clinics.
export const subscriptionsRouter = Router();

subscriptionsRouter.use(authenticate);

const PLANS = ['free', 'starter', 'professional', 'enterprise'];
const OWNER_TYPES = ['CLINIC', 'SUPPLIER', 'ACADEMY', 'LECTURER', 'PARTNER', 'PLATFORM'];

async function assertCanReadSubscription(req: AuthRequest, ownerType: string, ownerId: string) {
  if (req.user?.role === 'SUPERADMIN') return;
  if (ownerType === 'CLINIC') {
    const member = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId: ownerId } },
    });
    if (!member) {
      const err = new Error('Нет доступа к подписке');
      (err as any).status = 403;
      throw err;
    }
    return;
  }
  if (ownerId !== req.user?.id && ownerId !== req.user?.supplierId && ownerId !== req.user?.lecturerId) {
    const err = new Error('Нет доступа к подписке');
    (err as any).status = 403;
    throw err;
  }
}

subscriptionsRouter.get('/:ownerType/:ownerId', async (req: AuthRequest, res) => {
  try {
    const ownerType = String(req.params.ownerType).toUpperCase();
    if (!OWNER_TYPES.includes(ownerType)) {
      return res.status(400).json({ ok: false, error: 'Некорректный тип владельца' } satisfies ApiResponse);
    }
    await assertCanReadSubscription(req, ownerType, req.params.ownerId as string);
    const sub = await prisma.subscription.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: ownerType as WalletOwnerType,
          ownerId: req.params.ownerId as string,
        },
      },
    });
    return res.json({
      ok: true,
      data: sub || { ownerType, ownerId: req.params.ownerId, plan: 'free', status: 'active' },
    } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(e?.status || 500).json({ ok: false, error: e?.message || 'Ошибка' } satisfies ApiResponse);
  }
});

subscriptionsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    // Only platform ops / superadmin may manually upsert. Clinics must use checkout.
    if (req.user?.role !== 'SUPERADMIN') {
      return res.status(403).json({
        ok: false,
        error: 'Изменение тарифа вручную запрещено. Используйте «Тариф и оплата».',
        code: 'USE_BILLING_CHECKOUT',
      } satisfies ApiResponse);
    }
    const { ownerType, ownerId, plan, periodEnd, status } = req.body || {};
    const ot = String(ownerType || '').toUpperCase();
    if (!OWNER_TYPES.includes(ot) || !ownerId) {
      return res.status(400).json({ ok: false, error: 'ownerType и ownerId обязательны' } satisfies ApiResponse);
    }
    if (plan && !PLANS.includes(plan)) {
      return res.status(400).json({ ok: false, error: 'Некорректный план' } satisfies ApiResponse);
    }
    if (ot === 'CLINIC') {
      await assertClinicBillingAccess(req.user!.id, ownerId);
    }
    const sub = await prisma.subscription.upsert({
      where: { ownerType_ownerId: { ownerType: ot as WalletOwnerType, ownerId } },
      create: {
        ownerType: ot as WalletOwnerType,
        ownerId,
        plan: plan || 'free',
        status: status || 'active',
        periodEnd: periodEnd ? new Date(periodEnd) : null,
      },
      update: {
        plan: plan || undefined,
        status: status || undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      },
    });
    if (ot === 'CLINIC' && plan) {
      const clinicPlan =
        plan === 'enterprise' ? 'ENTERPRISE' : plan === 'professional' ? 'PRO' : plan === 'starter' ? 'STANDARD' : 'DEMO';
      await prisma.clinic.update({
        where: { id: ownerId },
        data: {
          plan: clinicPlan as any,
          active: status !== 'expired' && status !== 'suspended',
        },
      });
    }
    return res.status(201).json({ ok: true, data: sub } satisfies ApiResponse);
  } catch (error: any) {
    console.error('Upsert subscription error:', error);
    return res.status(error?.status || 500).json({
      ok: false,
      error: error?.message || 'Ошибка при сохранении подписки',
    } satisfies ApiResponse);
  }
});

export default subscriptionsRouter;
