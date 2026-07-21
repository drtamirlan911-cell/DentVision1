/**
 * Subscription expiry cron — notify clinic owners at 14 / 7 / 1 days,
 * mark expired subscriptions, soft-suspend clinics.
 */
import prisma from '../lib/prisma.js';
import { uid } from '../lib/helpers.js';
import { notifyClinicOwners } from '../modules/billing/clinicSubscription.service.js';

const WINDOWS = [14, 7, 1] as const;

export interface SubscriptionCronResult {
  scanned: number;
  notified: number;
  expired: number;
  skipped: number;
  errors: number;
  details: Array<{ clinicId: string; action: string; daysLeft?: number; error?: string }>;
}

function reminderKey(clinicId: string, days: number, periodEnd: Date): string {
  return `sub_expire_${days}d_${clinicId}_${periodEnd.toISOString().slice(0, 10)}`;
}

function expiredKey(clinicId: string, periodEnd: Date): string {
  return `sub_expired_${clinicId}_${periodEnd.toISOString().slice(0, 10)}`;
}

async function alreadySent(clinicId: string, key: string): Promise<boolean> {
  const row = await prisma.reminderLog.findFirst({
    where: { clinicId, reminderKey: key },
    select: { id: true },
  });
  return !!row;
}

async function markSent(clinicId: string, key: string, meta?: Record<string, unknown>) {
  await prisma.reminderLog.create({
    data: {
      id: uid(),
      clinicId,
      reminderKey: key,
      channel: 'in_app',
      meta: (meta || {}) as object,
    },
  });
}

export async function runSubscriptionCron(): Promise<SubscriptionCronResult> {
  const now = new Date();
  const in15d = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const result: SubscriptionCronResult = {
    scanned: 0,
    notified: 0,
    expired: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  // Active / trialing with periodEnd in the next 15 days OR already past
  const subs = await prisma.subscription.findMany({
    where: {
      ownerType: 'CLINIC',
      status: { in: ['active', 'trialing'] },
      periodEnd: { not: null, lte: in15d },
    },
    take: 500,
  });
  result.scanned = subs.length;

  for (const sub of subs) {
    const periodEnd = sub.periodEnd!;
    const clinicId = sub.ownerId;
    try {
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, active: true },
      });
      if (!clinic) {
        result.skipped += 1;
        continue;
      }

      // Expired
      if (periodEnd.getTime() < now.getTime()) {
        const key = expiredKey(clinicId, periodEnd);
        if (await alreadySent(clinicId, key)) {
          result.skipped += 1;
          continue;
        }

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'expired' },
        });
        await prisma.clinic.update({
          where: { id: clinicId },
          data: { active: false },
        });

        const count = await notifyClinicOwners(
          clinicId,
          'Подписка истекла',
          `Подписка клиники «${clinic.name}» истекла. Выберите тариф и оплатите, чтобы продолжить работу.`,
        );
        await markSent(clinicId, key, { notifications: count });
        result.expired += 1;
        result.notified += count;
        result.details.push({ clinicId, action: 'expired' });
        continue;
      }

      // Upcoming windows 14 / 7 / 1 (by whole days remaining)
      const daysLeft = Math.ceil((periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (!(WINDOWS as readonly number[]).includes(daysLeft)) {
        result.skipped += 1;
        continue;
      }

      const key = reminderKey(clinicId, daysLeft, periodEnd);
      if (await alreadySent(clinicId, key)) {
        result.skipped += 1;
        continue;
      }

      const trialLabel = sub.status === 'trialing' ? 'Пробный период' : 'Подписка';
      const title =
        daysLeft === 1
          ? `${trialLabel}: остался 1 день`
          : `${trialLabel}: осталось ${daysLeft} дней`;
      const message =
        `Клиника «${clinic.name}» — срок до ${periodEnd.toISOString().slice(0, 10)}. ` +
        `Выберите тариф и оплатите в разделе «Тариф и оплата».`;

      const count = await notifyClinicOwners(clinicId, title, message);
      await markSent(clinicId, key, { daysLeft, notifications: count });
      result.notified += count;
      result.details.push({ clinicId, action: `notify_${daysLeft}d`, daysLeft });
    } catch (err: any) {
      result.errors += 1;
      result.details.push({ clinicId, action: 'error', error: err?.message || String(err) });
      console.error('[subscriptionCron]', clinicId, err);
    }
  }

  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startSubscriptionCronInterval(ms = 15 * 60 * 1000): void {
  if (timer) clearInterval(timer);
  console.log(`[subscriptionCron] started, interval=${ms}ms`);
  // Run once shortly after boot, then on interval
  setTimeout(() => {
    runSubscriptionCron().catch((e) => console.error('[subscriptionCron] boot run failed', e));
  }, 20_000);
  timer = setInterval(() => {
    runSubscriptionCron().catch((e) => console.error('[subscriptionCron] interval failed', e));
  }, ms);
}
