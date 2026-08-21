import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * The property under test: `recordSaleTx` must write exclusively through the
 * `db` client it is given, never through the module-level `prisma` singleton
 * — that's what lets it be called from inside a caller's already-open
 * `prisma.$transaction(...)` without breaking atomicity (the bug this file
 * exists to prevent a regression of: settlePaidPayment used to call
 * `recordSale`, which opened its own independent transaction, so money moved
 * even when the caller's outer transaction later rolled back).
 */

const {
  txDelegate,
  globalWalletFindUnique,
  globalWalletCreate,
  globalCommissionFindUnique,
  globalCommissionFindFirst,
  globalTransactionCreate,
  globalWalletUpdate,
  globalRevenueCreate,
  globalTransactionFn,
} = vi.hoisted(() => {
  const makeDelegate = () => ({
    wallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    commissionRule: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    revenue: {
      create: vi.fn(),
    },
  });
  const txDelegate = makeDelegate();
  return {
    txDelegate,
    globalWalletFindUnique: vi.fn(),
    globalWalletCreate: vi.fn(),
    globalCommissionFindUnique: vi.fn(),
    globalCommissionFindFirst: vi.fn(),
    globalTransactionCreate: vi.fn(),
    globalWalletUpdate: vi.fn(),
    globalRevenueCreate: vi.fn(),
    globalTransactionFn: vi.fn((cb: (tx: unknown) => unknown) => cb(txDelegate)),
  };
});

vi.mock('../../lib/prisma.js', () => ({
  default: {
    wallet: {
      findUnique: globalWalletFindUnique,
      create: globalWalletCreate,
      update: globalWalletUpdate,
    },
    commissionRule: {
      findUnique: globalCommissionFindUnique,
      findFirst: globalCommissionFindFirst,
    },
    transaction: {
      create: globalTransactionCreate,
    },
    revenue: {
      create: globalRevenueCreate,
    },
    $transaction: globalTransactionFn,
  },
}));

import { recordSale, recordSaleTx, getOrCreateWallet, resolveCommissionBps } from './finance.service.js';

function wallet(id: string, ownerType: string, ownerId: string) {
  return { id, ownerType, ownerId, currency: 'KZT', balance: 0n };
}

beforeEach(() => {
  vi.clearAllMocks();
  // No commission rule configured — falls back to the 10% default.
  txDelegate.commissionRule.findUnique.mockResolvedValue(null);
  txDelegate.commissionRule.findFirst.mockResolvedValue(null);
  globalCommissionFindUnique.mockResolvedValue(null);
  globalCommissionFindFirst.mockResolvedValue(null);
});

describe('recordSaleTx', () => {
  it('writes only through the passed db, never through the global prisma client', async () => {
    txDelegate.wallet.findUnique
      .mockResolvedValueOnce(wallet('gw', 'GATEWAY', 'system'))
      .mockResolvedValueOnce(wallet('sw', 'SUPPLIER', 'sup-1'))
      .mockResolvedValueOnce(wallet('pw', 'PLATFORM', 'system'));
    txDelegate.transaction.create.mockResolvedValueOnce({ id: 'txn-1', amount: 10_000n });

    const result = await recordSaleTx(
      {
        domain: 'shop',
        sellerType: 'SUPPLIER' as never,
        sellerId: 'sup-1',
        amountMinor: 10_000n,
        refType: 'order',
        refId: 'order-1',
      },
      txDelegate as never,
    );

    expect(result).toEqual({ id: 'txn-1', amount: 10_000n });
    expect(txDelegate.transaction.create).toHaveBeenCalledTimes(1);
    expect(txDelegate.wallet.update).toHaveBeenCalledTimes(3);
    expect(txDelegate.revenue.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'platform',
        source: 'SHOP',
        amount: 10_000n,
        meta: { refType: 'order', refId: 'order-1' },
      },
    });

    // Nothing touched the global prisma client.
    expect(globalWalletFindUnique).not.toHaveBeenCalled();
    expect(globalWalletCreate).not.toHaveBeenCalled();
    expect(globalTransactionCreate).not.toHaveBeenCalled();
    expect(globalWalletUpdate).not.toHaveBeenCalled();
    expect(globalRevenueCreate).not.toHaveBeenCalled();
    expect(globalTransactionFn).not.toHaveBeenCalled();
  });

  it('splits amount into net/commission using the passed db for the commission rule lookup', async () => {
    txDelegate.commissionRule.findUnique.mockResolvedValueOnce({ percentBps: 500 }); // 5%
    txDelegate.wallet.findUnique
      .mockResolvedValueOnce(wallet('gw', 'GATEWAY', 'system'))
      .mockResolvedValueOnce(wallet('sw', 'SUPPLIER', 'sup-1'))
      .mockResolvedValueOnce(wallet('pw', 'PLATFORM', 'system'));
    txDelegate.transaction.create.mockImplementationOnce(async (args: any) => ({
      id: 'txn-2',
      meta: args.data.meta,
    }));

    const result: any = await recordSaleTx(
      {
        domain: 'shop',
        sellerType: 'SUPPLIER' as never,
        sellerId: 'sup-1',
        amountMinor: 10_000n,
      },
      txDelegate as never,
    );

    expect(result.meta.commission).toBe('500');
    expect(result.meta.net).toBe('9500');
    expect(txDelegate.commissionRule.findUnique).toHaveBeenCalledWith({
      where: { domain_scopeId: { domain: 'shop', scopeId: 'sup-1' } },
    });
    expect(globalCommissionFindUnique).not.toHaveBeenCalled();
  });
});

describe('recordSale (standalone wrapper)', () => {
  it('opens its own transaction and runs recordSaleTx inside it', async () => {
    txDelegate.wallet.findUnique
      .mockResolvedValueOnce(wallet('gw', 'GATEWAY', 'system'))
      .mockResolvedValueOnce(wallet('sw', 'LECTURER', 'lect-1'))
      .mockResolvedValueOnce(wallet('pw', 'PLATFORM', 'system'));
    txDelegate.transaction.create.mockResolvedValueOnce({ id: 'txn-3' });

    const result = await recordSale({
      domain: 'school',
      sellerType: 'LECTURER' as never,
      sellerId: 'lect-1',
      amountMinor: 5_000n,
    });

    expect(globalTransactionFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'txn-3' });
    // The writes still land on the tx client the $transaction callback receives.
    expect(txDelegate.transaction.create).toHaveBeenCalledTimes(1);
  });
});

describe('getOrCreateWallet / resolveCommissionBps db threading', () => {
  it('getOrCreateWallet reads and creates through the passed db', async () => {
    txDelegate.wallet.findUnique.mockResolvedValueOnce(null);
    txDelegate.wallet.create.mockResolvedValueOnce(wallet('w1', 'SUPPLIER', 'sup-2'));

    const w = await getOrCreateWallet('SUPPLIER' as never, 'sup-2', 'KZT', txDelegate as never);

    expect(w.id).toBe('w1');
    expect(txDelegate.wallet.create).toHaveBeenCalledTimes(1);
    expect(globalWalletFindUnique).not.toHaveBeenCalled();
    expect(globalWalletCreate).not.toHaveBeenCalled();
  });

  it('resolveCommissionBps falls back to the default when no rule exists on the passed db', async () => {
    txDelegate.commissionRule.findUnique.mockResolvedValueOnce(null);
    txDelegate.commissionRule.findFirst.mockResolvedValueOnce(null);

    const bps = await resolveCommissionBps('shop', 'sup-3', txDelegate as never);

    expect(bps).toBe(1000);
    expect(globalCommissionFindUnique).not.toHaveBeenCalled();
    expect(globalCommissionFindFirst).not.toHaveBeenCalled();
  });
});
