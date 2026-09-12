/**
 * Diagnostics platform-commission settlement.
 *
 * Patients pay the diagnostic center / lab directly; the platform accrues its
 * commission per referral. Commission is resolved from the canonical Partner
 * Economics Engine at settlement time, so legacy/stale Referral.platformFee
 * values cannot override the current versioned business rules.
 *
 * Linking (`Referral.settlementId`) is the idempotency guard: a fee is included
 * in at most one settlement, and re-running generation never double-counts.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { tengeToMinor } from '../../lib/money.js';
import { providers } from '../payments/kaspi.provider.js';
import {
  calculatePartnerEconomics,
  getPartnerEconomicsRule,
  recordPartnerEconomics,
  PARTNER_VERTICALS,
} from '../finance/partner-economics.service.js';

export type SettlementOwnerType = 'CENTER' | 'LAB';

export function sumPlatformFeeMinor(referrals: Array<{ platformFee?: unknown }>): bigint {
  return referrals.reduce((sum, r) => {
    const raw = r.platformFee;
    if (raw == null) return sum;
    let feeTenge: Prisma.Decimal;
    try { feeTenge = new Prisma.Decimal(String(raw).trim()); } catch { return sum; }
    if (!feeTenge.isFinite()) return sum;
    return sum + BigInt(feeTenge.mul(100).toFixed(0));
  }, 0n);
}

export function referralOwner(r: { centerId?: string | null; labId?: string | null }):
  | { ownerType: SettlementOwnerType; ownerId: string }
  | null {
  if (r.centerId) return { ownerType: 'CENTER', ownerId: r.centerId };
  if (r.labId) return { ownerType: 'LAB', ownerId: r.labId };
  return null;
}

export function referralPartnerVertical(r: { centerId?: string | null; labId?: string | null }) {
  if (r.centerId) return PARTNER_VERTICALS.DIAGNOSTIC_3D;
  if (r.labId) return PARTNER_VERTICALS.MEDICAL_ANALYSIS;
  return null;
}

export interface GenerateOptions {
  periodStart: Date;
  periodEnd: Date;
  dueDays?: number;
}

export async function generateSettlements(opts: GenerateOptions) {
  const { periodStart, periodEnd } = opts;
  const refs = await prisma.referral.findMany({
    where: { paid: true, settlementId: null, paidAt: { gte: periodStart, lt: periodEnd } },
    select: { id: true, centerId: true, labId: true, cost: true, platformFee: true },
  });
  const groups = new Map<string, { ownerType: SettlementOwnerType; ownerId: string; ids: string[]; refs: { platformFee: unknown }[] }>();
  for (const r of refs) {
    const owner = referralOwner(r);
    const vertical = referralPartnerVertical(r);
    if (!owner || !vertical) continue;
    // Never seed settlement arithmetic from Referral.platformFee. That field is
    // legacy mutable state; the canonical engine is the only source of truth.
    let platformFee: Prisma.Decimal | null = null;
    if (r.cost != null) {
      const grossMinor = tengeToMinor(Number(r.cost) || 0);
      if (grossMinor > 0n) {
        const rule = await getPartnerEconomicsRule(vertical);
        const breakdown = calculatePartnerEconomics({ vertical, partnerId: owner.ownerId, grossMinor }, rule);
        platformFee = new Prisma.Decimal(breakdown.commissionMinor.toString()).div(100);
      }
    }
    const key = `${owner.ownerType}:${owner.ownerId}`;
    let g = groups.get(key);
    if (!g) { g = { ownerType: owner.ownerType, ownerId: owner.ownerId, ids: [], refs: [] }; groups.set(key, g); }
    if (platformFee != null) {
      g.ids.push(r.id);
      g.refs.push({ platformFee });
    }
  }
  const dueDate = opts.dueDays ? new Date(Date.now() + opts.dueDays * 86_400_000) : null;
  const created: Array<Awaited<ReturnType<typeof prisma.settlement.create>>> = [];
  for (const g of groups.values()) {
    const commissionMinor = sumPlatformFeeMinor(g.refs);
    if (commissionMinor <= 0n) continue;
    const settlement = await prisma.$transaction(async (tx) => {
      const s = await tx.settlement.create({ data: { ownerType: g.ownerType, ownerId: g.ownerId, periodStart, periodEnd, referralCount: g.ids.length, commissionMinor, status: 'open', dueDate } });
      const linked = await tx.referral.updateMany({ where: { id: { in: g.ids }, settlementId: null }, data: { settlementId: s.id } });
      if (linked.count !== g.ids.length) {
        const actual = await tx.referral.findMany({ where: { settlementId: s.id }, select: { platformFee: true } });
        await tx.settlement.update({ where: { id: s.id }, data: { referralCount: actual.length, commissionMinor: sumPlatformFeeMinor(actual) } });
      }
      const settledRefs = await tx.referral.findMany({ where: { settlementId: s.id }, select: { id: true, centerId: true, labId: true, cost: true } });
      for (const r of settledRefs) {
        const owner = referralOwner(r); const vertical = referralPartnerVertical(r);
        if (!owner || !vertical || r.cost == null) continue;
        await recordPartnerEconomics({ vertical, partnerId: owner.ownerId, grossMinor: tengeToMinor(Number(r.cost) || 0), operationId: r.id }, tx);
      }
      return s;
    });
    if (settlement.referralCount === 0) { await prisma.settlement.delete({ where: { id: settlement.id } }).catch(() => undefined); continue; }
    created.push(settlement);
  }
  return created;
}

export async function listSettlements(filter: { ownerType?: SettlementOwnerType; ownerId?: string; status?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filter.ownerType) where.ownerType = filter.ownerType;
  if (filter.ownerId) where.ownerId = filter.ownerId;
  if (filter.status) where.status = filter.status;
  return prisma.settlement.findMany({ where, orderBy: { createdAt: 'desc' } });
}

export async function userOwnsSettlement(userId: string, ownerType: string, ownerId: string): Promise<boolean> {
  if (ownerType === 'CENTER') return !!(await prisma.diagnosticCenterMember.findFirst({ where: { centerId: ownerId, userId } }));
  if (ownerType === 'LAB') return !!(await prisma.laboratoryMember.findFirst({ where: { labId: ownerId, userId } }));
  return false;
}

/**
 * Create (or reuse) a Kaspi pay-link for a settlement.
 *
 * `IdempotencyRecord` is the reservation boundary. The unique key is claimed
 * before the network call, so two concurrent requests cannot both create a
 * gateway payment. A winning request stores the durable Payment id; a request
 * that loses the reservation re-reads it and reuses the completed payment.
 */
export async function paySettlement(settlementId: string) {
  const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
  if (!settlement) { const err = new Error('Расчёт не найден'); (err as any).status = 404; throw err; }
  if (settlement.status === 'paid') return { settlement, payment: null, alreadyPaid: true as const };
  if (settlement.commissionMinor <= 0n) { const err = new Error('Нулевая сумма расчёта'); (err as any).status = 400; throw err; }

  const idempotencyKey = `settlement-payment:${settlementId}`;
  const existing = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
  if (existing && existing.expiresAt > new Date()) {
    if (existing.paymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: existing.paymentId } });
      if (payment) return { settlement, payment, alreadyPaid: false as const, qr: (payment.meta as any)?.qr };
    }
    const pending = await prisma.payment.findFirst({ where: { refType: 'settlement', refId: settlementId, status: 'pending' } });
    if (pending) return { settlement, payment: pending, alreadyPaid: false as const, qr: (pending.meta as any)?.qr };
    const err = new Error('Платёж для расчёта уже создаётся');
    (err as any).status = 409;
    throw err;
  }

  // An expired reservation without a durable payment is reclaimable. Do not
  // blindly insert the same unique key: remove only the stale empty record,
  // then claim a fresh five-minute reservation. A paymentId always wins even
  // when the TTL elapsed, because it is durable evidence that the gateway call
  // already completed.
  if (existing) {
    if (existing.paymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: existing.paymentId } });
      if (payment) return { settlement, payment, alreadyPaid: false as const, qr: (payment.meta as any)?.qr };
    }
    await prisma.idempotencyRecord.deleteMany({ where: { id: existing.id, paymentId: null } });
  }

  let reservation;
  try {
    reservation = await prisma.idempotencyRecord.create({
      data: { key: idempotencyKey, expiresAt: new Date(Date.now() + 5 * 60_000) },
    });
  } catch {
    const raced = await prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
    if (raced?.paymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: raced.paymentId } });
      if (payment) return { settlement, payment, alreadyPaid: false as const, qr: (payment.meta as any)?.qr };
    }
    const pending = await prisma.payment.findFirst({ where: { refType: 'settlement', refId: settlementId, status: 'pending' } });
    if (pending) return { settlement, payment: pending, alreadyPaid: false as const, qr: (pending.meta as any)?.qr };
    const err = new Error('Платёж для расчёта уже создаётся');
    (err as any).status = 409;
    throw err;
  }

  const gateway = providers.kaspi_qr;
  try {
    const created = await gateway.createPayment({ amountMinor: settlement.commissionMinor, refId: settlementId });
    const payment = await prisma.payment.create({
      data: {
        provider: 'kaspi_qr', externalId: created.externalId, amount: settlement.commissionMinor, status: 'pending',
        refType: 'settlement', refId: settlementId, domain: 'diagnostics',
        meta: { qr: created.qr, ownerType: settlement.ownerType, ownerId: settlement.ownerId, settlementId },
      },
    });
    await prisma.settlement.update({ where: { id: settlementId }, data: { status: 'invoiced', paymentId: payment.id } });
    await prisma.idempotencyRecord.update({ where: { id: reservation.id }, data: { paymentId: payment.id } });
    return { settlement, payment, alreadyPaid: false as const, qr: created.qr };
  } catch (error) {
    await prisma.idempotencyRecord.delete({ where: { id: reservation.id } }).catch(() => undefined);
    throw error;
  }
}

export async function markSettlementPaid(
  settlementId: string,
  paymentId?: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<boolean> {
  const res = await db.settlement.updateMany({
    where: { id: settlementId, status: { not: 'paid' } },
    data: { status: 'paid', paidAt: new Date(), ...(paymentId ? { paymentId } : {}) },
  });
  return res.count === 1;
}
