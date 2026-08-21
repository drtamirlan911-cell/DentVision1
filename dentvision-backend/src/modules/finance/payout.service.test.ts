import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * The two properties that matter, both of which were false before this service
 * existed:
 *
 * **1. The same funds cannot be requested twice.** Both workspaces compared the
 * raw `wallet.balance` and wrote the row. A lecturer holding 100 000 could
 * request 100 000 as many times as they liked — each request passed on its own.
 * A payout is now checked against balance *minus* everything already requested
 * and unresolved.
 *
 * **2. Money moves as balanced double-entry, and only on payment.** The finance
 * module's one asserted invariant is that all wallet balances sum to zero
 * (`ledgerNetBalance`). A payout that decremented a wallet without a matching
 * credit would break it silently, and nothing else in the system checks.
 */

const { tx, prismaMock } = vi.hoisted(() => {
  const delegate = () => ({
    wallet: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    payout: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn() },
    lecturer: { findUnique: vi.fn() },
    supplierMember: { findMany: vi.fn() },
    notification: { create: vi.fn() },
  });
  const tx = delegate();
  const prismaMock = {
    ...delegate(),
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
  };
  return { tx, prismaMock };
});

vi.mock('../../lib/prisma.js', () => ({ default: prismaMock }));

const {
  PAYOUT_TRANSITIONS,
  PayoutError,
  availableBalanceMinor,
  requestPayout,
  transitionPayout,
} = await import('./payout.service.js');

/** A wallet holding `balance`, with `pending` already claimed against it. */
function walletHolding(balance: bigint, pending: bigint[] = []) {
  tx.wallet.findUnique.mockResolvedValue({
    id: 'w1',
    balance,
    currency: 'KZT',
    ownerType: 'LECTURER',
    ownerId: 'lect-1',
  });
  tx.payout.findMany.mockResolvedValue(pending.map((amount) => ({ amount })));
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.payout.create.mockImplementation(async ({ data }: never) => ({ id: 'p1', ...(data as object) }));
  tx.payout.update.mockImplementation(async ({ data }: never) => ({ id: 'p1', ...(data as object) }));
  tx.wallet.create.mockResolvedValue({ id: 'w1', balance: 0n, currency: 'KZT' });
  tx.transaction.create.mockResolvedValue({ id: 't1' });
  tx.wallet.update.mockResolvedValue({});
});

describe('available balance is the balance minus what is already claimed', () => {
  it('is the whole balance when nothing is pending', async () => {
    walletHolding(100_000n);
    expect(await availableBalanceMinor('w1', tx as never)).toBe(100_000n);
  });

  it('subtracts requests that are still open', async () => {
    walletHolding(100_000n, [30_000n, 20_000n]);
    expect(await availableBalanceMinor('w1', tx as never)).toBe(50_000n);
  });

  it('can go to zero once everything is spoken for', async () => {
    walletHolding(100_000n, [100_000n]);
    expect(await availableBalanceMinor('w1', tx as never)).toBe(0n);
  });

  it('reports zero for a wallet that does not exist rather than throwing', async () => {
    tx.wallet.findUnique.mockResolvedValue(null);
    tx.payout.findMany.mockResolvedValue([]);
    expect(await availableBalanceMinor('missing', tx as never)).toBe(0n);
  });
});

describe('the same money cannot be requested twice', () => {
  it('accepts a request within the available balance', async () => {
    walletHolding(100_000n);
    await expect(
      requestPayout({ ownerType: 'LECTURER', ownerId: 'lect-1', amountMinor: 100_000n }),
    ).resolves.toMatchObject({ status: 'requested', amount: 100_000n });
  });

  it('refuses a second request for money already asked for', async () => {
    // This is the exact case that used to succeed: the balance still reads
    // 100 000 because nothing debits it until the payout is paid.
    walletHolding(100_000n, [100_000n]);
    await expect(
      requestPayout({ ownerType: 'LECTURER', ownerId: 'lect-1', amountMinor: 100_000n }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    expect(tx.payout.create).not.toHaveBeenCalled();
  });

  it('refuses the part that exceeds what is left', async () => {
    walletHolding(100_000n, [70_000n]);
    await expect(
      requestPayout({ ownerType: 'LECTURER', ownerId: 'lect-1', amountMinor: 40_000n }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });

  it.each([[0n], [-1n]])('refuses a non-positive amount (%s)', async (amount) => {
    await expect(
      requestPayout({ ownerType: 'LECTURER', ownerId: 'lect-1', amountMinor: amount }),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });
});

describe('the state machine', () => {
  function payoutAt(status: string, balance = 100_000n) {
    tx.payout.findUnique.mockResolvedValue({
      id: 'p1',
      walletId: 'w1',
      amount: 50_000n,
      status,
      wallet: { id: 'w1', balance, currency: 'KZT' },
    });
  }

  it('allows the moves it declares', async () => {
    expect(PAYOUT_TRANSITIONS.requested).toEqual(['approved', 'rejected']);
    expect(PAYOUT_TRANSITIONS.approved).toEqual(['paid', 'rejected']);
  });

  it('treats paid and rejected as terminal, so a payout cannot pay twice', async () => {
    expect(PAYOUT_TRANSITIONS.paid).toEqual([]);
    expect(PAYOUT_TRANSITIONS.rejected).toEqual([]);

    payoutAt('paid');
    await expect(transitionPayout('p1', 'paid')).rejects.toMatchObject({ code: 'BAD_TRANSITION' });
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('refuses to skip approval', async () => {
    payoutAt('requested');
    await expect(transitionPayout('p1', 'paid')).rejects.toMatchObject({ code: 'BAD_TRANSITION' });
  });

  it('reports a missing payout rather than inventing one', async () => {
    tx.payout.findUnique.mockResolvedValue(null);
    await expect(transitionPayout('nope', 'approved')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('moves money on no transition but "paid"', async () => {
    payoutAt('requested');
    await transitionPayout('p1', 'approved');
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();

    payoutAt('requested');
    await transitionPayout('p1', 'rejected');
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });
});

describe('paying out keeps the ledger balanced', () => {
  beforeEach(() => {
    tx.payout.findUnique.mockResolvedValue({
      id: 'p1',
      walletId: 'w1',
      amount: 50_000n,
      status: 'approved',
      wallet: { id: 'w1', balance: 100_000n, currency: 'KZT' },
    });
    // getOrCreateWallet('GATEWAY', 'system') resolves through the same client.
    tx.wallet.findUnique.mockResolvedValue({ id: 'gw', balance: 0n, currency: 'KZT' });
  });

  it('writes one debit and one credit of the same amount', async () => {
    await transitionPayout('p1', 'paid');

    const entries = tx.transaction.create.mock.calls[0][0].data.ledgerEntries.create;
    expect(entries).toHaveLength(2);

    const debit = entries.find((e: { direction: string }) => e.direction === 'debit');
    const credit = entries.find((e: { direction: string }) => e.direction === 'credit');
    expect(debit.amount).toBe(50_000n);
    expect(credit.amount).toBe(50_000n);
    // The payer is the wallet being emptied — the mirror of a sale, where
    // GATEWAY is debited and the seller credited.
    expect(debit.walletId).toBe('w1');
    expect(credit.walletId).toBe('gw');
  });

  it('moves both balances by the same amount, so the net stays zero', async () => {
    await transitionPayout('p1', 'paid');

    const updates = tx.wallet.update.mock.calls.map((c: never[]) => c[0]);
    const seller = updates.find((u: { where: { id: string } }) => u.where.id === 'w1');
    const gateway = updates.find((u: { where: { id: string } }) => u.where.id === 'gw');
    expect(seller.data.balance.decrement).toBe(50_000n);
    expect(gateway.data.balance.increment).toBe(50_000n);
  });

  it('records the payout against its own id, so it can be reconciled', async () => {
    await transitionPayout('p1', 'paid');
    const data = tx.transaction.create.mock.calls[0][0].data;
    expect(data.type).toBe('payout');
    expect(data.refType).toBe('payout');
    expect(data.refId).toBe('p1');
  });

  it('re-checks the balance at payment, not just at request', async () => {
    // The wallet can be emptied between asking and being paid.
    tx.payout.findUnique.mockResolvedValue({
      id: 'p1',
      walletId: 'w1',
      amount: 50_000n,
      status: 'approved',
      wallet: { id: 'w1', balance: 10_000n, currency: 'KZT' },
    });
    await expect(transitionPayout('p1', 'paid')).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
    });
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('does all of it inside one transaction', async () => {
    await transitionPayout('p1', 'paid');
    expect(prismaMock.$transaction).toHaveBeenCalled();
    // Never through the module singleton: a half-applied payout is money lost.
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });
});

describe('notifies the requester on every transition', () => {
  function payoutAt(status: string, ownerType: 'LECTURER' | 'SUPPLIER', ownerId = 'owner-1', balance = 100_000n) {
    tx.payout.findUnique.mockResolvedValue({
      id: 'p1',
      walletId: 'w1',
      amount: 50_000n,
      status,
      wallet: { id: 'w1', balance, currency: 'KZT', ownerType, ownerId },
    });
    // getOrCreateWallet('GATEWAY', 'system') for the 'paid' path.
    tx.wallet.findUnique.mockResolvedValue({ id: 'gw', balance: 0n, currency: 'KZT' });
  }

  it('notifies a lecturer\'s single linked user on approval', async () => {
    payoutAt('requested', 'LECTURER', 'lect-1');
    tx.lecturer.findUnique.mockResolvedValue({ userId: 'user-1' });

    await transitionPayout('p1', 'approved');

    expect(tx.lecturer.findUnique).toHaveBeenCalledWith({ where: { id: 'lect-1' }, select: { userId: true } });
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'payout',
        title: 'Заявка на выплату одобрена',
        message: expect.stringContaining('500'), // 50_000 minor = 500 KZT
      }),
    });
  });

  it('notifies every linked member of a supplier, not just one', async () => {
    payoutAt('requested', 'SUPPLIER', 'sup-1');
    tx.supplierMember.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);

    await transitionPayout('p1', 'rejected');

    expect(tx.supplierMember.findMany).toHaveBeenCalledWith({ where: { supplierId: 'sup-1' }, select: { userId: true } });
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', title: 'Заявка на выплату отклонена' }),
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u2', title: 'Заявка на выплату отклонена' }),
    });
  });

  it('sends the paid-out message when money actually leaves', async () => {
    payoutAt('approved', 'LECTURER', 'lect-1');
    tx.lecturer.findUnique.mockResolvedValue({ userId: 'user-1' });

    await transitionPayout('p1', 'paid');

    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: 'Выплата произведена' }),
    });
  });

  it('does not throw or notify when the lecturer has no linked user', async () => {
    payoutAt('requested', 'LECTURER', 'lect-orphan');
    tx.lecturer.findUnique.mockResolvedValue(null);

    await expect(transitionPayout('p1', 'approved')).resolves.toBeDefined();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});
