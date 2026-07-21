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
  CLINIC_SAAS_PLANS,
} from './clinicSubscription.service.js';

/**
 * Clinic self-serve billing — tariff selection + Kaspi checkout.
 * Paid plans activate ONLY after authenticated provider webhook marks payment paid.
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
 * Sync payment status with provider / DB.
 * Does NOT mark unpaid invoices as paid. Activates subscription only if already paid
 * (via authenticated Kaspi webhook) or provider reports paid.
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

    // Ask provider for latest status (never trust the client).
    let providerStatus: 'pending' | 'paid' | 'failed' | 'expired' = 'pending';
    if (payment.externalId) {
      const gateway = providers[payment.provider] || providers.kaspi_qr;
      providerStatus = await gateway.getPaymentStatus(payment.externalId);
    }

    // Only the authenticated webhook may flip DB → paid. Here we only read / report.
    if (payment.status === 'paid') {
      const snap = await getClinicBillingSnapshot(clinicId);
      return res.json({
        ok: true,
        data: {
          activated: true,
          alreadyPaid: true,
          paymentStatus: 'paid',
          providerStatus,
          ...snap,
        },
      } satisfies ApiResponse);
    }

    if (providerStatus === 'failed' || providerStatus === 'expired') {
      if (payment.status !== providerStatus) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: providerStatus } });
      }
      return res.status(402).json({
        ok: false,
        error: 'Оплата не прошла',
        data: { activated: false, paymentStatus: providerStatus, providerStatus },
      } satisfies ApiResponse);
    }

    return res.status(402).json({
      ok: false,
      error: 'Оплата ещё не подтверждена провайдером. Оплатите Kaspi QR и дождитесь подтверждения.',
      data: {
        activated: false,
        paymentStatus: payment.status,
        providerStatus,
      },
    } satisfies ApiResponse);
  } catch (error: any) {
    console.error('[clinic-billing/confirm]', error);
    const status = error?.status || 500;
    return res.status(status).json({ ok: false, error: error?.message || 'Ошибка подтверждения' } satisfies ApiResponse);
  }
});

/** Read-only payment status for polling UI. */
clinicBillingRouter.get('/payments/:id', async (req: AuthRequest, res) => {
  try {
    const clinicId = clinicIdFrom(req);
    await assertClinicBillingAccess(req.user!.id, clinicId);
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id as string } });
    if (!payment || payment.refType !== 'subscription' || payment.refId !== clinicId) {
      return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);
    }
    let providerStatus: string | null = null;
    if (payment.externalId) {
      const gateway = providers[payment.provider] || providers.kaspi_qr;
      providerStatus = await gateway.getPaymentStatus(payment.externalId);
    }
    return res.json({
      ok: true,
      data: {
        ...serializeBigInt(payment),
        providerStatus,
        activated: payment.status === 'paid',
      },
    } satisfies ApiResponse);
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ ok: false, error: error?.message || 'Ошибка' } satisfies ApiResponse);
  }
});

export default clinicBillingRouter;
