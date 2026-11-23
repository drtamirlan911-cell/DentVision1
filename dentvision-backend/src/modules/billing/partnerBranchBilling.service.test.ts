import { describe, expect, it } from 'vitest';

import {
  issuePartnerBranchSubscriptionInvoice,
  PartnerBranchBillingError,
  resolvePartnerBranchBillingVertical,
} from './partnerBranchBilling.service.js';

const periodStart = new Date('2026-12-01T00:00:00.000Z');
const periodEnd = new Date('2027-01-01T00:00:00.000Z');
const billingAsOf = new Date('2026-12-01T00:00:00.000Z');

function makeDb(options: {
  organization?: any;
  active?: boolean;
  branches?: Array<{ id: string }>;
  subscription?: any;
  existingInvoice?: any;
  overlappingInvoice?: any;
  historyBoundary?: Date;
} = {}) {
  const created: { subscription?: any; invoice?: any } = {};
  const organization = options.organization ?? {
    id: 'org-center-1',
    type: 'DIAGNOSTIC_CENTER',
    originalType: 'DiagnosticCenter',
    originalId: 'center-1',
    settings: { ecosystemVisible: true, legal: { platformSignedAt: '2026-11-01T00:00:00.000Z' } },
  };
  const active = options.active ?? true;
  const tx: any = {
    $executeRaw: async () => undefined,
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      if (sql.includes('INSERT INTO "branch_status_history_baselines"')) return [];
      if (sql.includes('FROM "branch_status_history_baselines"')) {
        return [{ initialized_at: options.historyBoundary ?? new Date('2026-10-01T00:00:00.000Z') }];
      }
      if (sql.includes('FROM "branches" b')) return options.branches ?? [{ id: 'branch-a' }, { id: 'branch-b' }];
      return [];
    },
    organization: {
      findFirst: async () => organization,
    },
    diagnosticCenter: {
      findFirst: async () => active ? { id: organization.originalId } : null,
    },
    laboratory: {
      findFirst: async () => active ? { id: organization.originalId } : null,
    },
    branch: {
      findMany: async () => options.branches ?? [{ id: 'branch-a' }, { id: 'branch-b' }],
    },
    subscription: {
      findUnique: async () => options.subscription ?? null,
      create: async ({ data }: any) => {
        created.subscription = { id: 'subscription-1', ...data };
        return created.subscription;
      },
      update: async ({ data }: any) => {
        created.subscription = { id: 'subscription-1', ownerType: 'PARTNER', ownerId: organization.originalId, ...data };
        return created.subscription;
      },
    },
    partnerBranchSubscriptionInvoice: {
      findFirst: async ({ where }: any) => {
        if (options.existingInvoice && where.periodStart) return options.existingInvoice;
        if (options.overlappingInvoice && where.periodStart?.lt) return options.overlappingInvoice;
        return null;
      },
      create: async ({ data }: any) => {
        created.invoice = { id: data.id, ...data };
        return created.invoice;
      },
    },
  };
  return { tx, created };
}

describe('partner branch invoice vertical resolution', () => {
  it('maps diagnostic centers to the diagnostic tariff', () => {
    expect(resolvePartnerBranchBillingVertical({
      id: 'org-1', type: 'DIAGNOSTIC_CENTER', originalType: 'DiagnosticCenter', originalId: 'center-1', settings: {},
    })).toBe('DIAGNOSTIC_3D');
  });

  it('requires an explicit laboratory subtype rather than guessing the tariff', () => {
    expect(() => resolvePartnerBranchBillingVertical({
      id: 'org-1', type: 'LABORATORY', originalType: 'Laboratory', originalId: 'lab-1', settings: {},
    })).toThrowError(PartnerBranchBillingError);

    expect(resolvePartnerBranchBillingVertical({
      id: 'org-1', type: 'LABORATORY', originalType: 'Laboratory', originalId: 'lab-1',
      settings: { laboratoryType: 'DENTAL_LAB' },
    })).toBe('DENTAL_LAB');

    expect(resolvePartnerBranchBillingVertical({
      id: 'org-2', type: 'LABORATORY', originalType: 'Laboratory', originalId: 'lab-2',
      settings: { partnerVertical: 'MEDICAL_ANALYSIS' },
    })).toBe('MEDICAL_ANALYSIS');
  });
});

async function issuePartnerBranchInvoiceForTest(input: Parameters<typeof issuePartnerBranchSubscriptionInvoice>[0], db: any) {
  return issuePartnerBranchSubscriptionInvoice(input, db, billingAsOf);
}

describe('partner branch invoice issuance', () => {
  it('fails closed when an active partner has no verified legal activation timestamp', async () => {
    const organization = {
      id: 'org-center-legacy',
      type: 'DIAGNOSTIC_CENTER',
      originalType: 'DiagnosticCenter',
      originalId: 'center-legacy',
      settings: { ecosystemVisible: true },
    };
    const { tx, created } = makeDb({ organization });
    await expect(issuePartnerBranchInvoiceForTest({
      organizationId: organization.id, periodStart, periodEnd,
    }, tx)).rejects.toMatchObject({ code: 'BILLING_HISTORY_UNAVAILABLE' });
    expect(created.subscription).toBeUndefined();
    expect(created.invoice).toBeUndefined();
  });

  it('does not charge a month that started before legal activation', async () => {
    const organization = {
      id: 'org-center-late',
      type: 'DIAGNOSTIC_CENTER',
      originalType: 'DiagnosticCenter',
      originalId: 'center-late',
      settings: { ecosystemVisible: true, legal: { platformSignedAt: '2026-12-02T10:00:00.000Z' } },
    };
    const { tx, created } = makeDb({ organization });
    await expect(issuePartnerBranchInvoiceForTest({
      organizationId: organization.id, periodStart, periodEnd,
    }, tx)).rejects.toMatchObject({ code: 'BILLING_HISTORY_UNAVAILABLE' });
    expect(created.subscription).toBeUndefined();
    expect(created.invoice).toBeUndefined();
  });

  it('creates an immutable invoice using active branch snapshots and KZT minor units', async () => {
    const { tx, created } = makeDb();
    const result = await issuePartnerBranchInvoiceForTest({
      organizationId: 'org-center-1',
      periodStart,
      periodEnd,
      createdByUserId: 'finance-user-1',
    }, tx);

    expect(result.idempotent).toBe(false);
    expect(created.subscription).toMatchObject({
      ownerType: 'PARTNER',
      ownerId: 'center-1',
      plan: 'partner_branch_diagnostic_3d',
      status: 'pending_payment',
    });
    expect(created.invoice).toMatchObject({
      organizationId: 'org-center-1',
      ownerId: 'center-1',
      vertical: 'DIAGNOSTIC_3D',
      policyVersion: '1.2',
      activeBranchCount: 2,
      billableBranchCount: 2,
      branchIds: ['branch-a', 'branch-b'],
      unitPriceKzt: 49_900,
      amountMinor: 9_980_000n,
      currency: 'KZT',
      status: 'issued',
      createdByUserId: 'finance-user-1',
    });
  });

  it('applies the documented one-branch minimum to an active single-location partner', async () => {
    const { tx, created } = makeDb({ branches: [] });
    await issuePartnerBranchInvoiceForTest({
      organizationId: 'org-center-1', periodStart, periodEnd,
    }, tx);

    expect(created.invoice).toMatchObject({
      activeBranchCount: 0,
      billableBranchCount: 1,
      branchIds: [],
      amountMinor: 4_990_000n,
    });
  });

  it('uses the dental-lab tariff only when the organization is explicitly marked as a dental lab', async () => {
    const organization = {
      id: 'org-dental-lab',
      type: 'LABORATORY',
      originalType: 'Laboratory',
      originalId: 'dental-lab-1',
      settings: { laboratoryType: 'DENTAL_LAB', selfServiceType: 'dental_lab', lifecycle: 'ACTIVE_VERIFIED', verification: 'APPROVED', ecosystemVisible: true, legal: { ownerSigned: true, platformSigned: true, platformSignedAt: '2026-11-01T00:00:00.000Z' } },
    };
    const { tx, created } = makeDb({ organization, branches: [{ id: 'lab-branch' }] });
    await issuePartnerBranchInvoiceForTest({
      organizationId: organization.id, periodStart, periodEnd,
    }, tx);

    expect(created.invoice).toMatchObject({
      vertical: 'DENTAL_LAB',
      unitPriceKzt: 29_900,
      amountMinor: 2_990_000n,
    });
  });

  it('fails closed for an inactive partner and does not create an invoice', async () => {
    const { tx, created } = makeDb({ active: false });
    await expect(issuePartnerBranchInvoiceForTest({
      organizationId: 'org-center-1', periodStart, periodEnd,
    }, tx)).rejects.toMatchObject({ code: 'PARTNER_NOT_ACTIVE' });
    expect(created.invoice).toBeUndefined();
  });

  it('returns the original invoice on an idempotent retry without recalculating branches', async () => {
    const original = {
      id: 'invoice-original',
      periodEnd,
      branchIds: ['snapshot-from-issue-time'],
      amountMinor: 4_990_000n,
      status: 'issued',
    };
    const { tx } = makeDb({
      subscription: {
        id: 'subscription-1',
        ownerType: 'PARTNER',
        ownerId: 'center-1',
        plan: 'partner_branch_diagnostic_3d',
        status: 'pending_payment',
        periodEnd: null,
      },
      existingInvoice: original,
      branches: [],
    });
    const result = await issuePartnerBranchInvoiceForTest({
      organizationId: 'org-center-1', periodStart, periodEnd,
    }, tx);

    expect(result).toEqual({ invoice: original, idempotent: true });
  });

  it('rejects an overlapping invoice period', async () => {
    const { tx } = makeDb({
      subscription: {
        id: 'subscription-1',
        ownerType: 'PARTNER',
        ownerId: 'center-1',
        plan: 'partner_branch_diagnostic_3d',
        status: 'pending_payment',
        periodEnd: null,
      },
      overlappingInvoice: { id: 'overlap' },
    });
    await expect(issuePartnerBranchInvoiceForTest({
      organizationId: 'org-center-1',
      periodStart,
      periodEnd,
    }, tx)).rejects.toMatchObject({ code: 'BILLING_PERIOD_OVERLAP' });
  });

  it('rejects invalid or reversed billing periods', async () => {
    const { tx } = makeDb();
    await expect(issuePartnerBranchInvoiceForTest({
      organizationId: 'org-center-1',
      periodStart,
      periodEnd: periodStart,
    }, tx)).rejects.toMatchObject({ code: 'INVALID_PERIOD' });
  }); 
  it('rejects a period earlier than the recorded branch-history baseline', async () => {
    const { tx, created } = makeDb({ historyBoundary: new Date('2026-12-02T00:00:00.000Z') });
    await expect(issuePartnerBranchInvoiceForTest({
      organizationId: 'org-center-1', periodStart, periodEnd,
    }, tx)).rejects.toMatchObject({ code: 'BILLING_HISTORY_UNAVAILABLE' });
    expect(created.invoice).toBeUndefined();
  });

  it('rejects a future period instead of pricing it from today’s branch flags', async () => {
    const { tx, created } = makeDb();
    await expect(issuePartnerBranchSubscriptionInvoice({
      organizationId: 'org-center-1',
      periodStart: new Date('2027-01-01T00:00:00.000Z'),
      periodEnd: new Date('2027-02-01T00:00:00.000Z'),
    }, tx, billingAsOf)).rejects.toMatchObject({ code: 'BILLING_HISTORY_UNAVAILABLE' });
    expect(created.invoice).toBeUndefined();
  });

  it('accepts only a full calendar month with an exclusive next-month boundary', async () => {
    const { tx, created } = makeDb();
    await expect(issuePartnerBranchInvoiceForTest({
      organizationId: 'org-center-1',
      periodStart: new Date('2026-12-15T00:00:00.000Z'),
      periodEnd: new Date('2027-01-15T00:00:00.000Z'),
    }, tx)).rejects.toMatchObject({ code: 'INVALID_PERIOD' });
    expect(created.invoice).toBeUndefined();
  });
});

describe('partner invoice payment settlement', () => {
  function makeSettlementDb(options: {
    invoiceStatus?: string;
    linkedPaymentId?: string | null;
    subscriptionPeriodEnd?: Date | null;
  } = {}) {
    const invoice = {
      id: 'partner-invoice-1',
      subscriptionId: 'subscription-1',
      organizationId: 'org-center-1',
      ownerId: 'center-1',
      vertical: 'DIAGNOSTIC_3D',
      amountMinor: 4_990_000n,
      currency: 'KZT',
      status: options.invoiceStatus ?? 'payment_pending',
      paymentId: options.linkedPaymentId === undefined ? 'payment-1' : options.linkedPaymentId,
      periodStart: new Date('2026-12-01T00:00:00.000Z'),
      periodEnd: new Date('2027-01-01T00:00:00.000Z'),
      subscription: {
        id: 'subscription-1',
        ownerType: 'PARTNER',
        ownerId: 'center-1',
        plan: 'partner_branch_diagnostic_3d',
        status: 'pending_payment',
        periodEnd: options.subscriptionPeriodEnd ?? null,
      },
    };
    const calls: { invoiceUpdate?: any; subscriptionUpdate?: any; revenue?: any } = {};
    const tx: any = {
      $queryRaw: async () => [],
      partnerBranchSubscriptionInvoice: {
        findUnique: async () => invoice,
        update: async ({ data }: any) => {
          calls.invoiceUpdate = data;
          Object.assign(invoice, data);
          return invoice;
        },
      },
      subscription: {
        update: async ({ data }: any) => {
          calls.subscriptionUpdate = data;
          Object.assign(invoice.subscription, data);
          return invoice.subscription;
        },
      },
      revenue: {
        create: async ({ data }: any) => {
          calls.revenue = data;
          return { id: 'revenue-1', ...data };
        },
      },
    };
    return { tx, invoice, calls };
  }

  it('marks the invoice paid, activates its scheduled subscription period and records distinct platform revenue', async () => {
    const { tx, invoice, calls } = makeSettlementDb();
    const { settlePartnerBranchSubscriptionInvoicePayment } = await import('./partnerBranchBilling.service.js');
    const settled = await settlePartnerBranchSubscriptionInvoicePayment({
      id: 'payment-1',
      refId: invoice.id,
      amount: 4_990_000n,
      currency: 'KZT',
    }, tx);

    expect(settled).toBe(true);
    expect(calls.invoiceUpdate).toMatchObject({
      status: 'paid',
      paymentId: 'payment-1',
    });
    expect(calls.invoiceUpdate.paidAt).toBeInstanceOf(Date);
    expect(calls.subscriptionUpdate).toMatchObject({
      plan: 'partner_branch_diagnostic_3d',
      status: 'scheduled',
      periodEnd: invoice.periodEnd,
    });
    expect(calls.revenue).toMatchObject({
      tenantId: 'platform',
      source: 'PARTNER_BRANCH_SUBSCRIPTION',
      amount: 4_990_000n,
      meta: {
        refType: 'partner_branch_subscription_invoice',
        refId: invoice.id,
      },
    });
  });

  it('keeps an existing active period when the next paid invoice is settled in advance', async () => {
    const currentPeriodEnd = new Date('2027-01-01T00:00:00.000Z');
    const nextPeriodEnd = new Date('2027-02-01T00:00:00.000Z');
    const { tx, invoice, calls } = makeSettlementDb({ subscriptionPeriodEnd: currentPeriodEnd });
    invoice.periodStart = currentPeriodEnd;
    invoice.periodEnd = nextPeriodEnd;
    const { settlePartnerBranchSubscriptionInvoicePayment } = await import('./partnerBranchBilling.service.js');
    await settlePartnerBranchSubscriptionInvoicePayment({
      id: 'payment-1',
      refId: invoice.id,
      amount: invoice.amountMinor,
      currency: 'KZT',
    }, tx);
    expect(calls.subscriptionUpdate).toMatchObject({ status: 'active', periodEnd: nextPeriodEnd });
  });

  it('rejects amount tampering without changing invoice, subscription or revenue', async () => {
    const { tx, calls } = makeSettlementDb();
    const { settlePartnerBranchSubscriptionInvoicePayment } = await import('./partnerBranchBilling.service.js');
    await expect(settlePartnerBranchSubscriptionInvoicePayment({
      id: 'payment-1',
      refId: 'partner-invoice-1',
      amount: 4_989_999n,
      currency: 'KZT',
    }, tx)).rejects.toMatchObject({ code: 'INVALID_PERIOD' });
    expect(calls.invoiceUpdate).toBeUndefined();
    expect(calls.subscriptionUpdate).toBeUndefined();
    expect(calls.revenue).toBeUndefined();
  });

  it('rejects a different payment from the one reserved on the invoice', async () => {
    const { tx, calls } = makeSettlementDb({ linkedPaymentId: 'payment-expected' });
    const { settlePartnerBranchSubscriptionInvoicePayment } = await import('./partnerBranchBilling.service.js');
    await expect(settlePartnerBranchSubscriptionInvoicePayment({
      id: 'payment-attacker',
      refId: 'partner-invoice-1',
      amount: 4_990_000n,
      currency: 'KZT',
    }, tx)).rejects.toMatchObject({ code: 'BILLING_PERIOD_OVERLAP' });
    expect(calls.invoiceUpdate).toBeUndefined();
    expect(calls.revenue).toBeUndefined();
  });

  it('is idempotent when the same payment already settled the invoice', async () => {
    const { tx, calls } = makeSettlementDb({ invoiceStatus: 'paid', linkedPaymentId: 'payment-1' });
    const { settlePartnerBranchSubscriptionInvoicePayment } = await import('./partnerBranchBilling.service.js');
    const result = await settlePartnerBranchSubscriptionInvoicePayment({
      id: 'payment-1',
      refId: 'partner-invoice-1',
      amount: 4_990_000n,
      currency: 'KZT',
    }, tx);
    expect(result).toBe(true);
    expect(calls.invoiceUpdate).toBeUndefined();
    expect(calls.revenue).toBeUndefined();
  });

  it('reopens only the invoice linked to the exact failed or expired payment', async () => {
    const { tx, invoice, calls } = makeSettlementDb();
    const { releasePartnerBranchSubscriptionInvoicePayment } = await import('./partnerBranchBilling.service.js');
    const released = await releasePartnerBranchSubscriptionInvoicePayment({
      invoiceId: invoice.id, paymentId: 'payment-1',
    }, tx);
    expect(released).toBe(true);
    expect(calls.invoiceUpdate).toEqual({ status: 'issued', paymentId: null });

    invoice.status = 'payment_pending';
    invoice.paymentId = 'payment-new';
    const stale = await releasePartnerBranchSubscriptionInvoicePayment({
      invoiceId: invoice.id, paymentId: 'payment-old',
    }, tx);
    expect(stale).toBe(false);
  });
});
