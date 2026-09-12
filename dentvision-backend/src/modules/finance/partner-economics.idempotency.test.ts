import { describe, expect, it, vi } from 'vitest';
import { recordPartnerEconomics } from './partner-economics.service.js';

function makeDb() {
  let stored: any = null;
  let creates = 0;

  const db: any = {
    $executeRaw: vi.fn(async () => 1),
    commissionRule: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({
        domain: data.domain,
        percentBps: data.percentBps,
        splitJson: data.splitJson,
      })),
    },
    transaction: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => stored),
      create: vi.fn(async ({ data }: any) => {
        creates += 1;
        if (creates > 1) throw new Error('unique constraint race');
        stored = data;
        return data;
      }),
    },
  };

  return { db, getStored: () => stored };
}

describe('partner economics ledger idempotency', () => {
  it('concurrent recording of one operation produces one durable transaction', async () => {
    const { db, getStored } = makeDb();
    const input = {
      vertical: 'DIAGNOSTIC_3D' as const,
      partnerId: 'center-1',
      grossMinor: 10_000n * 100n,
      operationId: 'ref-atomic-1',
    };

    const [first, second] = await Promise.all([
      recordPartnerEconomics(input, db),
      recordPartnerEconomics(input, db),
    ]);

    expect(first.id).toBe(second.id);
    expect(db.transaction.create).toHaveBeenCalledTimes(2);
    expect(getStored()?.refId).toBe('ref-atomic-1');
    expect(getStored()?.amount).toBe(1_000_000n);
  });
});
