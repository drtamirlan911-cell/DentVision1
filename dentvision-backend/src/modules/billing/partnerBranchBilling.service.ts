import type { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { calculatePartnerBranchSubscriptionQuote, type PartnerBranchSubscriptionVertical } from './partnerEconomics.js';

export type PartnerBranchBillingErrorCode =
  | 'INVALID_PERIOD'
  | 'ORGANIZATION_NOT_FOUND'
  | 'PARTNER_VERTICAL_NOT_CONFIGURED'
  | 'PARTNER_NOT_ACTIVE'
  | 'SUBSCRIPTION_PLAN_CONFLICT'
  | 'BILLING_PERIOD_OVERLAP';

export class PartnerBranchBillingError extends Error {
  constructor(
    public readonly code: PartnerBranchBillingErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'PartnerBranchBillingError';
  }
}

type OrganizationBillingIdentity = {
  id: string;
  type: string;
  originalType: string | null;
  originalId: string | null;
  settings: Prisma.JsonValue | null;
};

function settingsObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * Resolve the tariff from canonical organization metadata. Legacy Laboratory
 * rows without an explicit laboratory subtype are deliberately not guessed.
 */
export function resolvePartnerBranchBillingVertical(
  organization: OrganizationBillingIdentity,
): PartnerBranchSubscriptionVertical {
  if (organization.type === 'DIAGNOSTIC_CENTER' && organization.originalType === 'DiagnosticCenter' && organization.originalId) {
    return 'DIAGNOSTIC_3D';
  }

  if (organization.type !== 'LABORATORY' || organization.originalType !== 'Laboratory' || !organization.originalId) {
    throw new PartnerBranchBillingError(
      'PARTNER_VERTICAL_NOT_CONFIGURED',
      'Для этой организации не утверждён тариф филиальной подписки',
      409,
    );
  }

  const settings = settingsObject(organization.settings);
  const explicitType = String(settings.partnerVertical || settings.laboratoryType || settings.selfServiceType || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');

  if (['DENTAL_LAB', 'DENTAL_LABORATORY'].includes(explicitType)) return 'DENTAL_LAB';
  if (['MEDICAL_ANALYSIS', 'MEDICAL_LAB', 'MEDICAL_LABORATORY'].includes(explicitType)) return 'MEDICAL_ANALYSIS';

  throw new PartnerBranchBillingError(
    'PARTNER_VERTICAL_NOT_CONFIGURED',
    'У лаборатории не указан подтверждённый тип: медицинская или зуботехническая',
    409,
  );
}

function assertBillingPeriod(periodStart: Date, periodEnd: Date): void {
  if (
    !(periodStart instanceof Date)
    || !(periodEnd instanceof Date)
    || Number.isNaN(periodStart.getTime())
    || Number.isNaN(periodEnd.getTime())
    || periodEnd <= periodStart
  ) {
    throw new PartnerBranchBillingError('INVALID_PERIOD', 'Период филиальной подписки задан некорректно');
  }
}

function planForVertical(vertical: PartnerBranchSubscriptionVertical): string {
  return `partner_branch_${vertical.toLowerCase()}`;
}

async function issueInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    createdByUserId?: string | null;
  },
) {
  const organizationId = String(input.organizationId || '').trim();
  if (!organizationId) {
    throw new PartnerBranchBillingError('ORGANIZATION_NOT_FOUND', 'Не указана организация партнёра');
  }
  assertBillingPeriod(input.periodStart, input.periodEnd);

  // A lock makes the subscription bootstrap and period invoice idempotent even
  // when two billing workers start the same organization-period concurrently.
  const lockKey = `dentvision.partner-branch-invoice:${organizationId}:${input.periodStart.toISOString()}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const organization = await tx.organization.findFirst({
    where: { id: organizationId, archivedAt: null },
    select: { id: true, type: true, originalType: true, originalId: true, settings: true },
  }) as OrganizationBillingIdentity | null;
  if (!organization || !organization.originalId) {
    throw new PartnerBranchBillingError('ORGANIZATION_NOT_FOUND', 'Активная организация партнёра не найдена', 404);
  }

  const vertical = resolvePartnerBranchBillingVertical(organization);
  const plan = planForVertical(vertical);

  const existingSubscription = await tx.subscription.findUnique({
    where: { ownerType_ownerId: { ownerType: 'PARTNER', ownerId: organization.originalId } },
  });

  if (existingSubscription && existingSubscription.plan !== 'free' && existingSubscription.plan !== plan) {
    throw new PartnerBranchBillingError(
      'SUBSCRIPTION_PLAN_CONFLICT',
      'У партнёра уже есть подписка другого типа; автоматическая замена запрещена',
      409,
    );
  }

  const subscription = existingSubscription
    ? existingSubscription.plan === 'free'
      ? await tx.subscription.update({
          where: { id: existingSubscription.id },
          data: { plan },
        })
      : existingSubscription
    : await tx.subscription.create({
        data: {
          ownerType: 'PARTNER',
          ownerId: organization.originalId,
          plan,
          status: 'pending_payment',
          periodEnd: null,
        },
      });

  // The invoice snapshot is immutable for a subscription period. A retry returns
  // the original record and never recalculates a changed branch roster or price.
  const existingInvoice = await tx.partnerBranchSubscriptionInvoice.findFirst({
    where: { subscriptionId: subscription.id, periodStart: input.periodStart },
  });
  if (existingInvoice) {
    if (existingInvoice.periodEnd.getTime() !== input.periodEnd.getTime()) {
      throw new PartnerBranchBillingError(
        'INVALID_PERIOD',
        'Для этого начала периода уже существует счёт с другой датой окончания',
        409,
      );
    }
    return { invoice: existingInvoice, idempotent: true };
  }

  const overlappingInvoice = await tx.partnerBranchSubscriptionInvoice.findFirst({
    where: {
      subscriptionId: subscription.id,
      status: { not: 'void' },
      periodStart: { lt: input.periodEnd },
      periodEnd: { gt: input.periodStart },
    },
  });
  if (overlappingInvoice) {
    throw new PartnerBranchBillingError(
      'BILLING_PERIOD_OVERLAP',
      'Нельзя выставить перекрывающийся период филиальной подписки',
      409,
    );
  }

  let active = false;
  if (vertical === 'DIAGNOSTIC_3D') {
    const entity = await tx.diagnosticCenter.findFirst({
      where: { id: organization.originalId, active: true },
      select: { id: true },
    });
    active = Boolean(entity);
  } else {
    const entity = await tx.laboratory.findFirst({
      where: { id: organization.originalId, active: true },
      select: { id: true },
    });
    active = Boolean(entity);
  }

  if (!active) {
    throw new PartnerBranchBillingError(
      'PARTNER_NOT_ACTIVE',
      'Неактивная организация не получает филиальный счёт',
      409,
    );
  }

  const branches = await tx.branch.findMany({
    where: { organizationId: organization.id, active: true },
    select: { id: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const branchIds = branches.map((branch) => branch.id);
  const quote = calculatePartnerBranchSubscriptionQuote({
    vertical,
    organizationActivated: true,
    activeBillableBranchCount: branchIds.length,
  });
  const amountMinor = BigInt(quote.monthlyTotalKzt) * 100n;

  const invoiceId = uid();
  const invoiceNumber = `PB-${input.periodStart.toISOString().slice(0, 10).replace(/-/g, '')}-${invoiceId.slice(0, 8).toUpperCase()}`;

  const invoice = await tx.partnerBranchSubscriptionInvoice.create({
    data: {
      id: invoiceId,
      subscriptionId: subscription.id,
      organizationId: organization.id,
      ownerId: organization.originalId,
      invoiceNumber,
      vertical,
      policyVersion: quote.policyVersion,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      activeBranchCount: quote.activeBillableBranchCount,
      billableBranchCount: quote.billableBranchCount,
      branchIds: branchIds as Prisma.InputJsonValue,
      unitPriceKzt: quote.unitPriceKzt,
      amountMinor,
      currency: quote.currency,
      status: 'issued',
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  return { invoice, idempotent: false };
}

/**
 * Creates one immutable monthly partner branch invoice for a trusted billing
 * worker or platform finance operator. The caller supplies the billing period;
 * scheduling, proration and payment collection are separate lifecycle steps.
 */
export async function issuePartnerBranchSubscriptionInvoice(
  input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    createdByUserId?: string | null;
  },
  db?: Prisma.TransactionClient,
) {
  if (db) return issueInTransaction(db, input);
  return prisma.$transaction((tx) => issueInTransaction(tx, input));
}
