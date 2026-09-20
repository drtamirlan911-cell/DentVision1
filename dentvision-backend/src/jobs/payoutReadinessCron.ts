import { withJobLock } from '../lib/jobLock.js';
import { availableBalanceMinor } from '../modules/finance/payout.service.js';
import prisma from '../lib/prisma.js';
import { uid } from '../lib/helpers.js';

export interface PayoutReadinessCronResult {
  scanned: number;
  notified: number;
}

async function requesterIds(ownerType: string, ownerId: string): Promise<string[]> {
  if (ownerType === 'LECTURER') {
    const row = await prisma.lecturer.findUnique({ where: { id: ownerId }, select: { userId: true } });
    return row ? [row.userId] : [];
  }
  if (ownerType === 'SUPPLIER') {
    const rows = await prisma.supplierMember.findMany({ where: { supplierId: ownerId }, select: { userId: true } });
    return rows.map((row) => row.userId);
  }
  return [];
}

export async function runPayoutReadinessCron(): Promise<PayoutReadinessCronResult> {
  const wallets = await prisma.wallet.findMany({
    where: { ownerType: { in: ['LECTURER', 'SUPPLIER'] }, balance: { gt: 0n } },
    select: { id: true, ownerType: true, ownerId: true, currency: true },
    take: 500,
  });

  let notified = 0;
  for (const wallet of wallets) {
    const available = await availableBalanceMinor(wallet.id);
    if (available <= 0n) continue;

    const pending = await prisma.payout.findFirst({
      where: { walletId: wallet.id, status: { in: ['requested', 'approved'] } },
      select: { id: true },
    });
    if (pending) continue;

    const users = await requesterIds(wallet.ownerType, wallet.ownerId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const userId of users) {
      const alreadyNotified = await prisma.notification.findFirst({
        where: { userId, type: 'payout', title: 'Средства доступны к выплате', createdAt: { gte: since } },
        select: { id: true },
      });
      if (alreadyNotified) continue;
      await prisma.notification.create({
        data: {
          id: uid(),
          userId,
          type: 'payout',
          title: 'Средства доступны к выплате',
          message: `Доступно к выплате: ${(Number(available) / 100).toLocaleString('ru-RU')} ${wallet.currency}`,
        },
      });
      notified += 1;
    }
  }

  return { scanned: wallets.length, notified };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPayoutReadinessCronInterval(ms = 24 * 60 * 60 * 1000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const result = await withJobLock('payout_readiness_cron', runPayoutReadinessCron);
      if (result) console.log(`[PayoutReadiness] scanned=${result.scanned} notified=${result.notified}`);
    } catch (error) {
      console.error('[PayoutReadiness] tick failed', error);
    }
  };
  setTimeout(tick, 45_000);
  timer = setInterval(tick, ms);
  console.log(`[PayoutReadiness] interval started (${ms / 3600000}h)`);
}
