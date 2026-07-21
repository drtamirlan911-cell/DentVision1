import prisma from '../../lib/prisma.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import { balancedTransfer, getOrCreateUserDentWallet } from './wallet.service.js';

/**
 * Spend DentCash at checkout. Debits USER wallet, credits PLATFORM holding
 * (internal currency burned into order discount — platform absorbs as contra).
 * Returns amount actually spent (capped by balance and payable).
 */
export async function spendDentCash(opts: {
  userId: string;
  amountMinor: bigint;
  payableMinor: bigint;
  refType: string;
  refId: string;
}) {
  if (opts.amountMinor <= 0n) return 0n;

  const wallet = await getOrCreateUserDentWallet(opts.userId);
  const want = opts.amountMinor > opts.payableMinor ? opts.payableMinor : opts.amountMinor;
  const spend = want > wallet.balance ? wallet.balance : want;
  if (spend <= 0n) return 0n;

  const platform = await getOrCreateWallet('PLATFORM', 'system');

  await balancedTransfer({
    type: 'dentcash_spend',
    amountMinor: spend,
    fromWalletId: wallet.id,
    toWalletId: platform.id,
    refType: opts.refType,
    refId: opts.refId,
    meta: { channel: 'checkout' },
  });

  await prisma.dentCashLedger.create({
    data: {
      userId: opts.userId,
      type: 'spend',
      status: 'spent',
      amountMinor: spend,
      refType: opts.refType,
      refId: opts.refId,
      meta: { payableMinor: opts.payableMinor.toString() },
    },
  });

  return spend;
}
