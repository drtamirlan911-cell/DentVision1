import { Router } from 'express';
import type { Prisma, WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import { serializeBigInt, tengeToMinor, parseTengeToMinor } from '../../lib/money.js';
import { recordSaleTx } from '../finance/finance.service.js';
import { writeRevenue } from '../finance/revenue.service.js';
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
import { assertClinicOrgAccess, assertOrgAccess, resolveClinicAccess, resolveClinicAccess as resolveClinicMemberAccess, resolveOrganizationIdForClinic } from '../../lib/orgContext.js';
import { permissionsSatisfy } from '../../lib/permissions.js';
import { resolveUserPermissions } from '../../lib/resolvePermissions.js';
import { assertClinicBillingAccess, getClinicSubscriptionAmountMinor, isSaasPlanId } from '../billing/clinicSubscription.service.js';
import { canTransitionOrder } from '../../lib/orderStatus.js';
import { auditFromReq, writeAuditLog } from '../compliance/audit.service.js';
import { reserveIdempotencyKey, completeIdempotencyKey, deleteIdempotencyKey } from '../../lib/idempotency.js';

// Payments (Phase 5). Payment gateway + Kaspi QR with authenticated callback.
export const paymentsRouter = Router();

const SERVER_OWNED_PAYMENT_META_KEYS = new Set([
  'userid', 'clinicid', 'merchantscope', 'clinicpaymode', 'qr',
]);

function clientSafePaymentMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => {
      const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
      return !SERVER_OWNED_PAYMENT_META_KEYS.has(normalized);
    }),
  );
}

async function medicalLabOrderAmountMinor(
  orderId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ clinicId: string; labId: string; amountMinor: bigint; branchId: string | null } | null> {
  const orders = await db.$queryRawUnsafe<Array<{ clinicId: string; labId: string | null; branchId: string | null }>>(
    `SELECT "clinicId", "labId", (SELECT "branchId" FROM "patients" p WHERE p."id"=o."patientId") AS "branchId" FROM "medical_lab_orders" o WHERE o."id"=$1 LIMIT 1`,
    orderId,
  );
  const order = orders[0];
  if (!order?.clinicId || !order.labId) return null;
  const rows = await db.$queryRawUnsafe<Array<{ priceMinor: bigint | number | string | null; price: unknown }>>(
    `SELECT ot."priceMinor" AS "priceMinor", lt."price" AS "price" FROM "medical_lab_order_tests" ot LEFT JOIN "laboratory_tests" lt ON lt."id"=ot."testId" WHERE ot."orderId"=$1`,
    orderId,
  );
  let amountMinor = 0n;
  for (const row of rows) amountMinor += row.priceMinor != null ? BigInt(row.priceMinor) : tengeToMinor(Number(row.price ?? 0) || 0);
  return { clinicId: order.clinicId, labId: order.labId, amountMinor, branchId: order.branchId };
}

async function settleMedicalLabOrderPayment(
  payment: { id: string; refId: string | null; amount: bigint },
  db: Prisma.TransactionClient,
): Promise<boolean> {
  if (!payment.refId) return false;
  const order = await medicalLabOrderAmountMinor(payment.refId, db);
  if (!order || order.amountMinor <= 0n) return false;
  if (payment.amount !== order.amountMinor) {
    throw new Error(`Сумма оплаты медицинского анализа не совпадает с заказом: ожидалось ${order.amountMinor}, получено ${payment.amount}`);
  }
  const { recordPartnerEconomics } = await import('../finance/partner-economics.service.js');
  await recordPartnerEconomics({
    vertical: 'MEDICAL_ANALYSIS',
    partnerId: order.labId,
    grossMinor: order.amountMinor,
    operationId: payment.refId,
    branchId: order.branchId,
  }, db);
  return true;
}

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
  // Idempotent no-op for already-paid / non-payable states. A cancelled,
  // supplier-accepted or otherwise terminal order cannot receive this sale.
  if (order.status === 'paid' || !canTransitionOrder(order.status, 'paid')) {
    return false;
  }

  // Claim status before sale/partner ledger writes. The settlement caller
  // passes a transaction client, so this compare-and-set rolls back with them.
  const prevMeta = (order.meta && typeof order.meta === 'object' ? order.meta : {}) as Record<string, unknown>;
  const transitioned = await db.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: 'paid', paymentStatus: 'paid', meta: { ...prevMeta, paymentId: payment.id, paidAt: new Date().toISOString() } },
  });
  if (transitioned.count === 0) return false;

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

  // The payment itself is the financial source of truth. Allocate the paid
  // amount across supplier lines proportionally, then keep any residual on
  // the platform wallet. This also guarantees every paid order has a durable
  // sale transaction even when a product has no supplierId.
  if (!alreadySold && payment.amount > 0n) {
    const supplierTotalMinor = Array.from(bySupplier.values()).reduce(
      (sum, tenge) => sum + tengeToMinor(tenge),
      0n,
    );
    let allocated = 0n;
    if (supplierTotalMinor > 0n) {
      const entries = Array.from(bySupplier.entries());
      for (const [index, [supplierId, tenge]] of entries.entries()) {
        const raw = tengeToMinor(tenge);
        const share =
          index === entries.length - 1
            ? payment.amount - allocated
            : (payment.amount * raw) / supplierTotalMinor;
        if (share > 0n) {
          allocated += share;
          await recordSaleTx({
            domain: 'shop',
            sellerType: 'SUPPLIER',
            sellerId: supplierId,
            amountMinor: share,
            refType: 'order',
            refId: order.id,
          }, db);
        }
      }
    }
    const residual = payment.amount - allocated;
    if (residual > 0n) {
      await recordSaleTx({
        domain: 'shop',
        sellerType: 'PLATFORM',
        sellerId: 'system',
        amountMinor: residual,
        refType: 'order',
        refId: order.id,
      }, db);
    }
  }

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
  const expectedAmountMinor = course.price == null ? 0n : tengeToMinor(course.price);
  if (expectedAmountMinor <= 0n || payment.amount !== expectedAmountMinor) {
    throw new Error('Сумма оплаты курса не совпадает с актуальной ценой курса');
  }

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

  const sellerType = course.lecturerId ? 'LECTURER' : course.academyId ? 'ACADEMY' : null;
  const sellerId = course.lecturerId || course.academyId || null;
  if (sellerType && sellerId && payment.amount > 0n && !alreadySold) {
    await recordSaleTx(
      {
        domain: 'school',
        sellerType,
        sellerId,
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
    refId: string | null;
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

  // Course/event price must come from the canonical persisted course record.
  const courseId = meta.courseId || payment.refId || meta.productId;
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.price == null) return false;
  const expectedAmountMinor = tengeToMinor(course.price);
  if (expectedAmountMinor <= 0n || payment.amount !== expectedAmountMinor) {
    throw new Error('Сумма оплаты события Academy не совпадает с актуальной ценой');
  }

  // Lecturer-owned DB product: create enrollment + credit lecturer wallet.
  if (meta.courseId) {
    await db.schoolEnrollment.upsert({
      where: { userId_courseId: { userId: meta.userId, courseId: meta.courseId } },
      create: { id: uid(), userId: meta.userId, courseId: meta.courseId },
      update: {},
    });
  }

  if (payment.amount > 0n) {
    const course = meta.courseId ? await db.course.findUnique({ where: { id: meta.courseId }, select: { price: true, lecturerId: true, academyId: true } }) : null;
    if (course) {
      const expectedAmount = tengeToMinor(Number(course.price || 0));
      if (expectedAmount !== payment.amount) {
        throw new Error(`Сумма оплаты Academy event не совпадает с ценой курса: ожидалось ${expectedAmount}, получено ${payment.amount}`);
      }
    }
    const sellerType = (course?.lecturerId ? 'LECTURER' : course?.academyId ? 'ACADEMY' : payment.sellerType || 'PLATFORM') as WalletOwnerType;
    const sellerId = course?.lecturerId || course?.academyId || payment.sellerId || 'system';
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
    const planRaw = String(meta.saasPlan || '').toLowerCase();
    const saasPlan = (planRaw === 'pro' ? 'professional' : planRaw);
    const expectedAmountMinor = getClinicSubscriptionAmountMinor(saasPlan, meta.months ?? 1);
    if (!isSaasPlanId(saasPlan) || expectedAmountMinor === null || payment.amount !== expectedAmountMinor) {
      throw new Error('Сумма платежа подписки не совпадает с каноническим тарифом');
    }
    const { activateClinicSubscriptionFromPayment } = await import('../billing/clinicSubscription.service.js');
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
      await writeRevenue(
        { source: 'SaaS', amountMinor: payment.amount, refType: 'subscription', refId: payment.refId },
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

  if (payment.refType === 'medical_lab_order') {
    settled = (await settleMedicalLabOrderPayment(payment, db)) || settled;
  }

  if (payment.refType === 'order' || payment.refType === 'shop_order') {
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

const CLINIC_PAYMENT_STAFF_ROLES = new Set(['OWNER', 'DIRECTOR', 'ADMIN', 'MANAGER', 'CASHIER', 'SUPERADMIN']);

async function assertClinicPaymentStaffAccess(userId: string, clinicId: string): Promise<boolean> {
  if (!userId || !clinicId) return false;
  try {
    const access = await resolveClinicMemberAccess(userId, clinicId);
    return Boolean(access && CLINIC_PAYMENT_STAFF_ROLES.has(String(access.role).toUpperCase()));
  } catch {
    // Fail closed when the canonical role resolver or database is unavailable.
    return false;
  }
}

async function canManageClinicBillingMutation(user: AuthRequest['user'], clinicId: string): Promise<boolean> {
  if (!user || !clinicId) return false;
  if (user.role === 'SUPERADMIN') return true;
  if (!(await assertClinicOrgAccess(user, clinicId))) return false;
  const scopedRole = await resolveClinicAccess(user.id, clinicId);
  if (!scopedRole) return false;
  const organizationId = (await resolveOrganizationIdForClinic(clinicId)) || clinicId;
  const permissions = await resolveUserPermissions(user.id, organizationId, scopedRole.role);
  return permissionsSatisfy(new Set(permissions), 'billing.manage');
}

async function assertPaymentOwner(
  req: AuthRequest,
  payment: { provider: string; meta: unknown; refType: string | null; refId: string | null },
) {
  const meta = (payment.meta || {}) as { userId?: string; clinicId?: string; merchantScope?: string };

  // Clinic scope is derived from the immutable server-selected provider, not
  // the client-writable meta fields. This also protects historic clinic
  // records whose metadata may have been written before this validation.
  if (meta.clinicId && (payment.provider === 'clinic_kaspi' || meta.merchantScope === 'clinic' || payment.refType === 'appointment' || payment.refType === 'crm_invoice')) {
    return canManageClinicBillingMutation(req.user!, meta.clinicId);
  }

  // Orders are canonical ownership records. Historical payment metadata was
  // client-writable before the metadata hardening, so it must never override an
  // order's actual owner when reading, confirming, refunding, or replaying a
  // payment. Fail closed if the referenced order is missing or DB lookup fails.
  if (payment.refType === 'order' || payment.refType === 'shop_order') {
    if (!payment.refId) return false;
    try {
      const order = await prisma.order.findUnique({
        where: { id: payment.refId },
        select: { userId: true },
      });
      return Boolean(order && order.userId === req.user!.id);
    } catch {
      return false;
    }
  }

  if (meta.userId && meta.userId === req.user!.id) return true;
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
  if (!input.secret || input.secret.length < 32) {
    return { ok: false, error: 'Webhook secret клиники не настроен или короче 32 символов' };
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
  let keyReserved = false;
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
    // Validate the requested payment and its server-side price/ownership
    // before reserving the key. Invalid inputs must not leave a stuck in-flight
    // idempotency record. Reservation is performed just before contacting a
    // payment provider, independently in the clinic/platform branch.
    const reserveForPayment = async (): Promise<boolean> => {
      let reserved = await reserveIdempotencyKey(idempotencyKey!);
      if (reserved.status === 'exists') {
        const existingPayment = await prisma.payment.findUnique({ where: { id: reserved.resultId } });
        if (existingPayment) {
          if (!(await assertPaymentOwner(req, existingPayment))) {
            res.status(403).json({ ok: false, error: 'Нет доступа к существующему платежу' } satisfies ApiResponse);
          } else {
            res.status(200).json({ ok: true, data: serializeBigInt(existingPayment) } satisfies ApiResponse);
          }
          return false;
        }
        // Stale key to a deleted payment: release and race-safely reserve again.
        await deleteIdempotencyKey(idempotencyKey!);
        reserved = await reserveIdempotencyKey(idempotencyKey!);
      }
      if (reserved.status === 'in_flight') {
        res.status(409).json({
          ok: false,
          error: 'Запрос уже обрабатывается, повторите позже',
        } satisfies ApiResponse);
        return false;
      }
      if (reserved.status !== 'reserved') {
        res.status(409).json({ ok: false, error: 'Не удалось зарезервировать ключ идемпотентности' } satisfies ApiResponse);
        return false;
      }
      keyReserved = true;
      return true;
    };

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

    // These are internal ledger operations, not buyer-selectable payment
    // products. "sale" would let a caller choose the credited seller/domain,
    // while "settlement" must be created only by paySettlement(), which derives
    // the exact due amount and authorized owner from the persisted settlement.
    // Reject before reserving idempotency or contacting any payment provider.
    if (refType === 'sale' || refType === 'settlement') {
      return res.status(400).json({
        ok: false,
        error: 'Этот тип платежа создаётся только внутренним финансовым процессом',
      } satisfies ApiResponse);
    }

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
      const ref = await prisma.order.findUnique({
        where: { id: refId },
        select: { total: true, status: true },
      });
      if (!ref) {
        return res.status(404).json({ ok: false, error: 'Ссылка на заказ не найдена' } satisfies ApiResponse);
      }
      if (ref.status === 'paid' || !canTransitionOrder(ref.status, 'paid')) {
        return res.status(409).json({
          ok: false,
          error: 'Заказ больше не принимает оплату в текущем статусе',
        } satisfies ApiResponse);
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

    if (refType === 'medical_lab_order' && refId) {
      const medicalOrder = await medicalLabOrderAmountMinor(refId);
      if (!medicalOrder) return res.status(404).json({ ok: false, error: 'Медицинский лабораторный заказ не найден или не назначен лаборатории' } satisfies ApiResponse);
      if (!(await assertClinicOrgAccess(req.user!, medicalOrder.clinicId))) return res.status(403).json({ ok: false, error: 'Нет доступа к этому медицинскому заказу' } satisfies ApiResponse);
      if (medicalOrder.amountMinor <= 0n) return res.status(400).json({ ok: false, error: 'В медицинском заказе отсутствуют оплачиваемые анализы' } satisfies ApiResponse);
      if (medicalOrder.amountMinor !== minor) return res.status(409).json({ ok: false, error: `Сумма не совпадает с медицинским заказом: ожидалось ${medicalOrder.amountMinor}, получено ${minor}` } satisfies ApiResponse);
    }

    const metaObj = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    let trustedMeta: Record<string, unknown> = clientSafePaymentMeta(metaObj);
    let trustedSellerType: string | null | undefined = sellerType;
    let trustedSellerId: string | null | undefined = sellerId;
    let trustedDomain: string | null | undefined = domain;

    // Payment amount, entitlement and seller details for billable platform
    // references are derived from canonical DB/config data before creating a QR.
    if (refType === 'subscription') {
      if (!refId) return res.status(400).json({ ok: false, error: 'clinicId/refId обязателен для подписки' } satisfies ApiResponse);
      try {
        await assertClinicBillingAccess(req.user!.id, String(refId));
      } catch (error: any) {
        return res.status(error?.status || 403).json({ ok: false, error: 'Нет прав на оплату подписки этой клиники' } satisfies ApiResponse);
      }
      const planRaw = String(metaObj.saasPlan || '').toLowerCase();
      const saasPlan = planRaw === 'pro' ? 'professional' : planRaw;
      const months = metaObj.months === undefined ? 1 : metaObj.months;
      const expectedMinor = getClinicSubscriptionAmountMinor(saasPlan, months);
      if (expectedMinor === null) {
        return res.status(400).json({ ok: false, error: 'Некорректный тариф или срок подписки' } satisfies ApiResponse);
      }
      if (minor !== expectedMinor) {
        return res.status(409).json({ ok: false, error: 'Сумма не совпадает с тарифом и сроком подписки' } satisfies ApiResponse);
      }
      trustedMeta = { ...trustedMeta, saasPlan, months, clinicId: String(refId), userId: req.user!.id };
      trustedSellerType = null;
      trustedSellerId = null;
      trustedDomain = 'saas';
    }

    if (refType === 'enrollment' || refType === 'academy_event') {
      const requestedCourseId = String(
        refType === 'enrollment'
          ? refId || ''
          : metaObj.courseId || refId || metaObj.productId || '',
      ).trim();
      if (!requestedCourseId) return res.status(400).json({ ok: false, error: 'ID курса или события обязателен' } satisfies ApiResponse);
      const course = await prisma.course.findUnique({
        where: { id: requestedCourseId },
        select: { id: true, price: true, lecturerId: true, academyId: true },
      });
      if (!course) return res.status(404).json({ ok: false, error: 'Курс или событие Academy не найдено' } satisfies ApiResponse);
      const expectedMinor = course.price == null ? 0n : tengeToMinor(course.price);
      if (expectedMinor <= 0n) return res.status(409).json({ ok: false, error: 'Для бесплатного курса не требуется платёж' } satisfies ApiResponse);
      if (minor !== expectedMinor) {
        return res.status(409).json({ ok: false, error: 'Сумма не совпадает с актуальной ценой Academy' } satisfies ApiResponse);
      }
      trustedMeta = {
        ...trustedMeta,
        userId: req.user!.id,
        ...(refType === 'enrollment' ? { courseId: course.id } : { productId: course.id }),
        ...(metaObj.courseId ? { courseId: course.id } : {}),
      };
      trustedSellerType = course.lecturerId ? 'LECTURER' : 'PLATFORM';
      trustedSellerId = course.lecturerId || 'system';
      trustedDomain = 'school';
    }

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
    // Platform-owned references always use the platform merchant. A client
    // cannot reroute SaaS, Academy, Shop or medical-lab payments by setting
    // domain=crm, clinicId or merchantScope in the request.
    const platformRefTypes = new Set([
      'subscription', 'enrollment', 'academy_event', 'order', 'shop_order',
      'medical_lab_order',
    ]);
    const isClinicCashier = !platformRefTypes.has(String(refType || '')) &&
      (domain === 'crm' || refType === 'appointment' || refType === 'crm_invoice');

    // CRM cashier → clinic's own Kaspi/bank (never platform merchant).
    if (isClinicCashier) {
      if (!clinicId) {
        return res.status(400).json({
          ok: false,
          error: 'clinicId обязателен для оплаты на кассе клиники',
        } satisfies ApiResponse);
      }
      if (!(await assertClinicPaymentStaffAccess(req.user!.id, clinicId))) {
        return res.status(403).json({ ok: false, error: 'Нет доступа к кассе этой клиники' } satisfies ApiResponse);
      }

      // A referenced clinical object must belong to this exact clinic. A valid
      // cashier role alone must not allow cross-clinic payment via a substituted refId.
      if (refType === 'appointment' && refId) {
        const appointment = await prisma.appointment.findFirst({
          where: { id: String(refId), clinicId },
          select: { id: true, clinicId: true },
        });
        if (!appointment) {
          return res.status(404).json({ ok: false, error: 'Приём не найден в выбранной клинике' } satisfies ApiResponse);
        }
      }

      // Invoice balances are stored in whole KZT, payments in minor units.
      // Permit partial payments, but never collect above the canonical balance.
      if ((refType === 'crm_invoice' || (!refType && domain === 'crm')) && refId) {
        const invoice = await prisma.invoice.findFirst({
          where: { id: String(refId), clinicId, deletedAt: null },
          select: { id: true, clinicId: true, amount: true, paidAmount: true, status: true },
        });
        if (!invoice) {
          return res.status(404).json({ ok: false, error: 'Счёт не найден в выбранной клинике' } satisfies ApiResponse);
        }
        const outstandingTenge = Math.max(0, Number(invoice.amount) - Number(invoice.paidAmount || 0));
        const outstandingMinor = tengeToMinor(outstandingTenge);
        if (invoice.status === 'paid' || outstandingMinor <= 0n) {
          return res.status(409).json({ ok: false, error: 'Счёт уже оплачен' } satisfies ApiResponse);
        }
        if (minor % 100n !== 0n) {
          return res.status(400).json({ ok: false, error: 'Сумма оплаты счёта должна быть в целых тенге' } satisfies ApiResponse);
        }
        if (minor > outstandingMinor) {
          return res.status(409).json({ ok: false, error: 'Сумма превышает остаток по счёту' } satisfies ApiResponse);
        }
      }

      if (!(await reserveForPayment())) return;

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
            ...trustedMeta,
            // Server-owned payment identity/scope must be written last.
            qr: created.qr,
            userId: req.user!.id,
            clinicId,
            merchantScope: 'clinic',
            clinicPayMode: created.mode,
          },
        },
      });

      await completeIdempotencyKey(idempotencyKey, payment.id);
      keyCompleted = true;

      await auditFromReq(req, {
        action: 'payment.created',
        entity: 'payment',
        entityId: payment.id,
        details: { clinicId, refType: refType || 'crm_invoice', amountMinor: String(minor) },
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

    if (!(await reserveForPayment())) return;

    const created = await gateway.createPayment({ amountMinor: minor, refId });
    const payment = await prisma.payment.create({
      data: {
        provider,
        externalId: created.externalId,
        amount: minor,
        status: 'pending',
        refType: refType || null,
        refId: refId || null,
        domain: trustedDomain || null,
        sellerType: trustedSellerType || null,
        sellerId: trustedSellerId || null,
        meta: {
          ...trustedMeta,
          // Client metadata cannot override the authenticated payer or scope.
          qr: created.qr,
          userId: req.user!.id,
          merchantScope: 'platform',
        },
      },
    });

    await completeIdempotencyKey(idempotencyKey, payment.id);
    keyCompleted = true;

    await auditFromReq(req, {
      action: 'payment.created',
      entity: 'payment',
      entityId: payment.id,
      details: { domain: domain || null, refType: refType || null, amountMinor: String(minor) },
    });

    return res.status(201).json({
      ok: true,
      data: withPaymentQr(serializeBigInt(payment) as Record<string, unknown>, created.qr),
    } satisfies ApiResponse);
  } catch (error: any) {
    // Free a reserved-but-unfinished key so a retry can succeed instead of
    // hitting a permanent 409 (audit F-3).
    if (idempotencyKey && keyReserved && !keyCompleted) {
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

paymentsRouter.post('/:id/refund', authenticate, async (req: AuthRequest, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id as string } });
    if (!payment) return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);

    if (!(await assertPaymentOwner(req, payment))) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к платежу' } satisfies ApiResponse);
    }

    const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
    if (!idempotencyKey) {
      return res.status(400).json({ ok: false, error: 'Idempotency-Key обязателен для возврата' } satisfies ApiResponse);
    }

    let amountMinor: bigint | null = null;
    if (req.body?.amountMinor !== undefined && req.body?.amountMinor !== null) {
      try { amountMinor = BigInt(req.body.amountMinor); }
      catch { return res.status(400).json({ ok: false, error: 'Некорректная сумма возврата' } satisfies ApiResponse); }
    }

    const { refundPayment, PaymentRefundError } = await import('./refund.service.js');
    const result = await refundPayment(
      payment.id,
      amountMinor,
      idempotencyKey,
      typeof req.body?.reason === 'string' ? req.body.reason : undefined,
    );

    await auditFromReq(req, {
      action: 'payment.refunded',
      entity: 'payment',
      entityId: payment.id,
      details: {
        refundId: result.refund.id,
        amountMinor: String(result.refund.amount),
        alreadyProcessed: result.alreadyProcessed,
      },
    });

    return res.status(result.alreadyProcessed ? 200 : 201).json({
      ok: true,
      data: {
        payment: serializeBigInt(result.payment),
        refund: serializeBigInt(result.refund),
        alreadyProcessed: result.alreadyProcessed,
      },
    } satisfies ApiResponse);
  } catch (error: any) {
    const { PaymentRefundError } = await import('./refund.service.js');
    if (error instanceof PaymentRefundError) {
      const status =
        error.code === 'NOT_FOUND' ? 404 :
        error.code === 'FORBIDDEN' ? 403 :
        error.code === 'ALREADY_REFUNDED' ? 409 :
        error.code === 'INVALID_AMOUNT' || error.code === 'IDEMPOTENCY_REQUIRED' ? 400 : 409;
      return res.status(status).json({ ok: false, error: error.message } satisfies ApiResponse);
    }
    console.error('Refund payment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка возврата платежа' } satisfies ApiResponse);
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
    // Payment scope is determined by the server-controlled provider, never
    // by client-writable metadata. Clinic gateway status is never consulted
    // for platform payments.
    if (payment.provider === 'clinic_kaspi' && meta.clinicId) {
      providerStatus = await getClinicGatewayStatus(meta.clinicId, payment.externalId);
    } else if (payment.provider !== 'clinic_kaspi') {
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

    const meta = (payment.meta || {}) as { clinicId?: string };
    const isClinic = payment.provider === 'clinic_kaspi';
    let clinicPayMode: 'static' | 'api' | 'unconfigured' = 'unconfigured';
    if (isClinic) {
      // The provider is server-created and is the authoritative scope marker.
      // Require the canonical clinic reference and current backend membership;
      // metadata alone never grants clinic cashier privileges.
      if (!meta.clinicId || !(await assertClinicPaymentStaffAccess(req.user!.id, meta.clinicId))) {
        return res.status(403).json({ ok: false, error: 'Нет доступа к кассе этой клиники' } satisfies ApiResponse);
      }
      // Do not trust historical clinicPayMode metadata written by old versions:
      // before this hardening it could be overridden by the creation request.
      const clinicConfig = await loadClinicPaymentsConfig(meta.clinicId);
      clinicPayMode = clinicConfig.cfg.mode;
      if (clinicPayMode !== 'static' && clinicPayMode !== 'api') {
        return res.status(409).json({ ok: false, error: 'Способ оплаты клиники не настроен; подтверждение запрещено' } satisfies ApiResponse);
      }
    }

    let providerStatus: 'pending' | 'paid' | 'failed' | 'expired' = 'pending';
    if (payment.externalId) {
      if (isClinic) {
        // Static mode is a human-confirmed clinic cash workflow. API mode must
        // receive a paid state from the configured clinic gateway.
        if (clinicPayMode === 'api' && meta.clinicId) {
          providerStatus = await getClinicGatewayStatus(meta.clinicId, payment.externalId);
        }
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

    const sandbox = env.PAYMENTS_SANDBOX === 'true' && !isClinic;
    const clinicStaffStaticConfirm = isClinic && clinicPayMode === 'static';
    const canComplete = providerStatus === 'paid' || clinicStaffStaticConfirm || (!isClinic && sandbox);

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

    if (!result.alreadyPaid) {
      // Any successful status transition must be auditable, including static
      // clinic staff confirmation when a downstream CRM workflow owns posting
      // the receipt/ledger record.
      await auditFromReq(req, {
        action: 'payment.confirmed',
        entity: 'payment',
        entityId: payment.id,
        details: {
          amountMinor: String(payment.amount),
          provider: payment.provider,
          clinicStaffConfirm: isClinic && clinicPayMode === 'static' && providerStatus !== 'paid',
          settled: result.settled,
        },
      });
    }

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
    // Platform Kaspi callbacks cannot settle clinic-merchant payments.
    if (payment.provider === 'clinic_kaspi') {
      return res.status(403).json({ ok: false, error: 'Платёж принадлежит кассе клиники' } satisfies ApiResponse);
    }
    // The callback signature contract may omit amount. If the provider sends
    // one, compare it to the immutable DB amount rather than trusting payload.
    if (req.body?.amountMinor !== undefined || req.body?.amount !== undefined) {
      let callbackAmount: bigint;
      try {
        callbackAmount = req.body.amountMinor !== undefined
          ? BigInt(req.body.amountMinor)
          : parseTengeToMinor(req.body.amount);
      } catch {
        return res.status(400).json({ ok: false, error: 'Некорректная сумма callback' } satisfies ApiResponse);
      }
      if (callbackAmount !== payment.amount) {
        return res.status(409).json({ ok: false, error: 'Сумма callback не совпадает с платёжной записью' } satisfies ApiResponse);
      }
    }

    if (payment.status === 'paid') {
      return res.json({ ok: true, data: { id: payment.id, status: payment.status, settled: false } } satisfies ApiResponse);
    }

    const newStatus = status === 'paid' ? 'paid' : status === 'failed' ? 'failed' : 'pending';
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
      // Non-paid callbacks may only transition a still-pending payment. A stale
      // failed/pending callback must never overwrite a paid or terminal state.
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: newStatus },
      });
    }

    const latestPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    const effectiveStatus = latestPayment?.status || payment.status;
    if (payment.externalId && ['pending', 'paid', 'failed', 'expired'].includes(effectiveStatus)) {
      markMockPaymentStatus(payment.externalId, effectiveStatus as 'pending' | 'paid' | 'failed' | 'expired');
    }

    await writeAuditLog({
      action: 'payment.callback_kaspi',
      entity: 'payment',
      entityId: payment.id,
      details: { requestedStatus: newStatus, effectiveStatus, settled },
    });

    return res.json({ ok: true, data: { id: payment.id, status: effectiveStatus, settled } } satisfies ApiResponse);
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
    // Static mode is explicitly manual-confirmation only. A stale webhook secret
    // must not turn a static clinic payment into an externally confirmed payment.
    if (cfg.mode !== 'api') {
      return res.status(403).json({ ok: false, error: 'Webhook разрешён только в API-режиме кассы клиники' } satisfies ApiResponse);
    }
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
    if (payment.provider !== 'clinic_kaspi') {
      return res.status(403).json({ ok: false, error: 'Платёж не принадлежит шлюзу клиники' } satisfies ApiResponse);
    }
    const pMeta = (payment.meta || {}) as { clinicId?: string };
    if (!pMeta.clinicId || pMeta.clinicId !== clinicId) {
      return res.status(403).json({ ok: false, error: 'Платёж другой клиники' } satisfies ApiResponse);
    }
    if (['subscription', 'enrollment', 'academy_event', 'order', 'shop_order', 'medical_lab_order'].includes(String(payment.refType))) {
      return res.status(403).json({ ok: false, error: 'Платежи платформы нельзя подтверждать шлюзом клиники' } satisfies ApiResponse);
    }

    // Some clinic gateways include the paid amount in their callback. If they
    // do, compare it with the immutable payment record; never settle a mismatch.
    if (req.body?.amountMinor !== undefined || req.body?.amount !== undefined) {
      let callbackAmount: bigint;
      try {
        callbackAmount = req.body.amountMinor !== undefined
          ? BigInt(req.body.amountMinor)
          : parseTengeToMinor(req.body.amount);
      } catch {
        return res.status(400).json({ ok: false, error: 'Некорректная сумма callback' } satisfies ApiResponse);
      }
      if (callbackAmount !== payment.amount) {
        return res.status(409).json({ ok: false, error: 'Сумма callback не совпадает с платёжной записью' } satisfies ApiResponse);
      }
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
      // Keep paid/failed/expired terminal states stable when callbacks arrive
      // out of order; only a pending payment may accept a non-paid transition.
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: newStatus },
      });
      const latestPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      updated = latestPayment || { id: payment.id, status: payment.status };
    }

    await writeAuditLog({
      clinicId,
      action: 'payment.callback_kaspi_clinic',
      entity: 'payment',
      entityId: payment.id,
      details: { requestedStatus: newStatus, effectiveStatus: updated.status, settled },
    });

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
