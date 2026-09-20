import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, availableBalanceMinorMock, withJobLockMock } = vi.hoisted(() => ({
  prismaMock: {
    wallet: { findMany: vi.fn() },
    payout: { findFirst: vi.fn() },
    notification: { findFirst: vi.fn(), create: vi.fn() },
    lecturer: { findUnique: vi.fn() },
    supplierMember: { findMany: vi.fn() },
  },
  availableBalanceMinorMock: vi.fn(),
  withJobLockMock: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ default: prismaMock }));
vi.mock('../modules/finance/payout.service.js', () => ({ availableBalanceMinor: availableBalanceMinorMock }));
vi.mock('../lib/jobLock.js', () => ({ withJobLock: withJobLockMock }));
vi.mock('../lib/helpers.js', () => ({ uid: vi.fn(() => 'notification-1') }));

const { runPayoutReadinessCron, startPayoutReadinessCronInterval } = await import('./payoutReadinessCron.js');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.wallet.findMany.mockResolvedValue([]);
  prismaMock.payout.findFirst.mockResolvedValue(null);
  prismaMock.notification.findFirst.mockResolvedValue(null);
  prismaMock.notification.create.mockResolvedValue({ id: 'notification-1' });
  prismaMock.lecturer.findUnique.mockResolvedValue({ userId: 'user-1' });
  prismaMock.supplierMember.findMany.mockResolvedValue([]);
  availableBalanceMinorMock.mockResolvedValue(0n);
});

describe('payout readiness cron', () => {
  it('notifies a lecturer once when funds are available and no payout is pending', async () => {
    prismaMock.wallet.findMany.mockResolvedValue([
      { id: 'wallet-1', ownerType: 'LECTURER', ownerId: 'lect-1', currency: 'KZT' },
    ]);
    availableBalanceMinorMock.mockResolvedValue(125_000n);

    const result = await runPayoutReadinessCron();

    expect(result).toEqual({ scanned: 1, notified: 1 });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'payout',
        title: 'Средства доступны к выплате',
      }),
    }));
  });

  it('does not notify when an open payout already holds the available funds', async () => {
    prismaMock.wallet.findMany.mockResolvedValue([
      { id: 'wallet-1', ownerType: 'LECTURER', ownerId: 'lect-1', currency: 'KZT' },
    ]);
    availableBalanceMinorMock.mockResolvedValue(125_000n);
    prismaMock.payout.findFirst.mockResolvedValue({ id: 'payout-1' });

    const result = await runPayoutReadinessCron();

    expect(result).toEqual({ scanned: 1, notified: 0 });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('deduplicates a notification already sent in the previous 24 hours', async () => {
    prismaMock.wallet.findMany.mockResolvedValue([
      { id: 'wallet-1', ownerType: 'LECTURER', ownerId: 'lect-1', currency: 'KZT' },
    ]);
    availableBalanceMinorMock.mockResolvedValue(125_000n);
    prismaMock.notification.findFirst.mockResolvedValue({ id: 'existing-notification' });

    const result = await runPayoutReadinessCron();

    expect(result).toEqual({ scanned: 1, notified: 0 });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('resolves supplier members and notifies each member', async () => {
    prismaMock.wallet.findMany.mockResolvedValue([
      { id: 'wallet-2', ownerType: 'SUPPLIER', ownerId: 'supplier-1', currency: 'KZT' },
    ]);
    availableBalanceMinorMock.mockResolvedValue(300_000n);
    prismaMock.supplierMember.findMany.mockResolvedValue([{ userId: 'user-a' }, { userId: 'user-b' }]);

    const result = await runPayoutReadinessCron();

    expect(result).toEqual({ scanned: 1, notified: 2 });
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
  });

  it('uses the durable job lock when the interval tick runs', async () => {
    withJobLockMock.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: TimerHandler) => {
      if (typeof fn === 'function') void fn();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
    const intervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(((fn: TimerHandler) => {
      if (typeof fn === 'function') void fn();
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval);

    startPayoutReadinessCronInterval(60_000);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(withJobLockMock).toHaveBeenCalledWith('payout_readiness_cron', expect.any(Function));
    setTimeoutSpy.mockRestore();
    intervalSpy.mockRestore();
  });
});
