import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const transactions = new Map<string, any>();
  let findFirstBarrier: Promise<void> | null = null;
  let releaseFindFirst: (() => void) | null = null;
  let waitingFindFirst = 0;

  const ruleRow = {
    domain: 'DIAGNOSTIC_3D',
    percentBps: 700,
    splitJson: {
      economicsVersion: 1,
      effectiveFrom: '2026-09-11T00:00:00.000Z',
      minFeeMinor: '50000',
      maxFeeMinor: '300000',
      subscriptionMinor: '4990000',
    },
  };

  const db = {
    $executeRaw: vi.fn(async () => 0),
    commissionRule: {
      findFirst: vi.fn(async () => ruleRow),
      create: vi.fn(async () => ruleRow),
    },
    transaction: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.type === 'partner_economics' && findFirstBarrier) {
          waitingFindFirst += 1;
          if (waitingFindFirst === 2) releaseFindFirst?.();
          await findFirstBarrier;
        }
        return transactions.get(where.refId) ?? null;
      }),
      findMany: vi.fn(async () => Array.from(transactions.values())),
      create: vi.fn(async ({ data }: any) => {
        if (transactions.has(data.refId)) throw new Error('Unique constraint failed on transaction.id');
        transactions.set(data.refId, data);
        return data;
      }),
    },
  };

  return {
    db,
    transactions,
    ruleRow,
    enableFindFirstRace() {
      waitingFindFirst = 0;
      findFirstBarrier = new Promise<void>((resolve) => { releaseFindFirst = resolve; });
    },
    disableFindFirstRace() {
      findFirstBarrier = null;
      releaseFindFirst = null;
      waitingFindFirst = 0;
    },
  };
});

vi.mock('../../lib/prisma.js', () => ({ default: state.db }));

const { recordPartnerEconomics } = await import('./partner-economics.service.js');

describe('partner economics ledger concurrency', () => {
  beforeEach(() => {
    state.transactions.clear();
    state.ruleRow.percentBps = 700;
    state.disableFindFirstRace();
    vi.clearAllMocks();
  });

  it('returns one durable transaction when the same operation races concurrently', async () => {
    state.enableFindFirstRace();

    const [first, second] = await Promise.all([
      recordPartnerEconomics({
        vertical: 'DIAGNOSTIC_3D',
        partnerId: 'center-1',
        grossMinor: 1_000_000n,
        operationId: 'referral-race-1',
      }, state.db as any),
      recordPartnerEconomics({
        vertical: 'DIAGNOSTIC_3D',
        partnerId: 'center-1',
        grossMinor: 1_000_000n,
        operationId: 'referral-race-1',
      }, state.db as any),
    ]);

    expect(state.transactions.size).toBe(1);
    expect(first.id).toBe(second.id);
    expect(first.meta).toMatchObject({
      kind: 'partner_economics',
      economicsVersion: 1,
      commissionMinor: '70000',
      status: 'HEALTHY',
    });
  });

  it('keeps the applied rule snapshot immutable when the current rule changes later', async () => {
    const first = await recordPartnerEconomics({
      vertical: 'DIAGNOSTIC_3D',
      partnerId: 'center-1',
      grossMinor: 1_000_000n,
      operationId: 'referral-version-1',
    }, state.db as any);

    state.ruleRow.percentBps = 900;

    const second = await recordPartnerEconomics({
      vertical: 'DIAGNOSTIC_3D',
      partnerId: 'center-1',
      grossMinor: 1_000_000n,
      operationId: 'referral-version-2',
    }, state.db as any);

    expect((first.meta as any).rule.percentBps).toBe(700);
    expect((second.meta as any).rule.percentBps).toBe(900);
    expect((first.meta as any).commissionMinor).toBe('70000');
    expect((second.meta as any).commissionMinor).toBe('90000');
  });
});
