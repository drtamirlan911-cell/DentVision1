/**
 * Clinic SaaS subscription helpers — single source of truth for plans,
 * trial bootstrap, payment activation, and expiry notifications.
 */
import type { ClinicPlan, Prisma, WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { tengeToMinor } from '../../lib/money.js';
import { resolveClinicAccess } from '../../lib/orgContext.js';

export const TRIAL_DAYS = 30;

/** Public catalog (aligned with /pricing). Amounts in KZT / month. */
export const CLINIC_SAAS_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    priceTenge: 0,
    period: 'навсегда',
    description: 'Базовый CRM для небольшой практики',
    features: ['До 100 пациентов', 'Базовое расписание', '1 пользователь', 'Без AI и аналитики'],
  },
  {
    id: 'professional',
    name: 'Professional',
    priceTenge: 49900,
    period: '/месяц',
    description: 'Полный CRM + AI + аналитика',
    features: ['Безлимит пациентов', 'До 10 пользователей', 'AI-ассистент (100 запросов/мес)', 'Аналитика'],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceTenge: 149900,
    period: '/месяц',
    description: 'Сети клиник и расширенная поддержка',
    features: ['Всё из Professional', 'Безлимит AI', 'Мульти-клиника', 'Приоритетная поддержка'],
  },
] as const;

export type SaasPlanId = (typeof CLINIC_SAAS_PLANS)[number]['id'];

const SAAS_TO_CLINIC: Record<SaasPlanId, ClinicPlan> = {
  starter: 'STANDARD',
  professional: 'PRO',
  enterprise: 'ENTERPRISE',
};

const CLINIC_TO_SAAS: Record<ClinicPlan, SaasPlanId | 'free'> = {
  // Demo must showcase AI + analytics; free gating is for real unpaid clinics.
  DEMO: 'professional',
  STANDARD: 'starter',
  PRO: 'professional',
  ENTERPRISE: 'enterprise',
};

const BILLING_ROLES = new Set(['OWNER', 'ADMIN', 'SUPERADMIN']);

export function isSaasPlanId(v: string): v is SaasPlanId {
  return CLINIC_SAAS_PLANS.some((p) => p.id === v);
}

export function getPlanCatalog() {
  return CLINIC_SAAS_PLANS.map((p) => ({
    ...p,
    amountMinor: tengeToMinor(p.priceTenge).toString(),
  }));
}

export function saasPlanToClinicPlan(plan: SaasPlanId): ClinicPlan {
  return SAAS_TO_CLINIC[plan];
}

export function clinicPlanToSaas(plan: ClinicPlan): string {
  return CLINIC_TO_SAAS[plan] || 'free';
}

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function daysUntil(date: Date | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Resolve user's role within a clinic — delegates to the shared unified
 * resolver (`orgContext.resolveClinicAccess`: Person/PersonRole first, legacy
 * ClinicMember fallback, SUPERADMIN pass-through), so this module no longer
 * carries its own copy of the unified-role→legacy-role map. Kept non-fatal on
 * DB errors, matching the previous behavior, so a transient failure here
 * falls through to the caller's own SUPERADMIN/403 fallback instead of
 * throwing a 500 out of a billing-access check.
 */
async function resolveClinicRole(userId: string, clinicId: string) {
  try {
    const access = await resolveClinicAccess(userId, clinicId);
    if (access) return { source: 'unified' as const, role: access.role };
  } catch (e: any) {
    console.warn('[clinic-billing] resolveClinicAccess failed (non-fatal):', e?.message);
  }
  return null;
}

/** Any clinic member may read access/usage snapshot (for banners & soft locks). */
export async function assertClinicMemberAccess(userId: string, clinicId: string) {
  if (!clinicId) {
    const err = new Error('Выберите клинику');
    (err as any).status = 400;
    throw err;
  }
  const resolved = await resolveClinicRole(userId, clinicId);
  if (resolved) return resolved;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'SUPERADMIN') return { source: 'superadmin' as const, role: 'SUPERADMIN' as const };
  const err = new Error('Нет доступа к клинике');
  (err as any).status = 403;
  throw err;
}

/** OWNER/ADMIN may change plan / checkout. */
export async function assertClinicBillingAccess(userId: string, clinicId: string) {
  if (!clinicId) {
    const err = new Error('Выберите клинику');
    (err as any).status = 400;
    throw err;
  }
  const resolved = await resolveClinicRole(userId, clinicId);
  if (resolved && BILLING_ROLES.has(resolved.role as any)) return resolved;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'SUPERADMIN') return { source: 'superadmin' as const, role: 'SUPERADMIN' as const };
  const err = new Error('Недостаточно прав для управления подпиской');
  (err as any).status = 403;
  throw err;
}

/** Bootstrap Enterprise trial for a newly created clinic. */
export async function startClinicTrial(clinicId: string, days = TRIAL_DAYS) {
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + days);

  await prisma.clinic.update({
    where: { id: clinicId },
    data: { plan: 'ENTERPRISE', active: true },
  });

  return prisma.subscription.upsert({
    where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
    create: {
      ownerType: 'CLINIC',
      ownerId: clinicId,
      plan: 'enterprise',
      status: 'trialing',
      periodEnd,
    },
    update: {
      plan: 'enterprise',
      status: 'trialing',
      periodEnd,
    },
  });
}

export async function upsertClinicSubscription(
  opts: {
    clinicId: string;
    saasPlan: string;
    clinicPlan: ClinicPlan;
    status: string;
    periodEnd: Date | null;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const { clinicId, saasPlan, clinicPlan, status, periodEnd } = opts;
  // Explicit sequential calls on `db` rather than the batch `prisma.$transaction([...])`
  // form — the batch form always opens its own transaction, which Prisma does
  // not allow nesting inside a caller's already-open interactive transaction.
  const clinic = await db.clinic.update({
    where: { id: clinicId },
    data: { plan: clinicPlan, active: status !== 'expired' && status !== 'suspended' },
  });
  const subscription = await db.subscription.upsert({
    where: { ownerType_ownerId: { ownerType: 'CLINIC' as WalletOwnerType, ownerId: clinicId } },
    create: {
      ownerType: 'CLINIC',
      ownerId: clinicId,
      plan: saasPlan,
      status,
      periodEnd,
    },
    update: { plan: saasPlan, status, periodEnd },
  });
  return { clinic, subscription };
}

/** Activate / renew after successful payment. */
export async function activateClinicSubscriptionFromPayment(
  opts: {
    clinicId: string;
    saasPlan: SaasPlanId;
    months?: number;
    paymentId?: string;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const months = Math.min(Math.max(opts.months || 1, 1), 24);
  const clinicPlan = saasPlanToClinicPlan(opts.saasPlan);
  const existing = await db.subscription.findUnique({
    where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: opts.clinicId } },
  });

  let periodEnd: Date | null = null;
  if (opts.saasPlan === 'starter') {
    periodEnd = null; // free forever
  } else {
    const now = new Date();
    const base =
      existing?.periodEnd && existing.periodEnd > now ? existing.periodEnd : now;
    periodEnd = addMonths(base, months);
  }

  const result = await upsertClinicSubscription(
    {
      clinicId: opts.clinicId,
      saasPlan: opts.saasPlan,
      clinicPlan,
      status: 'active',
      periodEnd,
    },
    db,
  );

  // Notify owners/admins (batched in-app create). Runs on the same `db` as the
  // rest of this function so the notification never survives a rollback of
  // the subscription it claims was activated.
  const members = await db.clinicMember.findMany({
    where: { clinicId: opts.clinicId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  });
  const title = 'Подписка активирована';
  const message =
    opts.saasPlan === 'starter'
      ? 'Тариф Starter активирован бесплатно.'
      : `Тариф ${opts.saasPlan} оплачен. Действует до ${periodEnd?.toISOString().slice(0, 10)}.`;

  if (members.length > 0) {
    await db.notification.createMany({
      data: members.map((m) => ({
        id: uid(),
        userId: m.userId,
        type: 'subscription',
        title,
        message,
        link: '/crm/billing',
      })),
    });
  }

  return result;
}

export async function getClinicBillingSnapshot(clinicId: string) {
  const { resolveClinicAccess, getPlanCatalogWithEntitlements } = await import('./planEntitlements.js');
  const access = await resolveClinicAccess(clinicId);
  if (!access) return null;

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, plan: true, active: true, city: true },
  });
  if (!clinic) return null;

  const subscription = await prisma.subscription.findUnique({
    where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
  });

  return {
    clinic: {
      ...clinic,
      active: access.active,
    },
    subscription: subscription || {
      ownerType: 'CLINIC',
      ownerId: clinicId,
      plan: access.saasPlan,
      status: access.status,
      periodEnd: null,
    },
    saasPlan: access.saasPlan,
    daysLeft: access.daysLeft,
    expired: access.expired,
    expiringSoon: !access.expired && access.daysLeft != null && access.daysLeft >= 0 && access.daysLeft <= 14,
    writeBlocked: access.writeBlocked,
    trialDays: TRIAL_DAYS,
    entitlements: access.entitlements,
    usage: access.usage,
    limits: access.limits,
    approaching: access.approaching,
    plans: getPlanCatalogWithEntitlements().map((p) => ({
      ...p,
      amountMinor: tengeToMinor(p.priceTenge).toString(),
    })),
  };
}

export async function notifyClinicOwners(
  clinicId: string,
  title: string,
  message: string,
  link = '/crm/billing',
) {
  const { dispatchNotifications } = await import('../notifications/dispatch.service.js');
  const members = await prisma.clinicMember.findMany({
    where: { clinicId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  });
  if (members.length > 0) {
    await dispatchNotifications(
      members.map((m) => ({
        userId: m.userId,
        clinicId,
        type: 'subscription',
        title,
        message,
        link,
      })),
    );
  }
  return members.length;
}
