import { Router } from 'express';
import type { WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Subscriptions (Phase 5). SaaS plans (free/starter/professional/enterprise) per
// owner (clinic/supplier/academy). Source of truth for entitlements.
export const subscriptionsRouter = Router();

subscriptionsRouter.use(authenticate);

const PLANS = ['free', 'starter', 'professional', 'enterprise'];
const OWNER_TYPES = ['CLINIC', 'SUPPLIER', 'ACADEMY', 'LECTURER', 'PARTNER', 'PLATFORM'];

subscriptionsRouter.get('/:ownerType/:ownerId', async (req: AuthRequest, res) => {
  const ownerType = String(req.params.ownerType).toUpperCase();
  if (!OWNER_TYPES.includes(ownerType)) {
    return res.status(400).json({ ok: false, error: 'Некорректный тип владельца' } satisfies ApiResponse);
  }
  const sub = await prisma.subscription.findUnique({
    where: { ownerType_ownerId: { ownerType: ownerType as WalletOwnerType, ownerId: req.params.ownerId as string } },
  });
  return res.json({ ok: true, data: sub || { ownerType, ownerId: req.params.ownerId, plan: 'free', status: 'active' } } satisfies ApiResponse);
});

subscriptionsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { ownerType, ownerId, plan, periodEnd } = req.body || {};
    const ot = String(ownerType || '').toUpperCase();
    if (!OWNER_TYPES.includes(ot) || !ownerId) {
      return res.status(400).json({ ok: false, error: 'ownerType и ownerId обязательны' } satisfies ApiResponse);
    }
    if (plan && !PLANS.includes(plan)) {
      return res.status(400).json({ ok: false, error: 'Некорректный план' } satisfies ApiResponse);
    }
    const sub = await prisma.subscription.upsert({
      where: { ownerType_ownerId: { ownerType: ot as WalletOwnerType, ownerId } },
      create: { ownerType: ot as WalletOwnerType, ownerId, plan: plan || 'free', periodEnd: periodEnd ? new Date(periodEnd) : null },
      update: { plan: plan || undefined, periodEnd: periodEnd ? new Date(periodEnd) : undefined },
    });
    return res.status(201).json({ ok: true, data: sub } satisfies ApiResponse);
  } catch (error) {
    console.error('Upsert subscription error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при сохранении подписки' } satisfies ApiResponse);
  }
});

export default subscriptionsRouter;
