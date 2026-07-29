import { Router } from 'express';
import type { WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { serializeBigInt, tengeToMinor } from '../../lib/money.js';
import { getOrCreateWallet, recordSale, ledgerNetBalance } from './finance.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Finance Core (Phase 4, DENTVISION_V2_INTEGRATION_PLAN.md §6). Wallets, ledger,
// transactions and commission rules. Amounts are minor units (тиын) and returned
// as strings (BigInt) to stay JSON-safe.
export const financeRouter = Router();

financeRouter.use(authenticate);

const OWNER_TYPES = ['CLINIC', 'SUPPLIER', 'ACADEMY', 'LECTURER', 'PARTNER', 'PLATFORM', 'GATEWAY'];

// Wallet balance for an owner.
financeRouter.get('/wallets/:ownerType/:ownerId', async (req: AuthRequest, res) => {
  try {
    const ownerType = String(req.params.ownerType).toUpperCase();
    if (!OWNER_TYPES.includes(ownerType)) {
      return res.status(400).json({ ok: false, error: 'Некорректный тип владельца' } satisfies ApiResponse);
    }
    const wallet = await getOrCreateWallet(ownerType as WalletOwnerType, req.params.ownerId as string);
    return res.json({ ok: true, data: serializeBigInt(wallet) } satisfies ApiResponse);
  } catch (error) {
    console.error('Get wallet error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении кошелька' } satisfies ApiResponse);
  }
});

// Transactions list (platform).
financeRouter.get('/transactions', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const transactions = await prisma.transaction.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { ledgerEntries: true },
    });
    return res.json({ ok: true, data: serializeBigInt(transactions) } satisfies ApiResponse);
  } catch (error) {
    console.error('List transactions error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении транзакций' } satisfies ApiResponse);
  }
});

// Ledger integrity check (platform): net of all wallet balances must be 0.
financeRouter.get('/ledger/health', requirePermission('finance.manage'), async (_req, res) => {
  const net = await ledgerNetBalance();
  return res.json({ ok: true, data: { netBalance: net.toString(), balanced: net === 0n } } satisfies ApiResponse);
});

// Commission rules (platform).
financeRouter.post('/commission-rules', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { domain, scopeId, percentBps, splitJson } = req.body || {};
    if (!domain || percentBps === undefined) {
      return res.status(400).json({ ok: false, error: 'domain и percentBps обязательны' } satisfies ApiResponse);
    }
    const rule = await prisma.commissionRule.upsert({
      where: { domain_scopeId: { domain, scopeId: scopeId || null } },
      create: { domain, scopeId: scopeId || null, percentBps, splitJson: splitJson ?? undefined },
      update: { percentBps, splitJson: splitJson ?? undefined },
    });
    return res.status(201).json({ ok: true, data: rule } satisfies ApiResponse);
  } catch (error) {
    console.error('Commission rule error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании правила комиссии' } satisfies ApiResponse);
  }
});

// Record a sale (platform trigger for now; later wired into shop/school checkout).
// Body: { domain, sellerType, sellerId, amount (в тенге) | amountMinor, refId? }
financeRouter.post('/sales', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { domain, sellerType, sellerId, amount, amountMinor, refId, refType } = req.body || {};
    if (!domain || !sellerType || !sellerId || (amount === undefined && amountMinor === undefined)) {
      return res.status(400).json({
        ok: false,
        error: 'domain, sellerType, sellerId и amount обязательны',
      } satisfies ApiResponse);
    }
    if (!OWNER_TYPES.includes(String(sellerType).toUpperCase())) {
      return res.status(400).json({ ok: false, error: 'Некорректный sellerType' } satisfies ApiResponse);
    }
    const minor = amountMinor !== undefined ? BigInt(amountMinor) : tengeToMinor(Number(amount));
    if (minor <= 0n) {
      return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
    }
    const transaction = await recordSale({
      domain,
      sellerType: String(sellerType).toUpperCase() as WalletOwnerType,
      sellerId,
      amountMinor: minor,
      refType,
      refId,
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(transaction) } satisfies ApiResponse);
  } catch (error) {
    console.error('Record sale error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при проведении продажи' } satisfies ApiResponse);
  }
});

export default financeRouter;
