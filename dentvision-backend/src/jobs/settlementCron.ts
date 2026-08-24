/**
 * Settlement cron — once per month, roll the *previous* calendar month's paid,
 * unsettled diagnostic referrals into per-center/lab settlements, create a Kaspi
 * pay-link for each, and notify the owner's admins.
 *
 * Idempotency is inherent: `generateSettlements` only picks up referrals still
 * `settlementId = null`, so repeated runs within the month create nothing new
 * (and therefore notify no one) once the prior month has been swept.
 */
import prisma from '../lib/prisma.js';
import { withJobLock } from '../lib/jobLock.js';
import { minorToTenge } from '../lib/money.js';
import {
  generateSettlements,
  paySettlement,
  type SettlementOwnerType,
} from '../modules/diagnostics/settlement.service.js';
import { dispatchNotification } from '../modules/notifications/dispatch.service.js';

export interface SettlementCronResult {
  periodStart: string;
  periodEnd: string;
  created: number;
  notified: number;
  errors: number;
}

/** [first day of previous month, first day of current month) in UTC. */
export function priorMonthPeriod(now = new Date()): { periodStart: Date; periodEnd: Date } {
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { periodStart, periodEnd };
}

async function ownerAdminUserIds(ownerType: SettlementOwnerType, ownerId: string): Promise<string[]> {
  if (ownerType === 'CENTER') {
    const rows = await prisma.diagnosticCenterMember
      .findMany({ where: { centerId: ownerId }, select: { userId: true } })
      .catch(() => [] as { userId: string }[]);
    return rows.map((r) => r.userId);
  }
  const rows = await prisma.laboratoryMember
    .findMany({ where: { labId: ownerId }, select: { userId: true } })
    .catch(() => [] as { userId: string }[]);
  return rows.map((r) => r.userId);
}

export async function runSettlementCron(now = new Date()): Promise<SettlementCronResult> {
  const { periodStart, periodEnd } = priorMonthPeriod(now);
  const result: SettlementCronResult = {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    created: 0,
    notified: 0,
    errors: 0,
  };

  const created = await generateSettlements({ periodStart, periodEnd, dueDays: 14 }).catch((err: any) => {
    if (String(err?.code) === 'P2021') return [];
    console.error('[settlementCron] generate failed', err);
    result.errors += 1;
    return [];
  });
  result.created = created.length;

  for (const s of created) {
    try {
      // Create the pay-link so the notification can carry it (idempotent per settlement).
      await paySettlement(s.id).catch((e) => console.error('[settlementCron] pay-link failed', s.id, e));
      const amountTenge = minorToTenge(s.commissionMinor);
      const title = 'Счёт платформенной комиссии';
      const message =
        `Период ${result.periodStart} — ${result.periodEnd}: ${s.referralCount} направлений. ` +
        `К оплате ${amountTenge.toLocaleString('ru')} ₸. Оплатите в разделе «Расчёты».`;
      const admins = await ownerAdminUserIds(s.ownerType as SettlementOwnerType, s.ownerId);
      for (const userId of admins) {
        await dispatchNotification({
          userId,
          type: 'settlement',
          title,
          message,
          link: '/diagnostics/settlements',
        }).catch(() => undefined);
        result.notified += 1;
      }
    } catch (err) {
      result.errors += 1;
      console.error('[settlementCron] notify failed', s.id, err);
    }
  }

  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startSettlementCronInterval(ms = 60 * 60 * 1000): void {
  if (timer) clearInterval(timer);
  console.log(`[settlementCron] started, interval=${ms}ms`);
  // Boot run shortly after start, then on interval. Monthly generation is
  // guarded by referral linking, so a frequent interval is a cheap no-op.
  setTimeout(() => {
    withJobLock('settlement_cron', runSettlementCron).catch((e) => console.error('[settlementCron] boot run failed', e));
  }, 30_000);
  timer = setInterval(() => {
    withJobLock('settlement_cron', runSettlementCron).catch((e) => console.error('[settlementCron] interval failed', e));
  }, ms);
}
