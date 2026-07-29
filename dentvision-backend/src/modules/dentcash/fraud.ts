import prisma from '../../lib/prisma.js';
import { RATE_BPS } from './rates.js';

/** Buyer must not earn cashback on their own supplier catalog. */
export async function isSelfDeal(userId: string, supplierId?: string | null): Promise<boolean> {
  if (!supplierId) return false;
  const member = await prisma.supplierMember.findUnique({
    where: { userId_supplierId: { userId, supplierId } },
  });
  return !!member;
}

export function clampRateBps(rateBps: number): number {
  return Math.max(0, Math.min(RATE_BPS.absoluteMax, Math.floor(rateBps || 0)));
}

/** Simple velocity: max distinct earn orders/payments per user per day. */
export async function exceedsEarnVelocity(userId: string, maxOrdersPerDay = 40): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const rows = await prisma.dentCashLedger.findMany({
    where: { userId, type: 'earn', createdAt: { gte: since } },
    select: { refId: true },
    distinct: ['refId'],
  });
  return rows.length >= maxOrdersPerDay;
}
