/**
 * Subscription expiry cron — notify clinic owners at 14 / 7 / 1 days,
 * mark expired subscriptions, soft-suspend clinics.
 */
import prisma from '../lib/prisma.js';
import { withJobLock } from '../lib/jobLock.js';
import { uid } from '../lib/helpers.js';
import { tengeToMinor } from '../lib/money.js';
import { notifyClinicOwners, CLINIC_SAAS_PLANS } from '../modules/billing/clinicSubscription.service.js';
import { providers } from '../modules/payments/kaspi.provider.js';

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

async function initiateRenewal(clinicId: string, sub: { id: string; plan?: string; periodEnd?: Date }): Promise<void> {
  // NOTE: the subscription row exposes the SaaS plan as `plan` (not `planId`).
  const plan = CLINIC_SAAS_PLANS.find(p => p.id === sub.plan);
  if (!plan || plan.priceTenge === 0) return;

  const periodKey = sub.periodEnd ? new Date(sub.periodEnd).toISOString().slice(0, 10) : 'na';
  const renewalKey = `renewal_${sub.id}_${periodKey}`;

  // Idempotency: skip if a renewal payment for this exact period already exists.
  const existingPayment = await prisma.payment.findFirst({
    where: {
      refType: 'subscription',
      refId: clinicId,
      status: { in: ['pending', 'paid'] },
      meta: { path: ['renewalKey'], equals: renewalKey },
    },
    select: { id: true },
  }).catch(() => null);
  if (existingPayment) return;

  const amountMinor = tengeToMinor(plan.priceTenge);

  // Create a real Kaspi payment so the owner can pay in one tap. The authenticated
  // Kaspi callback (/api/payments/callbacks/kaspi) then activates & extends the
  // subscription automatically via activateClinicSubscriptionFromPayment.
  try {
    const created = await providers.kaspi_qr.createPayment({ amountMinor, refId: clinicId });
    await prisma.payment.create({
      data: {
        provider: 'kaspi_qr',
        externalId: created.externalId,
        amount: amountMinor,
        status: 'pending',
        refType: 'subscription',
        refId: clinicId,
        domain: 'saas',
        meta: { qr: created.qr, saasPlan: plan.id, months: 1, clinicId, renewalKey, auto: true },
      },
    });
  } catch (e) {
    console.error('[subscriptionCron] renewal createPayment failed', clinicId, e);
    // Fallback: keep a plain invoice record so the renewal is still tracked.
    await prisma.invoice.create({
      data: {
        id: uid(),
        clinicId,
        amount: Number(amountMinor),
        status: 'pending',
        items: [{ name: plan.name, price: plan.priceTenge, qty: 1 }],
        notes: renewalKey,
      },
    }).catch(() => null);
  }

  await notifyClinicOwners(
    clinicId,
    `Продление подписки ${plan.name}`,
    `Готов счёт на ${plan.priceTenge.toLocaleString('ru')} ₸. Оплатите в разделе «Тариф и оплата» — подписка продлится автоматически после оплаты.`,
    '/crm/billing',
  );
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
  }).catch((err: any) => {
    if (String(err?.code) === 'P2021') return [];
    throw err;
  });
  result.scanned = subs.length;

  for (const sub of subs) {
    const periodEnd = sub.periodEnd!;
    const clinicId = sub.ownerId;
    try {
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, active: true },
      }).catch((err: any) => {
        if (String(err?.code) === 'P2021') return null;
        throw err;
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
        }).catch((err: any) => {
          if (String(err?.code) !== 'P2021') throw err;
        });
        await prisma.clinic.update({
          where: { id: clinicId },
          data: { active: false },
        }).catch((err: any) => {
          if (String(err?.code) !== 'P2021') throw err;
        });

        const count = await notifyClinicOwners(
          clinicId,
          'Подписка истекла',
          `Подписка клиники "${clinic.name}" истекла. Доступ заблокирован, пока не будет оплачен новый период.`,
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

      if (daysLeft === 14) {
        await initiateRenewal(clinicId, sub as any).catch((err) =>
          console.error('[subscriptionCron] initiateRenewal failed', clinicId, err),
        );
      }

      const trialLabel = sub.status === 'trialing' ? 'Пробный период' : 'Подписка';
      const title =
        daysLeft === 1
          ? `${trialLabel}: остался 1 день`
          : `${trialLabel}: осталось ${daysLeft} дней`;
      const message =
        `Подписка клиники "${clinic.name}" истекает ${periodEnd.toISOString().slice(0, 10)}. ` +
        `Пожалуйста, продлите подписку, чтобы избежать блокировки доступа.`;

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
    withJobLock('subscription_cron', runSubscriptionCron).catch((e) => console.error('[subscriptionCron] boot run failed', e));
  }, 20_000);
  timer = setInterval(() => {
    withJobLock('subscription_cron', runSubscriptionCron).catch((e) => console.error('[subscriptionCron] interval failed', e));
  }, ms);
}





