import { describe, expect, it, vi, beforeEach } from 'vitest';

const { ledgerFindMany, ledgerUpdateMany, refundSpend, getWallet, userWallet, transfer, ledgerCreate } = vi.hoisted(() => ({
  ledgerFindMany: vi.fn(),
  ledgerUpdateMany: vi.fn(),
  refundSpend: vi.fn(),
  getWallet: vi.fn(),
  userWallet: vi.fn(),
  transfer: vi.fn(),
  ledgerCreate: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({ default: {
  dentCashLedger: {
    findMany: ledgerFindMany,
    updateMany: ledgerUpdateMany,
    create: ledgerCreate,
  },
} }));
vi.mock('../finance/finance.service.js', () => ({ getOrCreateWallet: getWallet }));
vi.mock('./wallet.service.js', () => ({ balancedTransfer: transfer, getOrCreateUserDentWallet: userWallet }));
vi.mock('./spend.service.js', () => ({ refundDentCashSpend: refundSpend }));

describe('reverseCashback security invariants', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a refund when the authenticated caller does not own a ledger row', async () => {
    refundSpend.mockResolvedValue({ refunded: 0n });
    ledgerFindMany.mockResolvedValue([
      { id: 'earn-1', userId: 'victim', amountMinor: 100n, status: 'available', sellerId: 'seller', sellerType: 'SUPPLIER' },
    ]);
    const { reverseCashback } = await import('./refund.service.js');

    await expect(reverseCashback({ refType: 'order', refId: 'order-1', callerId: 'attacker' }))
      .rejects.toThrow('Refund denied');
    expect(ledgerUpdateMany).not.toHaveBeenCalled();
    expect(transfer).not.toHaveBeenCalled();
  });

  it('atomically claims an earn row before transferring funds', async () => {
    refundSpend.mockResolvedValue({ refunded: 0n });
    ledgerFindMany.mockResolvedValue([
      { id: 'earn-1', userId: 'buyer', amountMinor: 100n, status: 'available', sellerId: 'seller', sellerType: 'SUPPLIER' },
    ]);
    ledgerUpdateMany.mockResolvedValue({ count: 1 });
    getWallet.mockResolvedValue({ id: 'seller-wallet' });
    userWallet.mockResolvedValue({ id: 'buyer-wallet', balance: 100n });
    transfer.mockResolvedValue(undefined);
    ledgerCreate.mockResolvedValue({});
    const { reverseCashback } = await import('./refund.service.js');

    await reverseCashback({ refType: 'order', refId: 'order-1', callerId: 'buyer' });
    expect(ledgerUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'earn-1', status: 'available' },
      data: { status: 'reversed' },
    }));
    expect(transfer).toHaveBeenCalledTimes(1);
  });

  it('does not transfer when another concurrent refund already claimed the row', async () => {
    refundSpend.mockResolvedValue({ refunded: 0n });
    ledgerFindMany.mockResolvedValue([
      { id: 'earn-1', userId: 'buyer', amountMinor: 100n, status: 'available', sellerId: 'seller', sellerType: 'SUPPLIER' },
    ]);
    ledgerUpdateMany.mockResolvedValue({ count: 0 });
    const { reverseCashback } = await import('./refund.service.js');

    const result = await reverseCashback({ refType: 'order', refId: 'order-1', callerId: 'buyer' });
    expect(result.reversed).toBe(0n);
    expect(transfer).not.toHaveBeenCalled();
  });
});
