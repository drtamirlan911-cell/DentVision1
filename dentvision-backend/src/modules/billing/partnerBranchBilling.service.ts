import type { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { writeRevenue } from '../finance/revenue.service.js';
import { calculatePartnerBranchSubscriptionQuote, type PartnerBranchSubscriptionVertical } from './partnerEconomics.js';
import { BranchStatusHistoryUnavailableError, getActiveBranchIdsAt } from '../branches/branchStatusHistory.js';

export type PartnerBranchBillingErrorCode =
  | 'INVALID_PERIOD'
  | 'ORGANIZATION_NOT_FOUND'
  | 'PARTNER_VERTICAL_NOT_CONFIGURED'
  | 'PARTNER_NOT_ACTIVE'
  | 'SUBSCRIPTION_PLAN_CONFLICT'
  | 'BILLING_PERIOD_OVERLAP'
  | 'BILLING_HISTORY_UNAVAILABLE';

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
    asOf: Date;
  },
) {
  const expectedPeriodStart = new Date(Date.UTC(
    input.periodStart.getUTCFullYear(),
    input.periodStart.getUTCMonth(),
    1,
  ));
  const expectedPeriodEnd = new Date(Date.UTC(
    input.periodStart.getUTCFullYear(),
    input.periodStart.getUTCMonth() + 1,
    1,
  ));
  if (
    input.periodStart.getTime() !== expectedPeriodStart.getTime()
    || input.periodEnd.getTime() !== expectedPeriodEnd.getTime()
  ) {
    throw new PartnerBranchBillingError(
      'INVALID_PERIOD',
      'Филиальная подписка выставляется за полный календарный месяц',
      400,
    );
  }

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
  const organizationSettings = settingsObject(organization.settings);
  const legalSettings = settingsObject(organizationSettings.legal as Prisma.JsonValue | null);
  const platformSignedAt = new Date(String(legalSettings.platformSignedAt || ''));
  if (!legalSettings.platformSignedAt || Number.isNaN(platformSignedAt.getTime())) {
    throw new PartnerBranchBillingError(
      'BILLING_HISTORY_UNAVAILABLE',
      'Не подтверждена дата юридической активации организации. Счёт не будет выставлен задним числом.',
      409,
    );
  }
  if (platformSignedAt.getTime() > input.periodStart.getTime()) {
    throw new PartnerBranchBillingError(
      'BILLING_HISTORY_UNAVAILABLE',
      'Организация активирована после начала периода. Филиальная подписка начнёт начисляться со следующей месячной границы.',
      409,
    );
  }
  const legallyVerified = organizationSettings.ecosystemVisible === true
    && organizationSettings.lifecycle === 'ACTIVE_VERIFIED'
    && organizationSettings.verification === 'APPROVED'
    && legalSettings.ownerSigned === true
    && legalSettings.platformSigned === true;
  if (!legallyVerified) {
    throw new PartnerBranchBillingError(
      'PARTNER_NOT_ACTIVE',
      'Партнёр не завершил юридическую проверку и активацию DentVision',
      409,
    );
  }

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
          data: { plan, status: 'pending_payment', periodEnd: null },
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

  let branchIds: string[];
  try {
    branchIds = await getActiveBranchIdsAt(tx, organization.id, input.periodStart, input.asOf);
  } catch (error) {
    if (error instanceof BranchStatusHistoryUnavailableError) {
      throw new PartnerBranchBillingError('BILLING_HISTORY_UNAVAILABLE', error.message, 409);
    }
    throw error;
  }
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
  asOf = new Date(),
) {
  const boundedInput = { ...input, asOf };
  if (db) return issueInTransaction(db, boundedInput);
  return prisma.$transaction((tx) => issueInTransaction(tx, boundedInput));
}


export type PartnerBillingPermission = 'billing.read' | 'billing.manage' | 'finance.read' | 'finance.manage';

/**
 * Resolve partner billing access from the current organization context and its
 * scoped PersonRole permissions. A caller-provided organization ID is not proof
 * of membership; both the Organization mapping and role scope are checked.
 */
export async function hasPartnerBranchBillingPermission(
  input: {
    userId: string;
    organizationId: string;
    ownerId: string;
    permissions: readonly PartnerBillingPermission[];
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<boolean> {
  if (!input.userId || !input.organizationId || !input.ownerId || input.permissions.length === 0) return false;
  const organization = await db.organization.findFirst({
    where: {
      id: input.organizationId,
      originalId: input.ownerId,
      archivedAt: null,
    },
    select: { id: true, type: true, originalType: true },
  });
  if (!organization) return false;
  const partnerTypeMatches =
    (organization.type === 'DIAGNOSTIC_CENTER' && organization.originalType === 'DiagnosticCenter')
    || (organization.type === 'LABORATORY' && organization.originalType === 'Laboratory');
  if (!partnerTypeMatches) return false;

  const memberships = await db.personRole.findMany({
    where: {
      scopeType: 'organization',
      scopeId: organization.id,
      person: { userId: input.userId, organizationId: organization.id },
    },
    select: {
      role: {
        select: {
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });
  const allowed = new Set(input.permissions);
  return memberships.some((membership) =>
    membership.role.permissions.some((assignment) => allowed.has(assignment.permission.key as PartnerBillingPermission)),
  );
}

/**
 * Called only from the shared atomic Payment settlement transaction. It links
 * one exact platform payment to one immutable partner invoice, activates the
 * corresponding subscription period and recognizes the distinct revenue source.
 */
export async function settlePartnerBranchSubscriptionInvoicePayment(
  payment: {
    id: string;
    refId: string | null;
    amount: bigint;
    currency?: string;
  },
  db: Prisma.TransactionClient,
): Promise<boolean> {
  if (!payment.refId) return false;

  await db.$queryRaw`SELECT "id" FROM "partner_branch_subscription_invoices" WHERE "id" = ${payment.refId} FOR UPDATE`;
  const invoice = await db.partnerBranchSubscriptionInvoice.findUnique({
    where: { id: payment.refId },
    include: { subscription: true },
  });
  if (!invoice) return false;

  if (invoice.status === 'paid' && invoice.paymentId === payment.id) return true;
  if (invoice.status !== 'payment_pending' || invoice.paymentId !== payment.id) {
    throw new PartnerBranchBillingError(
      'BILLING_PERIOD_OVERLAP',
      'Счёт изменился или не связан с этим платёжным запросом',
      409,
    );
  }
  if (payment.currency && payment.currency !== invoice.currency) {
    throw new PartnerBranchBillingError('INVALID_PERIOD', 'Валюта платежа не совпадает со счётом', 409);
  }
  if (payment.amount !== invoice.amountMinor) {
    throw new PartnerBranchBillingError('INVALID_PERIOD', 'Сумма платежа не совпадает с неизменяемым снимком счёта', 409);
  }
  if (invoice.subscription.ownerType !== 'PARTNER' || invoice.subscription.ownerId !== invoice.ownerId) {
    throw new PartnerBranchBillingError('SUBSCRIPTION_PLAN_CONFLICT', 'Счёт связан с неподходящей подпиской партнёра', 409);
  }

  const now = new Date();
  const previousPeriodEnd = invoice.subscription.periodEnd;
  const nextPeriodEnd = previousPeriodEnd && previousPeriodEnd > invoice.periodEnd
    ? previousPeriodEnd
    : invoice.periodEnd;
  const periodAlreadyStarted = invoice.periodStart <= now || Boolean(previousPeriodEnd && previousPeriodEnd > now);
  const nextStatus = nextPeriodEnd <= now ? 'expired' : periodAlreadyStarted ? 'active' : 'scheduled';

  await db.partnerBranchSubscriptionInvoice.update({
    where: { id: invoice.id },
    data: { status: 'paid', paidAt: now, paymentId: payment.id },
  });
  await db.subscription.update({
    where: { id: invoice.subscriptionId },
    data: {
      plan: planForVertical(invoice.vertical as PartnerBranchSubscriptionVertical),
      status: nextStatus,
      periodEnd: nextPeriodEnd,
    },
  });
  await writeRevenue({
    source: 'PARTNER_BRANCH_SUBSCRIPTION',
    amountMinor: payment.amount,
    refType: 'partner_branch_subscription_invoice',
    refId: invoice.id,
  }, db);
  return true;
}

/**
 * Release a payment hold after the provider has definitively failed or expired.
 * A stale callback cannot reopen an invoice linked to a different or paid payment.
 */
export async function releasePartnerBranchSubscriptionInvoicePayment(
  input: { invoiceId: string; paymentId: string },
  db: Prisma.TransactionClient,
): Promise<boolean> {
  await db.$queryRaw`SELECT "id" FROM "partner_branch_subscription_invoices" WHERE "id" = ${input.invoiceId} FOR UPDATE`;
  const invoice = await db.partnerBranchSubscriptionInvoice.findUnique({
    where: { id: input.invoiceId },
    select: { id: true, status: true, paymentId: true },
  });
  if (!invoice || invoice.status !== 'payment_pending' || invoice.paymentId !== input.paymentId) return false;
  await db.partnerBranchSubscriptionInvoice.update({
    where: { id: invoice.id },
    data: { status: 'issued', paymentId: null },
  });
  return true;
}
