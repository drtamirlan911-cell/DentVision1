import { Router } from 'express';
import type { Prisma, WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import { serializeBigInt, tengeToMinor, parseTengeToMinor } from '../../lib/money.js';
import { recordSaleTx } from '../finance/finance.service.js';
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
import {
  resolveClinicAccess,
  assertClinicWritable,
  PlanGateError,
} from '../billing/planEntitlements.js';
import { assertOrgAccess } from '../../lib/orgContext.js';
import { canTransitionOrder } from '../../lib/orderStatus.js';
import { reserveIdempotencyKey, completeIdempotencyKey, deleteIdempotencyKey } from '../../lib/idempotency.js';

// Payments (Phase 5). Payment gateway + Kaspi QR with authenticated callback.
export const paymentsRouter = Router();

async function settleOrderPayment(
  payment: {
    id: string;
    refId: string | null;
    amount: bigint;
    meta: unknown;
  },
  db: Prisma.TransactionClient,
): Promise<boolean> {
  if (!payment.refId) return false;
  const order = await db.order.findUnique({ where: { id: payment.refId } });
  if (!order) return false;
  // Idempotent no-op for already-paid / non-payable states. In particular a
  // cancelled order must never be resurrected by a late callback (audit F-2).
  if (order.status === 'paid' || !canTransitionOrder(order.status, 'paid')) {
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

  const alreadySold = await db.transaction.findFirst({
    where: { refType: 'order', refId: order.id, type: 'sale' },
  });

  // Credit suppliers by line totals (gateway amount may be lower after DentCash).
  if (!alreadySold) {
    for (const [supplierId, tenge] of bySupplier) {
      const share = tengeToMinor(tenge);
      if (share <= 0n) continue;
      await recordSaleTx(
        {
          domain: 'shop',
          sellerType: 'SUPPLIER',
          sellerId: supplierId,
          amountMinor: share,
          refType: 'order',
          refId: order.id,
        },
        db,
      );
    }
  }

  const prevMeta = (order.meta && typeof order.meta === 'object' ? order.meta : {}) as Record<string, unknown>;
  await db.order.update({
    where: { id: order.id },
    data: {
      status: 'paid',
      meta: { ...prevMeta, paymentId: payment.id, paidAt: new Date().toISOString() },
    },
  });
  return true;
}

async function settleEnrollmentPayment(
  payment: {
    id: string;
    refId: string | null;
    amount: bigint;
    sellerType: string | null;
    sellerId: string | null;
    meta: unknown;
  },
  db: Prisma.TransactionClient,
): Promise<boolean> {
  const meta = (payment.meta || {}) as {
    courseId?: string;
    userId?: string;
  };
  const courseId = payment.refId || meta.courseId;
  const userId = meta.userId;
  if (!courseId || !userId) return false;

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return false;

  let enrollment = await db.schoolEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  const createdNow = !enrollment;
  if (!enrollment) {
    enrollment = await db.schoolEnrollment.create({
      data: { id: uid(), userId, courseId },
    });
  }

  const alreadySold = await db.transaction.findFirst({
    where: { refType: 'enrollment', refId: enrollment.id, type: 'sale' },
  });

  const lecturerId = payment.sellerId || course.lecturerId;
  if (lecturerId && payment.amount > 0n && !alreadySold) {
    await recordSaleTx(
      {
        domain: 'school',
        sellerType: (payment.sellerType as WalletOwnerType) || 'LECTURER',
        sellerId: lecturerId,
        amountMinor: payment.amount,
        refType: 'enrollment',
        refId: enrollment.id,
      },
      db,
    );
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

async function settleAcademyEventPayment(
  payment: {
    id: string;
    amount: bigint;
    sellerType?: string | null;
    sellerId?: string | null;
    meta: unknown;
  },
  db: Prisma.TransactionClient,
): Promise<boolean> {
  const meta = (payment.meta || {}) as {
    productId?: string;
    format?: string;
    title?: string;
    userId?: string;
    courseId?: string;
  };
  if (!meta.productId || !meta.userId) return false;

  // Lecturer-owned DB product: create enrollment + credit lecturer wallet.
  if (meta.courseId) {
    await db.schoolEnrollment.upsert({
      where: { userId_courseId: { userId: meta.userId, courseId: meta.courseId } },
      create: { id: uid(), userId: meta.userId, courseId: meta.courseId },
      update: {},
    });
  }

  if (payment.amount > 0n) {
    const sellerType = (payment.sellerType || 'PLATFORM') as WalletOwnerType;
    const sellerId = payment.sellerId || 'system';
    // Previously best-effort (`.catch()`-swallowed) because recordSale opened
    // its own independent transaction. Now that this runs inside the caller's
    // shared `db`, a failure here must abort the whole settlement instead of
    // being silently absorbed — otherwise the payment would still be marked
    // 'confirmed' below with no matching ledger entry.
    await recordSaleTx(
      {
        domain: 'school',
        sellerType,
        sellerId,
        amountMinor: payment.amount,
        refType: 'academy_event',
        refId: payment.id,
      },
      db,
    );
  }
  await db.payment.update({
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

async function settlePaidPayment(
  payment: {
    id: string;
    refType: string | null;
    refId: string | null;
    domain: string | null;
    sellerType: string | null;
    sellerId: string | null;
    amount: bigint;
    meta: unknown;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<boolean> {
  let settled = false;

  if (payment.refType === 'sale' && payment.sellerType && payment.sellerId) {
    await recordSaleTx(
      {
        domain: payment.domain || 'shop',
        sellerType: payment.sellerType as WalletOwnerType,
        sellerId: payment.sellerId,
        amountMinor: payment.amount,
        refType: 'payment',
        refId: payment.id,
      },
      db,
    );
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
      await activateClinicSubscriptionFromPayment(
        {
          clinicId: payment.refId,
          saasPlan,
          months: meta.months || 1,
          paymentId: payment.id,
        },
        db,
      );
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
    settled = (await settleOrderPayment(payment, db)) || settled;
  }

  if (payment.refType === 'enrollment') {
    settled = (await settleEnrollmentPayment(payment, db)) || settled;
  }

  if (payment.refType === 'academy_event') {
    settled = (await settleAcademyEventPayment(payment, db)) || settled;
  }

  if (payment.refType === 'settlement' && payment.refId) {
    const { markSettlementPaid } = await import('../diagnostics/settlement.service.js');
    await markSettlementPaid(payment.refId, payment.id, db);
    settled = true;
  }

  return settled;
}

/**
 * Atomically claims a not-yet-paid payment for settlement: flips status→'paid'
 * only if it isn't already, via a conditional `updateMany` rather than a plain
 * check-then-act read+write. Two concurrent /confirm calls (or callbacks) for
 * the same payment can therefore never both win and both run
 * settlePaidPayment — the loser sees `count === 0` and must not settle again.
 */
async function claimPaymentForSettlement(
  db: Prisma.TransactionClient,
  paymentId: string,
): Promise<boolean> {
  const claimed = await db.payment.updateMany({
    where: { id: paymentId, status: { not: 'paid' } },
    data: { status: 'paid' },
  });
  return claimed.count === 1;
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
    if (await assertOrgAccess(req.user!, meta.clinicId)) return true;
  }
  return false;
}

/**
 * Ownership check for a payment *ref* (order/shop_order) at creation time.
 * A payment may only be created against an order the caller owns — closes the
 * IDOR where any authenticated user could pay another user's order.
 */
async function assertPaymentRefOwner(userId: string, refId: string, refType: string): Promise<boolean> {
  if (refType !== 'order' && refType !== 'shop_order') return true;
  try {
    const order = await prisma.order.findUnique({ where: { id: refId }, select: { userId: true } });
    return Boolean(order?.userId === userId);
  } catch {
    return false;
  }
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
  const bHmac = Buffer.from(expectedHmac);
  // Accept only the HMAC over (externalId:status). Comparing the caller's
  // supplied value against the raw clinic secret (the old `matchSecret`
  // branch) let anyone who knew the secret bypass the signature — a secret
  // must never authenticate a callback on its own.
  if (a.length !== bHmac.length || !timingSafeEqual(a, bHmac)) {
    return { ok: false, error: 'Неверная подпись callback' };
  }
  return { ok: true };
}

// Create a payment (returns provider QR/deeplink). Requires auth.
paymentsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  let idempotencyKey: string | undefined;
  let keyCompleted = false;
  try {
    // Idempotency: use client key or generate server-side from content hash so
    // a missing header still dedupes identical submits (audit F-3).
    idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      // Generate deterministic key from user + body to prevent double-submit
      const crypto = await import('node:crypto');
      const hash = crypto.createHash('sha256')
        .update(`${req.user!.id}:${JSON.stringify(req.body)}`)
        .digest('hex');
      idempotencyKey = `server-${hash.slice(0, 32)}`;
    }
    const reserved = await reserveIdempotencyKey(idempotencyKey);
    if (reserved.status === 'in_flight') {
      // Another identical request is being processed right now.
      return res.status(409).json({
        ok: false,
        error: 'Запрос уже обрабатывается, повторите позже',
      } satisfies ApiResponse);
    }
    if (reserved.status === 'exists') {
      const payment = await prisma.payment.findUnique({ where: { id: reserved.resultId } });
      if (payment) {
        return res.status(200).json({
          ok: true,
          data: serializeBigInt(payment),
        } satisfies ApiResponse);
      }
      // Stale record pointing at a deleted payment — free the key and continue.
      await deleteIdempotencyKey(idempotencyKey);
    }

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
    let minor: bigint;
    try {
      minor = amountMinor !== undefined ? BigInt(amountMinor) : parseTengeToMinor(amount);
    } catch {
      return res.status(400).json({ ok: false, error: 'Некорректная сумма' } satisfies ApiResponse);
    }
    if (minor <= 0n) {
      return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
    }

    // P1-1 fix: never trust the client-submitted amount. For order/shop refTypes
    // we recompute the expected total server-side and reconcile with what the
    // caller sent; a mismatch means tampering and is rejected as 409. CRM-cashier
    // payments without a refId have no server-side source of truth, so those are
    // reconciled later in the callback (settleOrderPayment already derives the
    // supplier splits from `order.items`, not from this amount).
    if ((refType === 'order' || refType === 'shop_order') && refId) {
      const ref = await prisma.$transaction(async (tx) => {
        if (refType === 'order') {
          return tx.order.findUnique({ where: { id: refId }, select: { total: true, status: true } });
        }
        return null;
      });
      if (!ref) {
        return res.status(404).json({ ok: false, error: 'Ссылка на заказ не найдена' } satisfies ApiResponse);
      }
      // Reconcile against `order.total`, not a sum of `order.items` prices.
      // `shop.routes.ts` sets `total` to goods + delivery, minus any DentCash
      // spent — `items` only ever held the product lines. Comparing to a
      // from-items recomputation ignored delivery and DentCash on every order,
      // so any order under the free-delivery threshold (or with cashback
      // applied) could never be paid: this check rejected it as tampered every
      // time. `order.total` is itself server-computed at order creation — the
      // client never supplied it — so it's exactly the source of truth the
      // comment above already says this check exists to trust.
      const expectedMinor = tengeToMinor(ref.total);
      if (expectedMinor !== minor) {
        return res.status(409).json({
          ok: false,
          error: `Сумма не совпадает с заказом: ожидалось ${expectedMinor}, получено ${minor}`,
        } satisfies ApiResponse);
      }
    }

    const metaObj = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};

    // P1 IDOR fix: a payment references an external object (order/invoice) by
    // refId. Never create a payment against an object the caller does not own.
    // `sellerId`/`refId` arrive from req.body, so we re-derive ownership from
    // the database record, not from the request.
    if (refId && (refType === 'order' || refType === 'shop_order')) {
      const owned = await assertPaymentRefOwner(req.user!.id, refId, refType);
      if (!owned) {
        return res.status(403).json({ ok: false, error: 'Нет доступа к этому объекту оплаты' } satisfies ApiResponse);
      }
    }

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
      if (!(await assertOrgAccess(req.user!, clinicId))) {
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
          provider: created.provider as any,
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

      await completeIdempotencyKey(idempotencyKey, payment.id);
      keyCompleted = true;

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

    await completeIdempotencyKey(idempotencyKey, payment.id);
    keyCompleted = true;

    return res.status(201).json({
      ok: true,
      data: withPaymentQr(serializeBigInt(payment) as Record<string, unknown>, created.qr),
    } satisfies ApiResponse);
  } catch (error: any) {
    // Free a reserved-but-unfinished key so a retry can succeed instead of
    // hitting a permanent 409 (audit F-3).
    if (idempotencyKey && !keyCompleted) {
      await deleteIdempotencyKey(idempotencyKey);
    }
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
  let payment = await prisma.payment.findUnique({ where: { id: req.params.id as string } });
  if (!payment) {
    return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);
  }
  const owned = await assertPaymentOwner(req, payment);
  if (!owned) {
    return res.status(403).json({ ok: false, error: 'Нет доступа к платежу' } satisfies ApiResponse);
  }

  // Lazy-expire stale pending payments (> 24h old)
  if (payment.status === 'pending') {
    const age = Date.now() - payment.createdAt.getTime();
    if (age > 86_400_000) {
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'expired' },
      });
    }
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

    const isProduction = env.NODE_ENV === 'production';
    const hasValidSecret = env.KASPI_CALLBACK_SECRET && env.KASPI_CALLBACK_SECRET.length >= 32;

    if (isProduction && !hasValidSecret) {
      return res.status(500).json({
        ok: false,
        error: 'KASPI_CALLBACK_SECRET is required in production (min 32 chars)',
      } satisfies ApiResponse);
    }

    const sandbox = !isProduction;
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

    // Atomic: the status flip is guarded by `status: { not: 'paid' }` so two
    // concurrent /confirm calls can't both win the race and both run
    // settlePaidPayment (double wallet credit / double subscription activation).
    // Settlement itself now runs against the same `tx`, so a failure anywhere
    // in the chain (recordSale, subscription activation, order/enrollment
    // settlement) rolls the status flip back too.
    const result = await prisma.$transaction(async (tx) => {
      const won = await claimPaymentForSettlement(tx, payment.id);
      const updated = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (!won) {
        return { updated, settled: false, alreadyPaid: true };
      }
      const settled = await settlePaidPayment({ ...payment, status: 'paid' } as typeof payment, tx);
      return { updated, settled, alreadyPaid: false };
    });

    const qrMeta = (result.updated.meta || {}) as { qr?: string };

    return res.json({
      ok: true,
      data: {
         ...serializeBigInt(result.updated),
         qr: qrMeta.qr || null,
         settled: result.settled,
         alreadyPaid: result.alreadyPaid,
        sandbox: !isClinic && sandbox && providerStatus !== 'paid',
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
    const isProduction = env.NODE_ENV === 'production';
    const hasValidSecret = env.KASPI_CALLBACK_SECRET && env.KASPI_CALLBACK_SECRET.length >= 32;

    if (isProduction && !hasValidSecret) {
      console.error('[payments] KASPI_CALLBACK_SECRET not configured in production');
      return res.status(500).json({ ok: false, error: 'Payment gateway not configured' } satisfies ApiResponse);
    }

    const auth = verifyKaspiCallbackAuth({
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body || {},
    });
    if (!auth.ok) {
         return res.status(401).json({ ok: false, error: (auth as { error: string }).error } satisfies ApiResponse);
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

    let settled = false;
    if (newStatus === 'paid') {
      // Same atomic guard as /confirm: only the caller that actually flips
      // pending→paid runs settlePaidPayment, and it runs against the same tx.
      const result = await prisma.$transaction(async (tx) => {
        const won = await claimPaymentForSettlement(tx, payment.id);
        if (!won) return { settled: false };
        const s = await settlePaidPayment(payment, tx);
        return { settled: s };
      });
      settled = result.settled;
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: newStatus },
      });
    }

    return res.json({ ok: true, data: { id: payment.id, status: newStatus, settled } } satisfies ApiResponse);
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
      return res.status(401).json({ ok: false, error: (auth as { error: string }).error } satisfies ApiResponse);
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

    let updated: { id: string; status: string };
    let settled = false;
    if (newStatus === 'paid') {
      // The status flip and the settlement run under one transaction, guarded
      // by `status: { not: 'paid' }` so two concurrent callbacks for the same
      // payment can't both win and both settle. settlePaidPayment now runs
      // against this same tx (not the module-level prisma), so a failure
      // anywhere in the settlement chain rolls the status flip back too —
      // no more partially-committed settlement rows surviving a rollback.
      const result = await prisma.$transaction(async (tx) => {
        const won = await claimPaymentForSettlement(tx, payment.id);
        const upd = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        if (!won) return { upd, settled: false };
        const s = await settlePaidPayment(payment, tx);
        return { upd, settled: s };
      });
      updated = result.upd;
      settled = result.settled;
    } else {
      updated = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: newStatus },
      });
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
export { settlePaidPayment, claimPaymentForSettlement };
