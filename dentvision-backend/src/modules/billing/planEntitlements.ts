/**
 * SaaS plan entitlements — single source of truth for limits & features.
 * Marketing copy in CLINIC_SAAS_PLANS must stay aligned with these numbers.
 */
import type { ClinicPlan } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import {
  CLINIC_SAAS_PLANS,
  clinicPlanToSaas,
  type SaasPlanId,
} from './clinicSubscription.service.js';

export type PlanFeature =
  | 'ai'
  | 'analytics'
  | 'crm'
  | 'marketplace'
  | 'academy'
  | 'multiClinic'
  | 'prioritySupport';

export type PlanEntitlements = {
  saasPlan: SaasPlanId | 'free';
  /** null = unlimited */
  maxPatients: number | null;
  maxUsers: number | null;
  /** null = unlimited; 0 = no AI */
  aiRequestsPerMonth: number | null;
  features: Record<PlanFeature, boolean>;
};

export const PLAN_ENTITLEMENTS: Record<SaasPlanId | 'free', PlanEntitlements> = {
  free: {
    saasPlan: 'free',
    maxPatients: 25,
    maxUsers: 1,
    aiRequestsPerMonth: 0,
    features: {
      ai: false,
      analytics: false,
      crm: true,
      marketplace: true,
      academy: true,
      multiClinic: false,
      prioritySupport: false,
    },
  },
  starter: {
    saasPlan: 'starter',
    maxPatients: 100,
    maxUsers: 1,
    aiRequestsPerMonth: 0,
    features: {
      ai: false,
      analytics: false,
      crm: true,
      marketplace: true,
      academy: true,
      multiClinic: false,
      prioritySupport: false,
    },
  },
  professional: {
    saasPlan: 'professional',
    maxPatients: null,
    maxUsers: 10,
    aiRequestsPerMonth: 100,
    features: {
      ai: true,
      analytics: true,
      crm: true,
      marketplace: true,
      academy: true,
      multiClinic: false,
      prioritySupport: false,
    },
  },
  enterprise: {
    saasPlan: 'enterprise',
    maxPatients: null,
    maxUsers: null,
    aiRequestsPerMonth: null,
    features: {
      ai: true,
      analytics: true,
      crm: true,
      marketplace: true,
      academy: true,
      multiClinic: true,
      prioritySupport: true,
    },
  },
};

export function normalizeSaasPlanId(raw: string | null | undefined): SaasPlanId | 'free' {
  const v = String(raw || 'free').toLowerCase();
  if (v === 'pro') return 'professional';
  if (v === 'standard') return 'starter';
  if (v === 'demo' || v === 'free') return 'free';
  if (v === 'starter' || v === 'professional' || v === 'enterprise') return v;
  return 'free';
}

/** Prefer higher of clinic.plan vs subscription.plan (avoids stale starter sub on PRO demos). */
export function resolveEffectiveSaasPlan(
  clinicPlan: ClinicPlan,
  subscriptionPlan?: string | null,
): SaasPlanId | 'free' {
  const fromClinic = normalizeSaasPlanId(clinicPlanToSaas(clinicPlan));
  if (!subscriptionPlan) return fromClinic;
  const fromSub = normalizeSaasPlanId(subscriptionPlan);
  const rank: Record<string, number> = {
    free: 0,
    starter: 1,
    professional: 2,
    enterprise: 3,
  };
  return (rank[fromClinic] || 0) >= (rank[fromSub] || 0) ? fromClinic : fromSub;
}

export function entitlementsForPlan(plan: SaasPlanId | 'free' | ClinicPlan | string): PlanEntitlements {
  if (plan === 'DEMO' || plan === 'STANDARD' || plan === 'PRO' || plan === 'ENTERPRISE') {
    return { ...PLAN_ENTITLEMENTS[clinicPlanToSaas(plan) as SaasPlanId | 'free'] };
  }
  const id = normalizeSaasPlanId(String(plan));
  return { ...PLAN_ENTITLEMENTS[id] };
}

export type ClinicAccessState = {
  clinicId: string;
  clinicName: string;
  clinicPlan: ClinicPlan;
  saasPlan: SaasPlanId | 'free';
  status: string;
  active: boolean;
  expired: boolean;
  /** Write operations blocked (expired / suspended). Reads + billing still ok. */
  writeBlocked: boolean;
  periodEnd: Date | null;
  daysLeft: number | null;
  entitlements: PlanEntitlements;
  usage: {
    patients: number;
    users: number;
    aiRequestsThisMonth: number;
  };
  limits: {
    patientsReached: boolean;
    usersReached: boolean;
    aiQuotaReached: boolean;
  };
  /** Soft warnings at ≥80% of a capped resource (before hard block). */
  approaching: {
    patients: boolean;
    users: boolean;
    ai: boolean;
  };
};

const APPROACH_RATIO = 0.8;

function approachingCap(used: number, max: number | null | undefined): boolean {
  if (max == null || max <= 0) return false;
  if (used >= max) return false; // hard limit owns the UX
  return used / max >= APPROACH_RATIO;
}

function daysUntil(date: Date | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** Resolve live access for a clinic (self-heals expired periodEnd without waiting for cron). */
export async function resolveClinicAccess(clinicId: string): Promise<ClinicAccessState | null> {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, plan: true, active: true },
  });
  if (!clinic) return null;

  const subscription = await prisma.subscription.findUnique({
    where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
  });

  const now = new Date();
  const periodEnd = subscription?.periodEnd || null;
  const periodExpired = periodEnd != null && periodEnd.getTime() < now.getTime();
  let status = subscription?.status || (clinic.active ? 'active' : 'suspended');

  // Self-heal: period ended but cron hasn't flipped yet
  if (periodExpired && status !== 'expired' && status !== 'suspended') {
    status = 'expired';
    await Promise.all([
      prisma.subscription.update({
        where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
        data: { status: 'expired' },
      }).catch(() => null),
      prisma.clinic.update({
        where: { id: clinicId },
        data: { active: false },
      }).catch(() => null),
    ]);
  }

  const expired =
    status === 'expired' ||
    status === 'suspended' ||
    !clinic.active ||
    periodExpired;

  const saasPlan = resolveEffectiveSaasPlan(clinic.plan, subscription?.plan);
  // Expired clinics keep their plan label but lose paid features (fall back to free caps for display)
  const entitlements = expired
    ? { ...PLAN_ENTITLEMENTS.free, saasPlan }
    : entitlementsForPlan(saasPlan);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [patients, users, aiCount] = await Promise.all([
    prisma.patient.count({ where: { clinicId } }),
    prisma.clinicMember.count({
      where: { clinicId, role: { not: 'STUDENT' } },
    }),
    prisma.aISession.count({
      where: {
        clinicId,
        updatedAt: { gte: monthStart },
      },
    }).catch(() => 0),
  ]);

  const patientsReached =
    entitlements.maxPatients != null && patients >= entitlements.maxPatients;
  const usersReached =
    entitlements.maxUsers != null && users >= entitlements.maxUsers;
  // Quota only applies when AI is part of the plan. Feature-off plans use PLAN_FEATURE_REQUIRED.
  const aiQuotaReached =
    entitlements.features.ai &&
    entitlements.aiRequestsPerMonth != null &&
    aiCount >= entitlements.aiRequestsPerMonth;

  return {
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicPlan: clinic.plan,
    saasPlan,
    status: expired ? 'expired' : status,
    active: clinic.active && !expired,
    expired,
    writeBlocked: expired,
    periodEnd,
    daysLeft: daysUntil(periodEnd, now),
    entitlements,
    usage: {
      patients,
      users,
      aiRequestsThisMonth: aiCount,
    },
    limits: {
      patientsReached,
      usersReached,
      aiQuotaReached,
    },
    approaching: {
      patients: approachingCap(patients, entitlements.maxPatients),
      users: approachingCap(users, entitlements.maxUsers),
      ai: approachingCap(aiCount, entitlements.aiRequestsPerMonth),
    },
  };
}

export class PlanGateError extends Error {
  status: number;
  code: string;
  data?: Record<string, unknown>;
  constructor(
    message: string,
    code: string,
    status = 402,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export function assertClinicWritable(access: ClinicAccessState) {
  if (access.writeBlocked) {
    throw new PlanGateError(
      'Подписка клиники истекла. Оплатите тариф, чтобы продолжить работу.',
      'SUBSCRIPTION_EXPIRED',
      402,
      { upgradePath: '/crm/billing', saasPlan: access.saasPlan },
    );
  }
}

export function assertFeature(access: ClinicAccessState, feature: PlanFeature) {
  assertClinicWritable(access);
  if (!access.entitlements.features[feature]) {
    const need =
      feature === 'ai' || feature === 'analytics' ? 'Professional' : 'более высокий тариф';
    throw new PlanGateError(
      `Функция недоступна на тарифе ${access.saasPlan}. Нужен ${need}.`,
      'PLAN_FEATURE_REQUIRED',
      402,
      { feature, saasPlan: access.saasPlan, upgradePath: '/crm/billing' },
    );
  }
}

export function assertPatientSlot(access: ClinicAccessState) {
  assertClinicWritable(access);
  if (access.limits.patientsReached) {
    throw new PlanGateError(
      `Лимит пациентов тарифа ${access.saasPlan}: ${access.entitlements.maxPatients}. Обновите тариф.`,
      'PLAN_PATIENT_LIMIT',
      402,
      {
        used: access.usage.patients,
        limit: access.entitlements.maxPatients,
        upgradePath: '/crm/billing',
      },
    );
  }
}

export function assertUserSlot(access: ClinicAccessState) {
  assertClinicWritable(access);
  if (access.limits.usersReached) {
    throw new PlanGateError(
      `Лимит сотрудников тарифа ${access.saasPlan}: ${access.entitlements.maxUsers}. Обновите тариф.`,
      'PLAN_USER_LIMIT',
      402,
      {
        used: access.usage.users,
        limit: access.entitlements.maxUsers,
        upgradePath: '/crm/billing',
      },
    );
  }
}

export function assertAiAllowed(access: ClinicAccessState) {
  assertFeature(access, 'ai');
  if (access.limits.aiQuotaReached) {
    throw new PlanGateError(
      `Исчерпан лимит AI-запросов в этом месяце (${access.entitlements.aiRequestsPerMonth}).`,
      'PLAN_AI_QUOTA',
      402,
      {
        used: access.usage.aiRequestsThisMonth,
        limit: access.entitlements.aiRequestsPerMonth,
        upgradePath: '/crm/billing',
      },
    );
  }
}

/** Enrich public plan catalog with numeric entitlements for UI. */
export function getPlanCatalogWithEntitlements() {
  return CLINIC_SAAS_PLANS.map((p) => {
    const e = PLAN_ENTITLEMENTS[p.id];
    return {
      ...p,
      entitlements: {
        maxPatients: e.maxPatients,
        maxUsers: e.maxUsers,
        aiRequestsPerMonth: e.aiRequestsPerMonth,
        features: e.features,
      },
    };
  });
}
