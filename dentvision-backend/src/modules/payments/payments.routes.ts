import { Router } from 'express';
import type { WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import { serializeBigInt, tengeToMinor } from '../../lib/money.js';
import { recordSale } from '../finance/finance.service.js';
import { env } from '../../config.js';
import {
  providers,
  markMockPaymentStatus,
  verifyKaspiCallbackAuth,
} from './kaspi.provider.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Payments (Phase 5). Payment gateway + Kaspi QR with authenticated callback.
export const paymentsRouter = Router();

async function settleOrderPayment(payment: {
  id: string;
  refId: string | null;
  amount: bigint;
  meta: unknown;
}): Promise<boolean> {
  if (!payment.refId) return false;
  const order = await prisma.order.findUnique({ where: { id: payment.refId } });
  if (!order) return false;
  if (order.status === 'paid' || order.status === 'packing' || order.status === 'shipped' || order.status === 'delivered') {
    return true;
  }

  const items = Array.isArray(order.items) ? (order.items as any[]) : [];
  const bySupplier = new Map<string, number>();
  for (const line of items) {
    const supplierId = String(line.supplier_id || line.supplierId || '');
    if (!supplierId) continue;
    const lineTotal = Number(line.price || 0) * Number(line.quantity || line.qty || 1);
    bySupplier.set(supplierId, (bySupplier.get(supplierId) || 0) + lineTotal);
  }

  const alreadySold = await prisma.transaction.findFirst({
    where: { refType: 'order', refId: order.id, type: 'sale' },
  });

  // Credit suppliers by line totals (gateway amount may be lower after DentCash).
  if (!alreadySold) {
    for (const [supplierId, tenge] of bySupplier) {
      const share = tengeToMinor(tenge);
      if (share <= 0n) continue;
      await recordSale({
        domain: 'shop',
        sellerType: 'SUPPLIER',
        sellerId: supplierId,
        amountMinor: share,
        refType: 'order',
        refId: order.id,
      });
    }
  }

  const prevMeta = (order.meta && typeof order.meta === 'object' ? order.meta : {}) as Record<string, unknown>;
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'paid',
      meta: { ...prevMeta, paymentId: payment.id, paidAt: new Date().toISOString() },
    },
  });
  return true;
}

async function settleEnrollmentPayment(payment: {
  id: string;
  refId: string | null;
  amount: bigint;
  sellerType: string | null;
  sellerId: string | null;
  meta: unknown;
}): Promise<boolean> {
  const meta = (payment.meta || {}) as {
    courseId?: string;
    userId?: string;
  };
  const courseId = payment.refId || meta.courseId;
  const userId = meta.userId;
  if (!courseId || !userId) return false;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return false;

  let enrollment = await prisma.schoolEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  const createdNow = !enrollment;
  if (!enrollment) {
    enrollment = await prisma.schoolEnrollment.create({
      data: { id: uid(), userId, courseId },
    });
  }

  const alreadySold = await prisma.transaction.findFirst({
    where: { refType: 'enrollment', refId: enrollment.id, type: 'sale' },
  });

  const lecturerId = payment.sellerId || course.lecturerId;
  if (lecturerId && payment.amount > 0n && !alreadySold) {
    await recordSale({
      domain: 'school',
      sellerType: (payment.sellerType as WalletOwnerType) || 'LECTURER',
      sellerId: lecturerId,
      amountMinor: payment.amount,
      refType: 'enrollment',
      refId: enrollment.id,
    });
  }

  if (createdNow || !alreadySold) {
    const { accrueAcademyCashback } = await import('../dentcash/cashback.engine.js');
    await accrueAcademyCashback({
      userId,
      enrollmentId: enrollment.id,
      amountMinor: payment.amount,
      lecturerId: course.lecturerId,
      academyId: course.academyId,
    }).catch((err) => console.error('[dentcash academy]', err));
  }

  return true;
}

async function settleAcademyEventPayment(payment: {
  id: string;
  amount: bigint;
  meta: unknown;
}): Promise<boolean> {
  const meta = (payment.meta || {}) as {
    productId?: string;
    format?: string;
    title?: string;
    userId?: string;
  };
  if (!meta.productId || !meta.userId) return false;
  // Catalog events are soft products — mark payment meta completed; optional PLATFORM sale.
  if (payment.amount > 0n) {
    await recordSale({
      domain: 'school',
      sellerType: 'PLATFORM',
      sellerId: 'system',
      amountMinor: payment.amount,
      refType: 'academy_event',
      refId: payment.id,
    }).catch((err) => console.error('[academy event sale]', err));
  }
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      meta: {
        ...meta,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      },
    },
  });
  return true;
}

async function settlePaidPayment(payment: {
  id: string;
  refType: string | null;
  refId: string | null;
  domain: string | null;
  sellerType: string | null;
  sellerId: string | null;
  amount: bigint;
  meta: unknown;
}): Promise<boolean> {
  let settled = false;

  if (payment.refType === 'sale' && payment.sellerType && payment.sellerId) {
    await recordSale({
      domain: payment.domain || 'shop',
      sellerType: payment.sellerType as WalletOwnerType,
      sellerId: payment.sellerId,
      amountMinor: payment.amount,
      refType: 'payment',
      refId: payment.id,
    });
    settled = true;
  }

  if (payment.refType === 'subscription' && payment.refId) {
    const meta = (payment.meta || {}) as { saasPlan?: string; months?: number; userId?: string };
    const planRaw = String(meta.saasPlan || 'professional').toLowerCase();
    const saasPlan = (planRaw === 'pro' ? 'professional' : planRaw) as
      'starter' | 'professional' | 'enterprise';
    const { activateClinicSubscriptionFromPayment, isSaasPlanId } = await import(
      '../billing/clinicSubscription.service.js'
    );
    if (isSaasPlanId(saasPlan)) {
      await activateClinicSubscriptionFromPayment({
        clinicId: payment.refId,
        saasPlan,
        months: meta.months || 1,
        paymentId: payment.id,
      });
      if (meta.userId) {
        const { accrueSaasCashback } = await import('../dentcash/cashback.engine.js');
        await accrueSaasCashback({
          userId: meta.userId,
          paymentId: payment.id,
          amountMinor: payment.amount,
          clinicId: payment.refId,
        }).catch((err) => console.error('[dentcash saas]', err));
      }
      settled = true;
    }
  }

  if (payment.refType === 'order') {
    settled = (await settleOrderPayment(payment)) || settled;
  }

  if (payment.refType === 'enrollment') {
    settled = (await settleEnrollmentPayment(payment)) || settled;
  }

  if (payment.refType === 'academy_event') {
    settled = (await settleAcademyEventPayment(payment)) || settled;
  }

  return settled;
}

async function assertPaymentOwner(req: AuthRequest, payment: { meta: unknown; refType: string | null; refId: string | null }) {
  const meta = (payment.meta || {}) as { userId?: string };
  if (meta.userId && meta.userId === req.user!.id) return true;
  if (payment.refType === 'order' && payment.refId) {
    const order = await prisma.order.findUnique({ where: { id: payment.refId }, select: { userId: true } });
    if (order?.userId === req.user!.id) return true;
  }
  return false;
}

// Create a payment (returns provider QR/deeplink). Requires auth.
paymentsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      amount,
      amountMinor,
      provider = 'kaspi_qr',
      domain,
      sellerType,
      sellerId,
      refType,
      refId,
      meta,
    } = req.body || {};
    const gateway = providers[provider];
    if (!gateway) {
      return res.status(400).json({ ok: false, error: 'Неизвестный провайдер' } satisfies ApiResponse);
    }
    if (amount === undefined && amountMinor === undefined) {
      return res.status(400).json({ ok: false, error: 'amount обязателен' } satisfies ApiResponse);
    }
    const minor = amountMinor !== undefined ? BigInt(amountMinor) : tengeToMinor(Number(amount));
    if (minor <= 0n) {
      return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
    }

    const created = await gateway.createPayment({ amountMinor: minor, refId });
    const payment = await prisma.payment.create({
      data: {
        provider,
        externalId: created.externalId,
        amount: minor,
        status: 'pending',
        refType: refType || null,
        refId: refId || null,
        domain: domain || null,
        sellerType: sellerType || null,
        sellerId: sellerId || null,
        meta: {
          qr: created.qr,
          userId: req.user!.id,
          ...(meta && typeof meta === 'object' ? meta : {}),
        },
      },
    });

    return res.status(201).json({
      ok: true,
      data: { ...serializeBigInt(payment), qr: created.qr },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании платежа' } satisfies ApiResponse);
  }
});

paymentsRouter.get('/:id', authenticate, async (req: AuthRequest, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id as string } });
  if (!payment) {
    return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);
  }
  const owned = await assertPaymentOwner(req, payment);
  if (!owned) {
    return res.status(403).json({ ok: false, error: 'Нет доступа к платежу' } satisfies ApiResponse);
  }
  const meta = (payment.meta || {}) as { qr?: string };
  let providerStatus: string | null = null;
  if (payment.externalId) {
    const gateway = providers[payment.provider] || providers.kaspi_qr;
    providerStatus = await gateway.getPaymentStatus(payment.externalId);
  }
  return res.json({
    ok: true,
    data: { ...serializeBigInt(payment), qr: meta.qr || null, providerStatus },
  } satisfies ApiResponse);
});

/**
 * Buyer-side confirm / sync.
 * - Production: settles only if provider already reports paid (webhook).
 * - Development/test: allows sandbox completion of mock Kaspi so shop/school UX works.
 */
paymentsRouter.post('/:id/confirm', authenticate, async (req: AuthRequest, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id as string } });
    if (!payment) {
      return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);
    }
    const owned = await assertPaymentOwner(req, payment);
    if (!owned) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к платежу' } satisfies ApiResponse);
    }

    if (payment.status === 'paid') {
      return res.json({
        ok: true,
        data: { ...serializeBigInt(payment), settled: true, alreadyPaid: true },
      } satisfies ApiResponse);
    }

    let providerStatus: 'pending' | 'paid' | 'failed' | 'expired' = 'pending';
    if (payment.externalId) {
      const gateway = providers[payment.provider] || providers.kaspi_qr;
      providerStatus = await gateway.getPaymentStatus(payment.externalId);
    }

    const sandbox = env.NODE_ENV !== 'production';
    const canComplete = providerStatus === 'paid' || sandbox;

    if (!canComplete) {
      return res.status(402).json({
        ok: false,
        error: 'Оплата ещё не подтверждена. Оплатите Kaspi QR и дождитесь webhook.',
        data: { paymentStatus: payment.status, providerStatus },
      } satisfies ApiResponse);
    }

    if (payment.externalId) {
      markMockPaymentStatus(payment.externalId, 'paid');
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'paid' },
    });

    const settled = await settlePaidPayment({ ...payment, status: 'paid' } as typeof payment);
    const meta = (updated.meta || {}) as { qr?: string };

    return res.json({
      ok: true,
      data: {
        ...serializeBigInt(updated),
        qr: meta.qr || null,
        settled,
        sandbox: sandbox && providerStatus !== 'paid',
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Confirm payment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка подтверждения оплаты' } satisfies ApiResponse);
  }
});

// Provider callback — MUST present valid KASPI_CALLBACK_SECRET / HMAC.
// Idempotent: a payment is settled at most once.
paymentsRouter.post('/callbacks/kaspi', async (req, res) => {
  try {
    const auth = verifyKaspiCallbackAuth({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body || {},
    });
    if (!auth.ok) {
      return res.status(401).json({ ok: false, error: auth.error } satisfies ApiResponse);
    }

    const { externalId, status } = req.body || {};
    if (!externalId) {
      return res.status(400).json({ ok: false, error: 'externalId обязателен' } satisfies ApiResponse);
    }
    const payment = await prisma.payment.findUnique({ where: { externalId } });
    if (!payment) {
      return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);
    }

    if (payment.status === 'paid') {
      return res.json({ ok: true, data: { id: payment.id, status: payment.status, settled: false } } satisfies ApiResponse);
    }

    const newStatus = status === 'paid' ? 'paid' : status === 'failed' ? 'failed' : 'pending';
    if (payment.externalId) {
      markMockPaymentStatus(payment.externalId, newStatus);
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus },
    });

    let settled = false;
    if (newStatus === 'paid') {
      settled = await settlePaidPayment(payment);
    }

    return res.json({ ok: true, data: { id: updated.id, status: updated.status, settled } } satisfies ApiResponse);
  } catch (error) {
    console.error('Kaspi callback error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка обработки callback' } satisfies ApiResponse);
  }
});

export default paymentsRouter;
export { settlePaidPayment };
