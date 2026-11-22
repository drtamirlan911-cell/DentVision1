import { describe, expect, it } from 'vitest';

import {
  issuePartnerBranchSubscriptionInvoice,
  PartnerBranchBillingError,
  resolvePartnerBranchBillingVertical,
} from './partnerBranchBilling.service.js';

const periodStart = new Date('2026-12-01T00:00:00.000Z');
const periodEnd = new Date('2027-01-01T00:00:00.000Z');

function makeDb(options: {
  organization?: any;
  active?: boolean;
  branches?: Array<{ id: string }>;
  subscription?: any;
  existingInvoice?: any;
  overlappingInvoice?: any;
} = {}) {
  const created: { subscription?: any; invoice?: any } = {};
  const organization = options.organization ?? {
    id: 'org-center-1',
    type: 'DIAGNOSTIC_CENTER',
    originalType: 'DiagnosticCenter',
    originalId: 'center-1',
    settings: { ecosystemVisible: true },
  };
  const active = options.active ?? true;
  const tx: any = {
    $executeRaw: async () => undefined,
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

describe('partner branch invoice issuance', () => {
  it('creates an immutable invoice using active branch snapshots and KZT minor units', async () => {
    const { tx, created } = makeDb();
    const result = await issuePartnerBranchSubscriptionInvoice({
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
    await issuePartnerBranchSubscriptionInvoice({
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
      settings: { laboratoryType: 'DENTAL_LAB', selfServiceType: 'dental_lab', lifecycle: 'ACTIVE', verification: 'VERIFIED', ecosystemVisible: true, legal: { status: 'READY' } },
    };
    const { tx, created } = makeDb({ organization, branches: [{ id: 'lab-branch' }] });
    await issuePartnerBranchSubscriptionInvoice({
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
    await expect(issuePartnerBranchSubscriptionInvoice({
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
    const result = await issuePartnerBranchSubscriptionInvoice({
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
    await expect(issuePartnerBranchSubscriptionInvoice({
      organizationId: 'org-center-1',
      periodStart,
      periodEnd: new Date('2027-01-15T00:00:00.000Z'),
    }, tx)).rejects.toMatchObject({ code: 'BILLING_PERIOD_OVERLAP' });
  });

  it('rejects invalid or reversed billing periods', async () => {
    const { tx } = makeDb();
    await expect(issuePartnerBranchSubscriptionInvoice({
      organizationId: 'org-center-1',
      periodStart,
      periodEnd: periodStart,
    }, tx)).rejects.toMatchObject({ code: 'INVALID_PERIOD' });
  });
});
