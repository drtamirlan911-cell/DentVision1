import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { env } from '../../config.js';
import { tengeToMinor, serializeBigInt } from '../../lib/money.js';
import { providers } from '../payments/kaspi.provider.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { runSubscriptionCron } from '../../jobs/subscriptionCron.js';
import {
  activateClinicSubscriptionFromPayment,
  assertClinicBillingAccess,
  getClinicBillingSnapshot,
  isSaasPlanId,
  type SaasPlanId,
  CLINIC_SAAS_PLANS,
} from './clinicSubscription.service.js';

/**
 * Clinic self-serve billing — tariff selection + Kaspi checkout + mock confirm.
 * Mounted at /api/clinic-billing
 */
export const clinicBillingRouter = Router();

/** Secret-protected cron trigger (no user JWT). */
clinicBillingRouter.post('/cron', async (req, res) => {
  try {
    const secret = env.CRON_SECRET;
    if (!secret) {
      return res.status(503).json({ ok: false, error: 'CRON_SECRET не настроен' } satisfies ApiResponse);
    }
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    const provided = bearer || String(req.headers['x-cron-secret'] || '');
    if (provided !== secret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse);
    }
    const data = await runSubscriptionCron();
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[clinic-billing/cron]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка cron' } satisfies ApiResponse);
  }
});

clinicBillingRouter.use(authenticate);

function clinicIdFrom(req: AuthRequest): string {
  return String(req.user?.clinicId || req.query.clinicId || req.body?.clinicId || '');
}

clinicBillingRouter.get('/me', async (req: AuthRequest, res) => {
  try {
    const clinicId = clinicIdFrom(req);
    await assertClinicBillingAccess(req.user!.id, clinicId);
    const snap = await getClinicBillingSnapshot(clinicId);
    if (!snap) return res.status(404).json({ ok: false, error: 'Клиника не найдена' } satisfies ApiResponse);
    return res.json({ ok: true, data: snap } satisfies ApiResponse);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ ok: false, error: error?.message || 'Ошибка' } satisfies ApiResponse);
  }
});

/**
 * Start checkout for a plan.
 * body: { plan: starter|professional|enterprise, months?: number }
 * Free starter activates immediately; paid plans return Kaspi QR payment.
 */
clinicBillingRouter.post('/checkout', async (req: AuthRequest, res) => {
  try {
    const clinicId = clinicIdFrom(req);
    await assertClinicBillingAccess(req.user!.id, clinicId);

    const planRaw = String(req.body?.plan || '').toLowerCase();
    const planId = planRaw === 'pro' ? 'professional' : planRaw;
    if (!isSaasPlanId(planId)) {
      return res.status(400).json({ ok: false, error: 'Некорректный тариф' } satisfies ApiResponse);
    }

    const months = Math.min(Math.max(parseInt(String(req.body?.months || 1), 10) || 1, 1), 12);
    const catalog = CLINIC_SAAS_PLANS.find((p) => p.id === planId)!;

    // Free forever — activate without payment
    if (catalog.priceTenge <= 0) {
      const result = await activateClinicSubscriptionFromPayment({
        clinicId,
        saasPlan: planId,
        months: 0,
      });
      return res.json({
        ok: true,
        data: { activated: true, payment: null, subscription: result.subscription, clinic: result.clinic },
      } satisfies ApiResponse);
    }

    const amountMinor = tengeToMinor(catalog.priceTenge * months);
    const gateway = providers.kaspi_qr;
    const created = await gateway.createPayment({ amountMinor, refId: clinicId });

    const payment = await prisma.payment.create({
      data: {
        provider: 'kaspi_qr',
        externalId: created.externalId,
        amount: amountMinor,
        status: 'pending',
        refType: 'subscription',
        refId: clinicId,
        domain: 'saas',
        meta: {
          qr: created.qr,
          saasPlan: planId,
          months,
          clinicId,
        },
      },
    });

    return res.status(201).json({
      ok: true,
      data: {
        activated: false,
        payment: { ...serializeBigInt(payment), qr: created.qr },
        plan: planId,
        months,
        amountTenge: catalog.priceTenge * months,
      },
    } satisfies ApiResponse);
  } catch (error: any) {
    console.error('[clinic-billing/checkout]', error);
    const status = error?.status || 500;
    return res.status(status).json({ ok: false, error: error?.message || 'Ошибка checkout' } satisfies ApiResponse);
  }
});

/**
 * Sandbox / mock confirm — marks Kaspi payment as paid and activates subscription.
 * In production this is done by the Kaspi webhook; kept for demo UX.
 */
clinicBillingRouter.post('/confirm', async (req: AuthRequest, res) => {
  try {
    const clinicId = clinicIdFrom(req);
    await assertClinicBillingAccess(req.user!.id, clinicId);

    const paymentId = String(req.body?.paymentId || '');
    if (!paymentId) {
      return res.status(400).json({ ok: false, error: 'paymentId обязателен' } satisfies ApiResponse);
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.refType !== 'subscription' || payment.refId !== clinicId) {
      return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);
    }

    if (payment.status === 'paid') {
      const snap = await getClinicBillingSnapshot(clinicId);
      return res.json({ ok: true, data: { alreadyPaid: true, ...snap } } satisfies ApiResponse);
    }

    const meta = (payment.meta || {}) as { saasPlan?: string; months?: number };
    const planRaw = String(meta.saasPlan || 'professional');
    const saasPlan = (planRaw === 'pro' ? 'professional' : planRaw) as SaasPlanId;
    if (!isSaasPlanId(saasPlan)) {
      return res.status(400).json({ ok: false, error: 'Некорректный план в платеже' } satisfies ApiResponse);
    }

    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'paid' } });
    const result = await activateClinicSubscriptionFromPayment({
      clinicId,
      saasPlan,
      months: meta.months || 1,
      paymentId: payment.id,
    });

    return res.json({
      ok: true,
      data: { activated: true, clinic: result.clinic, subscription: result.subscription },
    } satisfies ApiResponse);
  } catch (error: any) {
    console.error('[clinic-billing/confirm]', error);
    const status = error?.status || 500;
    return res.status(status).json({ ok: false, error: error?.message || 'Ошибка подтверждения' } satisfies ApiResponse);
  }
});

export default clinicBillingRouter;
