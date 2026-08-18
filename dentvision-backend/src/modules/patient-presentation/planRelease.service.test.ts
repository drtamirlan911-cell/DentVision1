import { beforeEach, describe, expect, it, vi } from 'vitest';

const { planFindUnique, releaseCreate, releaseUpdateMany, releaseFindFirst, releaseFindUnique, releaseFindMany, transaction } =
  vi.hoisted(() => ({
    planFindUnique: vi.fn(),
    releaseCreate: vi.fn(),
    releaseUpdateMany: vi.fn(),
    releaseFindFirst: vi.fn(),
    releaseFindUnique: vi.fn(),
    releaseFindMany: vi.fn(),
    transaction: vi.fn(),
  }));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    treatmentPlan: { findUnique: planFindUnique },
    treatmentPlanRelease: {
      create: releaseCreate,
      updateMany: releaseUpdateMany,
      findFirst: releaseFindFirst,
      findUnique: releaseFindUnique,
      findMany: releaseFindMany,
    },
    $transaction: transaction,
  },
}));

import {
  PlanReleaseError,
  approveAndRelease,
  freezePlan,
  getPublishedRelease,
  hashSnapshot,
  listPublishedReleases,
  publishRelease,
  withdrawRelease,
} from './planRelease.service.js';

const PLAN_ITEMS = {
  diagnosis: 'K04.5',
  stages: [
    {
      title: 'Этап 1',
      items: [
        { serviceName: 'Лечение канала', price: 120_000, teeth: [16], qty: 1 },
        { serviceName: 'Коронка', price: 180_000, teeth: [16, 24], qty: 1 },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  // The transaction client is the same mock surface; the service must use the
  // client it is handed, not the global one.
  transaction.mockImplementation(async (fn: any) =>
    fn({
      treatmentPlanRelease: {
        create: releaseCreate,
        updateMany: releaseUpdateMany,
        findFirst: releaseFindFirst,
      },
    }),
  );
  releaseUpdateMany.mockResolvedValue({ count: 0 });
  releaseFindFirst.mockResolvedValue(null);
  releaseCreate.mockImplementation(async ({ data }: any) => ({ id: 'rel-1', ...data }));
});

describe('freezePlan', () => {
  it('totals the plan from its stages', () => {
    // 120 000 + (180 000 × 2 teeth)
    expect(freezePlan(PLAN_ITEMS).totalAmount).toBe(480_000);
  });

  it('carries the computed teeth and total into the snapshot', () => {
    const { snapshot } = freezePlan(PLAN_ITEMS);
    expect(snapshot.teeth).toEqual([16, 24]);
    expect(snapshot.totalBudget).toBe(480_000);
  });

  it('recovers a plan stored as a flat array, the shape the AI agent wrote', () => {
    const frozen = freezePlan([{ serviceName: 'Коронка', price: 180_000, teeth: [24], qty: 1 }]);
    expect(frozen.totalAmount).toBe(180_000);
    expect(frozen.snapshot.stages).toHaveLength(1);
  });
});

describe('hashSnapshot', () => {
  it('is stable across key order', () => {
    expect(hashSnapshot({ a: 1, b: 2 })).toBe(hashSnapshot({ b: 2, a: 1 }));
  });

  it('changes when a price changes', () => {
    const a = freezePlan(PLAN_ITEMS).snapshotHash;
    const b = freezePlan({
      ...PLAN_ITEMS,
      stages: [{ ...PLAN_ITEMS.stages[0], items: [{ serviceName: 'Лечение канала', price: 121_000, teeth: [16], qty: 1 }] }],
    }).snapshotHash;
    expect(a).not.toBe(b);
  });
});

describe('approveAndRelease', () => {
  function planExists(items: unknown = PLAN_ITEMS) {
    planFindUnique.mockResolvedValue({
      id: 'plan-1',
      title: 'План',
      items,
      patientId: 'pat-1',
      patient: { clinicId: 'clinic-1' },
    });
  }

  it('freezes the total rather than trusting the plan price column', async () => {
    planExists();
    const release = await approveAndRelease({ planId: 'plan-1', approvedByUserId: 'user-1' });
    expect(release.totalAmount).toBe(480_000);
    expect(release.snapshotHash).toHaveLength(64);
  });

  it('records who approved it and denormalises the clinic', async () => {
    planExists();
    const release = await approveAndRelease({ planId: 'plan-1', approvedByUserId: 'user-1', approvalNote: 'ок' });
    expect(release.approvedByUserId).toBe('user-1');
    expect(release.clinicId).toBe('clinic-1');
    expect(release.approvalNote).toBe('ок');
  });

  it('does not publish unless asked — approving and publishing are two decisions', async () => {
    planExists();
    const release = await approveAndRelease({ planId: 'plan-1', approvedByUserId: 'user-1' });
    expect(release.publishedAt).toBeNull();
  });

  it('publishes in the same call when the doctor has already previewed', async () => {
    planExists();
    const release = await approveAndRelease({ planId: 'plan-1', approvedByUserId: 'user-1', publish: true });
    expect(release.publishedAt).toBeInstanceOf(Date);
  });

  it('always sets an expiry — a quoted price is an offer', async () => {
    planExists();
    const release = await approveAndRelease({ planId: 'plan-1', approvedByUserId: 'user-1' });
    expect(release.expiresAt).toBeInstanceOf(Date);
    expect(release.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('supersedes the previous approved version before writing the new one', async () => {
    planExists();
    releaseFindFirst.mockResolvedValue({ version: 3 });
    const release = await approveAndRelease({ planId: 'plan-1', approvedByUserId: 'user-1' });
    expect(releaseUpdateMany).toHaveBeenCalledWith({
      where: { planId: 'plan-1', status: 'approved' },
      data: { status: 'superseded' },
    });
    expect(release.version).toBe(4);
  });

  it('refuses a plan with no priced work', async () => {
    planExists({ stages: [{ title: 'Этап 1', items: [] }] });
    await expect(approveAndRelease({ planId: 'plan-1', approvedByUserId: 'user-1' })).rejects.toThrow(PlanReleaseError);
    expect(releaseCreate).not.toHaveBeenCalled();
  });

  it('refuses a plan that does not exist', async () => {
    planFindUnique.mockResolvedValue(null);
    await expect(approveAndRelease({ planId: 'nope', approvedByUserId: 'user-1' })).rejects.toThrow(/не найден/);
  });
});

describe('publishRelease', () => {
  it('claims the row atomically, so a double click publishes once', async () => {
    releaseUpdateMany.mockResolvedValue({ count: 1 });
    releaseFindUnique.mockResolvedValue({ id: 'rel-1', publishedAt: new Date() });
    await publishRelease('rel-1');
    expect(releaseUpdateMany).toHaveBeenCalledWith({
      where: { id: 'rel-1', status: 'approved', publishedAt: null },
      data: { publishedAt: expect.any(Date) },
    });
  });

  it('is idempotent when it was already published', async () => {
    releaseUpdateMany.mockResolvedValue({ count: 0 });
    releaseFindUnique.mockResolvedValue({ id: 'rel-1', publishedAt: new Date() });
    await expect(publishRelease('rel-1')).resolves.toBeTruthy();
  });

  it('refuses to publish a superseded version', async () => {
    releaseUpdateMany.mockResolvedValue({ count: 0 });
    releaseFindUnique.mockResolvedValue({ id: 'rel-1', publishedAt: null, status: 'superseded' });
    await expect(publishRelease('rel-1')).rejects.toThrow(/больше не активна/);
  });
});

describe('withdrawRelease', () => {
  it('records who pulled it and why', async () => {
    releaseUpdateMany.mockResolvedValue({ count: 1 });
    releaseFindUnique.mockResolvedValue({ id: 'rel-1' });
    await withdrawRelease('rel-1', 'user-9', 'ошиблись в цене');
    expect(releaseUpdateMany).toHaveBeenCalledWith({
      where: { id: 'rel-1', status: 'approved' },
      data: expect.objectContaining({
        status: 'withdrawn',
        withdrawnByUserId: 'user-9',
        withdrawReason: 'ошиблись в цене',
      }),
    });
  });

  it('throws when there is no active release to withdraw', async () => {
    releaseUpdateMany.mockResolvedValue({ count: 0 });
    await expect(withdrawRelease('rel-1', 'user-9')).rejects.toThrow(PlanReleaseError);
  });
});

describe('the patient-facing reads are fail-closed', () => {
  it('getPublishedRelease demands approved, published and unexpired', async () => {
    releaseFindFirst.mockResolvedValue(null);
    await getPublishedRelease('pat-1');
    const where = releaseFindFirst.mock.calls[0][0].where;
    expect(where.patientId).toBe('pat-1');
    expect(where.status).toBe('approved');
    expect(where.publishedAt).toEqual({ not: null });
    // An expired release is treated as absent rather than shown with a stale price.
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });

  it('listPublishedReleases applies the same three conditions', async () => {
    releaseFindMany.mockResolvedValue([]);
    await listPublishedReleases('pat-1');
    const where = releaseFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ patientId: 'pat-1', status: 'approved', publishedAt: { not: null } });
    expect(where.OR).toBeTruthy();
  });

  it('never filters on status alone — a withdrawn release cannot slip through', async () => {
    releaseFindMany.mockResolvedValue([]);
    await listPublishedReleases('pat-1');
    const where = releaseFindMany.mock.calls[0][0].where;
    expect(where.status).toBe('approved');
    expect(where.publishedAt).toBeTruthy();
  });
});
