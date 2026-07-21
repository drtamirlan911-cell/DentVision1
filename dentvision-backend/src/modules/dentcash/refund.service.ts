import prisma from '../../lib/prisma.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import { balancedTransfer, getOrCreateUserDentWallet } from './wallet.service.js';
import { refundDentCashSpend } from './spend.service.js';

/**
 * Reverse earn (+ spend) for a ref (order/payment).
 * - pending earn: mark reversed (no wallet move — pending never debited funder)
 * - available earn: debit USER → credit funder
 * - spent earn: clawback note
 * - spend: refund PLATFORM → USER
 */
export async function reverseCashback(opts: {
  refType: string;
  refId: string;
  reason?: string;
  /** When set, only reverse earn rows funded by this seller (spend still refunded). */
  sellerId?: string | null;
}) {
  const spendRefund = await refundDentCashSpend({
    refType: opts.refType,
    refId: opts.refId,
    reason: opts.reason || 'refund',
  });

  const earns = await prisma.dentCashLedger.findMany({
    where: {
      refType: opts.refType,
      refId: opts.refId,
      type: 'earn',
      status: { in: ['pending', 'available', 'spent'] },
      ...(opts.sellerId ? { sellerId: opts.sellerId } : {}),
    },
  });
  if (!earns.length) return { reversed: 0n, spendRefunded: spendRefund.refunded };

  let reversed = 0n;
  for (const row of earns) {
    const funderType = (row.sellerType || 'PLATFORM') as any;
    const funderId = row.sellerId || 'system';
    const funder = await getOrCreateWallet(funderType, funderId);

    if (row.status === 'pending') {
      // Pending earns are obligations only — no wallet movement to undo.
    } else if (row.status === 'available') {
      const userWallet = await getOrCreateUserDentWallet(row.userId);
      const claw = row.amountMinor > userWallet.balance ? userWallet.balance : row.amountMinor;
      if (claw > 0n) {
        await balancedTransfer({
          type: 'dentcash_clawback',
          amountMinor: claw,
          fromWalletId: userWallet.id,
          toWalletId: funder.id,
          refType: opts.refType,
          refId: opts.refId,
          meta: { reason: opts.reason || 'refund' },
        });
      }
      if (row.amountMinor > claw) {
        await prisma.dentCashLedger.create({
          data: {
            userId: row.userId,
            type: 'clawback',
            status: 'pending',
            amountMinor: row.amountMinor - claw,
            refType: opts.refType,
            refId: opts.refId,
            meta: { reason: 'insufficient_balance' },
          },
        });
      }
    } else {
      await prisma.dentCashLedger.create({
        data: {
          userId: row.userId,
          type: 'clawback',
          status: 'pending',
          amountMinor: row.amountMinor,
          refType: opts.refType,
          refId: opts.refId,
          meta: { reason: opts.reason || 'refund_after_spend' },
        },
      });
    }

    await prisma.dentCashLedger.update({
      where: { id: row.id },
      data: { status: 'reversed' },
    });
    await prisma.dentCashLedger.create({
      data: {
        userId: row.userId,
        type: 'clawback',
        status: 'reversed',
        amountMinor: row.amountMinor,
        refType: opts.refType,
        refId: opts.refId,
        meta: { reason: opts.reason || 'refund' },
      },
    });
    reversed += row.amountMinor;
  }

  return { reversed, spendRefunded: spendRefund.refunded };
}
