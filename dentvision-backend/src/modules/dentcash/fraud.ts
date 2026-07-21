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

/** Simple velocity: max earn events per user per day. */
export async function exceedsEarnVelocity(userId: string, maxPerDay = 50): Promise<boolean> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const count = await prisma.dentCashLedger.count({
    where: { userId, type: 'earn', createdAt: { gte: since } },
  });
  return count >= maxPerDay;
}
