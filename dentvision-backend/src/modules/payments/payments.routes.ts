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
  withPaymentQr,
} from './kaspi.provider.js';
import {
  ClinicPaymentsError,
  createClinicKaspiPayment,
  getClinicGatewayStatus,
  loadClinicPaymentsConfig,
} from './clinicPayments.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
  const meta = (payment.meta || {}) as { userId?: string; clinicId?: string; merchantScope?: string };
  if (meta.userId && meta.userId === req.user!.id) return true;
  if (payment.refType === 'order' && payment.refId) {
    const order = await prisma.order.findUnique({ where: { id: payment.refId }, select: { userId: true } });
    if (order?.userId === req.user!.id) return true;
  }
  // Clinic cashier payments: any active member of that clinic may confirm.
  if (meta.clinicId && (meta.merchantScope === 'clinic' || payment.refType === 'appointment' || payment.refType === 'crm_invoice')) {
    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId: meta.clinicId } },
    });
    if (membership) return true;
  }
  return false;
}

function verifyClinicCallbackAuth(input: {
  secret: string;
  headers: Record<string, string | string[] | undefined>;
  body: { externalId?: string; status?: string; signature?: string };
}): { ok: true } | { ok: false; error: string } {
  if (!input.secret || input.secret.length < 16) {
    return { ok: false, error: 'Webhook secret клиники не настроен' };
  }
  const headerRaw =
    input.headers['x-kaspi-signature'] ||
    input.headers['x-callback-secret'] ||
    input.headers['x-webhook-secret'];
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const externalId = String(input.body?.externalId || '');
  const status = String(input.body?.status || '');
  const bodySig = String(input.body?.signature || '');
  const provided = String(header || bodySig || '');
  if (!provided) return { ok: false, error: 'Подпись callback обязательна' };

  const expectedHmac = createHmac('sha256', input.secret)
    .update(`${externalId}:${status}`)
    .digest('hex');
  const a = Buffer.from(provided);
  const bSecret = Buffer.from(input.secret);
  const bHmac = Buffer.from(expectedHmac);
  const matchSecret = a.length === bSecret.length && timingSafeEqual(a, bSecret);
  const matchHmac = a.length === bHmac.length && timingSafeEqual(a, bHmac);
  if (!matchSecret && !matchHmac) return { ok: false, error: 'Неверная подпись callback' };
  return { ok: true };
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
    if (amount === undefined && amountMinor === undefined) {
      return res.status(400).json({ ok: false, error: 'amount обязателен' } satisfies ApiResponse);
    }
    const minor = amountMinor !== undefined ? BigInt(amountMinor) : tengeToMinor(Number(amount));
    if (minor <= 0n) {
      return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
    }

    const metaObj = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    const clinicId = String(metaObj.clinicId || req.body?.clinicId || '');
    const isClinicCashier =
      domain === 'crm' ||
      refType === 'appointment' ||
      refType === 'crm_invoice' ||
      Boolean(clinicId && (domain === 'crm' || metaObj.merchantScope === 'clinic'));

    // CRM cashier → clinic's own Kaspi/bank (never platform merchant).
    if (isClinicCashier) {
      if (!clinicId) {
        return res.status(400).json({
          ok: false,
          error: 'clinicId обязателен для оплаты на кассе клиники',
        } satisfies ApiResponse);
      }
      const membership = await prisma.clinicMember.findUnique({
        where: { userId_clinicId: { userId: req.user!.id, clinicId } },
      });
      if (!membership) {
        return res.status(403).json({ ok: false, error: 'Нет доступа к кассе этой клиники' } satisfies ApiResponse);
      }

      const created = await createClinicKaspiPayment({
        clinicId,
        amountMinor: minor,
        refId: refId || null,
        comment: String(metaObj.title || metaObj.service || 'Оплата в клинике'),
      });

      const payment = await prisma.payment.create({
        data: {
          provider: created.provider,
          externalId: created.externalId,
          amount: minor,
          status: 'pending',
          refType: refType || 'crm_invoice',
          refId: refId || null,
          domain: 'crm',
          sellerType: sellerType || 'CLINIC',
          sellerId: sellerId || clinicId,
          meta: {
            qr: created.qr,
            userId: req.user!.id,
            clinicId,
            merchantScope: 'clinic',
            clinicPayMode: created.mode,
            ...metaObj,
          },
        },
      });

      return res.status(201).json({
        ok: true,
        data: withPaymentQr(serializeBigInt(payment) as Record<string, unknown>, created.qr),
      } satisfies ApiResponse);
    }

    // Platform Kaspi (Academy / Shop / SaaS) — DentVision merchant.
    const gateway = providers[provider];
    if (!gateway) {
      return res.status(400).json({ ok: false, error: 'Неизвестный провайдер' } satisfies ApiResponse);
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
          merchantScope: 'platform',
          ...(meta && typeof meta === 'object' ? meta : {}),
        },
      },
    });

    return res.status(201).json({
      ok: true,
      data: withPaymentQr(serializeBigInt(payment) as Record<string, unknown>, created.qr),
    } satisfies ApiResponse);
  } catch (error: any) {
    if (error instanceof ClinicPaymentsError) {
      return res.status(error.status).json({
        ok: false,
        error: error.message,
      } satisfies ApiResponse);
    }
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
  const meta = (payment.meta || {}) as { qr?: string; clinicId?: string; merchantScope?: string };
  let providerStatus: string | null = null;
  if (payment.externalId) {
    if (meta.merchantScope === 'clinic' && meta.clinicId) {
      providerStatus = await getClinicGatewayStatus(meta.clinicId, payment.externalId);
    } else {
      const gateway = providers[payment.provider] || providers.kaspi_qr;
      providerStatus = await gateway.getPaymentStatus(payment.externalId);
    }
  }
  return res.json({
    ok: true,
    data: {
      ...withPaymentQr(serializeBigInt(payment) as Record<string, unknown>, meta.qr || null),
      providerStatus,
    },
  } satisfies ApiResponse);
});

/**
 * Buyer-side / cashier confirm.
 * - Clinic cashier (merchantScope=clinic): staff may confirm after seeing pay in clinic Kaspi.
 * - Platform: production waits for provider paid unless mock secret unset.
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

    const meta = (payment.meta || {}) as { clinicId?: string; merchantScope?: string; clinicPayMode?: string };
    const isClinic = meta.merchantScope === 'clinic' || payment.provider === 'clinic_kaspi';

    let providerStatus: 'pending' | 'paid' | 'failed' | 'expired' = 'pending';
    if (payment.externalId) {
      if (isClinic && meta.clinicId) {
        providerStatus = await getClinicGatewayStatus(meta.clinicId, payment.externalId);
      } else {
        const gateway = providers[payment.provider] || providers.kaspi_qr;
        providerStatus = await gateway.getPaymentStatus(payment.externalId);
      }
    }

    const sandbox =
      env.NODE_ENV !== 'production' ||
      !env.KASPI_CALLBACK_SECRET ||
      env.KASPI_CALLBACK_SECRET.length < 16;
    const canComplete = providerStatus === 'paid' || sandbox;

    if (!canComplete) {
      return res.status(402).json({
        ok: false,
        error: 'Оплата ещё не подтверждена. Оплатите по QR и дождитесь подтверждения.',
        data: { paymentStatus: payment.status, providerStatus },
      } satisfies ApiResponse);
    }

    if (payment.externalId && !isClinic) {
      markMockPaymentStatus(payment.externalId, 'paid');
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'paid' },
    });

    const settled = await settlePaidPayment({ ...payment, status: 'paid' } as typeof payment);
    const qrMeta = (updated.meta || {}) as { qr?: string };

    return res.json({
      ok: true,
      data: {
        ...serializeBigInt(updated),
        qr: qrMeta.qr || null,
        settled,
        sandbox: !isClinic && platformSandbox && providerStatus !== 'paid',
        clinicStaffConfirm: isClinic && providerStatus !== 'paid',
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Confirm payment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка подтверждения оплаты' } satisfies ApiResponse);
  }
});

// Platform Kaspi callback
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

/** Per-clinic Kaspi / gateway webhook — money belongs to that clinic. */
paymentsRouter.post('/callbacks/kaspi/clinic/:clinicId', async (req, res) => {
  try {
    const clinicId = req.params.clinicId as string;
    const { clinic, cfg } = await loadClinicPaymentsConfig(clinicId);
    void clinic;
    const auth = verifyClinicCallbackAuth({
      secret: cfg.webhookSecret || '',
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body || {},
    });
    if (!auth.ok) {
      return res.status(401).json({ ok: false, error: auth.error } satisfies ApiResponse);
    }

    const externalId = String(req.body?.externalId || req.body?.id || req.body?.operation_id || '');
    const statusRaw = String(req.body?.status || req.body?.payment_status || '').toLowerCase();
    if (!externalId) {
      return res.status(400).json({ ok: false, error: 'externalId обязателен' } satisfies ApiResponse);
    }

    const payment = await prisma.payment.findUnique({ where: { externalId } });
    if (!payment) {
      return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);
    }
    const pMeta = (payment.meta || {}) as { clinicId?: string };
    if (pMeta.clinicId && pMeta.clinicId !== clinicId) {
      return res.status(403).json({ ok: false, error: 'Платёж другой клиники' } satisfies ApiResponse);
    }

    if (payment.status === 'paid') {
      return res.json({ ok: true, data: { id: payment.id, status: payment.status, settled: false } } satisfies ApiResponse);
    }

    const newStatus =
      ['paid', 'success', 'processed', 'completed'].includes(statusRaw)
        ? 'paid'
        : ['failed', 'error', 'cancelled', 'canceled'].includes(statusRaw)
          ? 'failed'
          : ['expired', 'timeout'].includes(statusRaw)
            ? 'expired'
            : 'pending';

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus },
    });

    let settled = false;
    if (newStatus === 'paid') {
      settled = await settlePaidPayment(payment);
    }

    return res.json({ ok: true, data: { id: updated.id, status: updated.status, settled } } satisfies ApiResponse);
  } catch (error: any) {
    if (error instanceof ClinicPaymentsError) {
      return res.status(error.status).json({ ok: false, error: error.message } satisfies ApiResponse);
    }
    console.error('Clinic Kaspi callback error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка обработки callback клиники' } satisfies ApiResponse);
  }
});

export default paymentsRouter;
export { settlePaidPayment };
