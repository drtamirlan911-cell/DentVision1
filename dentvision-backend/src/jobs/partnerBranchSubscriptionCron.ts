import prisma from '../lib/prisma.js';
import { withJobLock } from '../lib/jobLock.js';
import { createNotificationForMany, NOTIFICATION_TYPES } from '../services/notification.service.js';
import { issuePartnerBranchSubscriptionInvoice } from '../modules/billing/partnerBranchBilling.service.js';

const ORGANIZATION_TYPES = ['DIAGNOSTIC_CENTER', 'LABORATORY'] as const;
const ORGANIZATION_BATCH_SIZE = 500;

export interface PartnerBranchSubscriptionCronResult {
  periodStart: Date;
  periodEnd: Date;
  scanned: number;
  issued: number;
  alreadyIssued: number;
  skipped: number;
  errors: number;
}

function currentCalendarMonth(now: Date): { periodStart: Date; periodEnd: Date } {
  return {
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

function formatMinor(value: bigint): string {
  const whole = (value / 100n).toLocaleString('ru-RU');
  const fraction = (value % 100n).toString().padStart(2, '0');
  return `${whole},${fraction} ₸`;
}

function financeLink(vertical: string): string {
  if (vertical === 'DIAGNOSTIC_3D') return '/diagnostics/center?tab=finance';
  if (vertical === 'MEDICAL_ANALYSIS') return '/diagnostics/lab?workspace=medical-lab&tab=finance';
  return '/diagnostics/lab?tab=finance';
}

/**
 * Issues the current calendar month's partner branch invoice after the month
 * boundary. The canonical service resolves the tariff and effective-dated
 * branch roster, snapshots the amount and protects each organization-period
 * with a database lock. The partner explicitly initiates Kaspi QR payment.
 */
export async function runPartnerBranchSubscriptionCron(now = new Date()): Promise<PartnerBranchSubscriptionCronResult> {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('INVALID_PARTNER_BILLING_CRON_DATE');
  const { periodStart, periodEnd } = currentCalendarMonth(now);
  const result: PartnerBranchSubscriptionCronResult = {
    periodStart,
    periodEnd,
    scanned: 0,
    issued: 0,
    alreadyIssued: 0,
    skipped: 0,
    errors: 0,
  };

  let cursor: string | undefined;
  while (true) {
    const organizations = await prisma.organization.findMany({
      where: { type: { in: [...ORGANIZATION_TYPES] }, archivedAt: null },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: ORGANIZATION_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (organizations.length === 0) break;

    result.scanned += organizations.length;
    for (const organization of organizations) {
      try {
        const issued = await issuePartnerBranchSubscriptionInvoice({
          organizationId: organization.id,
          periodStart,
          periodEnd,
        }, undefined, now);

        if (issued.idempotent) result.alreadyIssued += 1;
        else result.issued += 1;
        // Invoice amounts are financial data: notify only organization members
        // who hold an explicit finance/billing read or manage permission.
        const financeMembers = await prisma.personRole.findMany({
          where: {
            scopeType: 'organization',
            scopeId: organization.id,
            person: {
              organizationId: organization.id,
              userId: { not: null },
            },
            role: {
              permissions: {
                some: {
                  permission: {
                    key: { in: ['billing.read', 'billing.manage', 'finance.read', 'finance.manage'] },
                  },
                },
              },
            },
          },
          select: { person: { select: { userId: true } } },
        });
        const financeUserIds = [...new Set(
          financeMembers.map((member) => member.person.userId).filter((userId): userId is string => Boolean(userId)),
        )];
        if (financeUserIds.length > 0) {
          const notificationTitle = `Счёт ${issued.invoice.invoiceNumber} за филиальную подписку готов`;
          const notificationMessage = `Счёт ${issued.invoice.invoiceNumber} за текущий месяц сформирован на сумму ${formatMinor(BigInt(issued.invoice.amountMinor))}. Откройте раздел «Финансы», чтобы проверить состав филиалов и оплатить счёт через Kaspi QR.`;
          const notificationLink = financeLink(issued.invoice.vertical);
          // The invoice is the durable source of truth. If notification delivery
          // failed after issuance, a later hourly tick must retry without
          // duplicating a notification already persisted for that invoice/user.
          const existingNotifications = await prisma.notification.findMany({
            where: {
              userId: { in: financeUserIds },
              type: NOTIFICATION_TYPES.PARTNER_BRANCH_INVOICE_ISSUED,
              title: notificationTitle,
              message: notificationMessage,
              link: notificationLink,
            },
            select: { userId: true },
          });
          const alreadyNotified = new Set(existingNotifications.map((row) => row.userId));
          const pendingRecipients = financeUserIds.filter((userId) => !alreadyNotified.has(userId));
          if (pendingRecipients.length > 0) {
            await createNotificationForMany(pendingRecipients, {
              type: NOTIFICATION_TYPES.PARTNER_BRANCH_INVOICE_ISSUED,
              title: notificationTitle,
              message: notificationMessage,
              link: notificationLink,
            });
          }
        }
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : '';
        if (['PARTNER_NOT_ACTIVE', 'PARTNER_VERTICAL_NOT_CONFIGURED', 'BILLING_HISTORY_UNAVAILABLE'].includes(code)) {
          result.skipped += 1;
        } else {
          result.errors += 1;
          console.error('[PartnerBranchSubscriptionCron] invoice issue failed', {
            organizationId: organization.id,
            code: code || 'UNCLASSIFIED',
          });
        }
      }
    }

    if (organizations.length < ORGANIZATION_BATCH_SIZE) break;
    cursor = organizations[organizations.length - 1]?.id;
    if (!cursor) break;
  }

  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPartnerBranchSubscriptionCronInterval(ms = 60 * 60 * 1000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const result = await withJobLock('partner_branch_subscription_cron', () => runPartnerBranchSubscriptionCron());
      if (result) {
        console.log(
          `[PartnerBranchSubscriptionCron] period=${result.periodStart.toISOString().slice(0, 10)} issued=${result.issued} existing=${result.alreadyIssued} skipped=${result.skipped} errors=${result.errors}`,
        );
      }
    } catch (error) {
      console.error('[PartnerBranchSubscriptionCron] tick failed', error);
    }
  };
  setTimeout(tick, 30_000);
  timer = setInterval(tick, ms);
  console.log(`[PartnerBranchSubscriptionCron] interval started (${Math.round(ms / 60_000)}m)`);
}
