import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, issueInvoice, notifyCenter } = vi.hoisted(() => ({
  findMany: vi.fn(),
  issueInvoice: vi.fn(),
  notifyCenter: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: { organization: { findMany } },
}));
vi.mock('../modules/billing/partnerBranchBilling.service.js', () => ({
  issuePartnerBranchSubscriptionInvoice: issueInvoice,
}));
vi.mock('../services/notification.service.js', () => ({
  createNotificationForCenter: notifyCenter,
  NOTIFICATION_TYPES: { PARTNER_BRANCH_INVOICE_ISSUED: 'partner.branch_subscription.invoice_issued' },
}));
vi.mock('../lib/jobLock.js', () => ({
  withJobLock: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}));

import { runPartnerBranchSubscriptionCron } from './partnerBranchSubscriptionCron.js';

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([
    { id: 'org-diagnostic' },
    { id: 'org-medical-lab' },
    { id: 'org-dental-lab' },
  ]);
  issueInvoice.mockResolvedValue({
    idempotent: false,
    invoice: {
      id: 'invoice-1',
      invoiceNumber: 'PB-20261101-ABCDEF12',
      vertical: 'DIAGNOSTIC_3D',
      amountMinor: 4_990_000n,
    },
  });
  notifyCenter.mockResolvedValue(undefined);
});

describe('partner branch subscription monthly invoice cron', () => {
  it('issues the current UTC calendar month and sends an in-app notification without charging', async () => {
    const now = new Date('2026-11-23T09:15:00.000Z');
    const result = await runPartnerBranchSubscriptionCron(now);

    expect(result.periodStart.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(result.periodEnd.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(result).toMatchObject({ scanned: 3, issued: 3, alreadyIssued: 0, skipped: 0, errors: 0 });
    expect(issueInvoice).toHaveBeenCalledWith(expect.objectContaining({
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
    }), undefined, now);
    expect(notifyCenter).toHaveBeenCalledTimes(3);
    expect(notifyCenter).toHaveBeenCalledWith('org-diagnostic', expect.objectContaining({
      type: 'partner.branch_subscription.invoice_issued',
      link: '/diagnostics/center?tab=finance',
    }));
    const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/jobs/partnerBranchSubscriptionCron.ts'), 'utf8');
    expect(source).not.toContain('createPayment(');
    expect(source).not.toContain('paymentMethod');
  });

  it('does not duplicate notifications for existing invoices and skips missing legal/history boundaries', async () => {
    issueInvoice
      .mockResolvedValueOnce({
        idempotent: true,
        invoice: { id: 'existing-invoice', invoiceNumber: 'PB-20261101-EXISTING', vertical: 'MEDICAL_ANALYSIS', amountMinor: 1_990_000n },
      })
      .mockRejectedValueOnce({ code: 'BILLING_HISTORY_UNAVAILABLE' })
      .mockResolvedValueOnce({
        idempotent: false,
        invoice: { id: 'new-invoice', invoiceNumber: 'PB-20261101-NEW', vertical: 'DENTAL_LAB', amountMinor: 2_990_000n },
      });

    const result = await runPartnerBranchSubscriptionCron(new Date('2026-11-23T09:15:00.000Z'));

    expect(result).toMatchObject({ scanned: 3, issued: 1, alreadyIssued: 1, skipped: 1, errors: 0 });
    expect(notifyCenter).toHaveBeenCalledTimes(1);
    expect(notifyCenter).toHaveBeenCalledWith('org-dental-lab', expect.objectContaining({
      link: '/diagnostics/lab?tab=finance',
    }));
  });

  it('pages through the partner registry instead of silently truncating at one batch', async () => {
    const fullBatch = Array.from({ length: 500 }, (_, index) => ({ id: `org-${String(index).padStart(4, '0')}` }));
    findMany.mockResolvedValueOnce(fullBatch).mockResolvedValueOnce([{ id: 'org-last' }]);
    issueInvoice.mockResolvedValue({ idempotent: true, invoice: {} });

    const result = await runPartnerBranchSubscriptionCron(new Date('2026-11-23T09:15:00.000Z'));

    expect(result.scanned).toBe(501);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: 'org-0499' }, skip: 1 });
  });

  it('registers the hourly job only behind the configured background-job gate', () => {
    const bootstrap = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/index.ts'), 'utf8');
    expect(bootstrap).toContain("import { startPartnerBranchSubscriptionCronInterval } from './jobs/partnerBranchSubscriptionCron.js';");
    expect(bootstrap).toContain('startPartnerBranchSubscriptionCronInterval();');
    const start = bootstrap.indexOf('startPartnerBranchSubscriptionCronInterval();');
    const cronGate = bootstrap.lastIndexOf('if (env.REMINDER_CRON_MS > 0)', start);
    expect(cronGate).toBeGreaterThanOrEqual(0);
  });
});
