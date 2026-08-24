import { Router } from 'express';
import type { Prisma, WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { serializeBigInt, parseTengeToMinor } from '../../lib/money.js';
import type { ExpenseCategory } from '@prisma/client';
import { getOrCreateWallet, recordSale, ledgerNetBalance } from './finance.service.js';
import {
  PAYOUT_STATUSES,
  PayoutError,
  listPayouts,
  transitionPayout,
  type PayoutStatus,
} from './payout.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { auditFromReq } from '../compliance/audit.service.js';

// Finance Core (Phase 4, DENTVISION_V2_INTEGRATION_PLAN.md §6). Wallets, ledger,
// transactions and commission rules. Amounts are minor units (тиын) and returned
// as strings (BigInt) to stay JSON-safe.
export const financeRouter = Router();

financeRouter.use(authenticate);

const OWNER_TYPES = ['CLINIC', 'SUPPLIER', 'ACADEMY', 'LECTURER', 'PARTNER', 'PLATFORM', 'GATEWAY'];

// Wallet list for current user context
financeRouter.get('/wallets', async (req: AuthRequest, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      where: {
        OR: [
          ...(req.user?.clinicId ? [{ ownerType: 'CLINIC' as any, ownerId: req.user.clinicId }] : []),
          ...(req.user?.supplierId ? [{ ownerType: 'SUPPLIER' as any, ownerId: req.user.supplierId }] : []),
          ...(req.user?.organizationId ? [{ ownerType: undefined, ownerId: req.user.organizationId }] : []),
        ].filter(Boolean),
      },
    });
    res.json({ ok: true, data: serializeBigInt(wallets) } satisfies ApiResponse);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка загрузки кошельков' } satisfies ApiResponse);
  }
});

// Wallet balance for an owner.
financeRouter.get('/wallets/:ownerType/:ownerId', async (req: AuthRequest, res) => {
  try {
    const ownerType = String(req.params.ownerType).toUpperCase();
    if (!OWNER_TYPES.includes(ownerType)) {
      return res.status(400).json({ ok: false, error: 'Некорректный тип владельца' } satisfies ApiResponse);
    }
    const ownerId = req.params.ownerId as string;
    // Only the wallet owner or a superadmin may read the balance.
    const isSuper = req.user?.role === 'SUPERADMIN';
    const owns = ownerType === 'CLINIC' && req.user?.clinicId === ownerId
      || req.user?.supplierId === ownerId
      || req.user?.organizationId === ownerId;
    if (!isSuper && !owns) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const wallet = await getOrCreateWallet(ownerType as WalletOwnerType, ownerId);
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
    const isSuper = req.user?.role === 'SUPERADMIN';
    // Non-superadmins only see transactions tied to their own wallet(s).
    const ownerFilter: any = {};
    if (!isSuper) {
      const ids: string[] = [];
      if (req.user?.clinicId) ids.push(req.user.clinicId);
      if (req.user?.supplierId) ids.push(req.user.supplierId);
      if (req.user?.organizationId) ids.push(req.user.organizationId);
      if (ids.length === 0) {
        return res.json({ ok: true, data: [] } satisfies ApiResponse);
      }
      ownerFilter.wallet = { ownerId: { in: ids } };
    }
    const transactions = await prisma.transaction.findMany({
      where: ownerFilter,
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
financeRouter.get('/commission-rules', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { domain, scopeId } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (domain) where.domain = domain;
    if (scopeId) where.scopeId = scopeId;
    const rules = await prisma.commissionRule.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json({ ok: true, data: rules } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка при получении правил комиссии' } satisfies ApiResponse);
  }
});

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
    await auditFromReq(req, {
      action: 'commission_rule.upserted',
      entity: 'commission_rule',
      entityId: rule.id,
      details: { domain, scopeId: scopeId || null, percentBps },
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
    let minor: bigint;
    try {
      minor = amountMinor !== undefined ? BigInt(amountMinor) : parseTengeToMinor(amount);
    } catch {
      return res.status(400).json({ ok: false, error: 'Некорректная сумма' } satisfies ApiResponse);
    }
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
    await auditFromReq(req, {
      action: 'finance.sale_recorded',
      entity: 'transaction',
      entityId: transaction.id,
      details: { domain, sellerType, sellerId, amountMinor: String(minor) },
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(transaction) } satisfies ApiResponse);
  } catch (error) {
    console.error('Record sale error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при проведении продажи' } satisfies ApiResponse);
  }
});

// Manual transaction (superadmin: bonuses, fees, refunds).
financeRouter.post('/transactions/manual', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { walletId, type, amount, description, refType, refId } = req.body || {};
    if (!walletId || !amount || !type || !description) {
      return res.status(400).json({ ok: false, error: 'walletId, type, amount и description обязательны' } satisfies ApiResponse);
    }
    if (type !== 'CREDIT' && type !== 'DEBIT') {
      return res.status(400).json({ ok: false, error: 'type должен быть CREDIT или DEBIT' } satisfies ApiResponse);
    }
    let minor: bigint;
    try {
      minor = parseTengeToMinor(amount);
    } catch {
      return res.status(400).json({ ok: false, error: 'Некорректная сумма' } satisfies ApiResponse);
    }
    if (minor <= 0n) {
      return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
    }
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) {
      return res.status(404).json({ ok: false, error: 'Кошелёк не найден' } satisfies ApiResponse);
    }
    const transaction = await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          type: 'manual',
          status: 'completed',
          amount: minor,
          currency: wallet.currency,
          refType: refType || 'manual',
          refId: refId || null,
          meta: { description, direction: type } as Prisma.InputJsonValue,
          ledgerEntries: {
            create: [
              { walletId: wallet.id, direction: type === 'CREDIT' ? 'credit' : 'debit', amount: minor },
            ],
          },
        },
        include: { ledgerEntries: true },
      });

      if (type === 'CREDIT') {
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: minor } } });
      } else {
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: minor } } });
      }

      return txn;
    });
    await auditFromReq(req, {
      action: 'finance.manual_transaction',
      entity: 'transaction',
      entityId: transaction.id,
      details: { walletId, type, amountMinor: String(minor), description },
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(transaction) } satisfies ApiResponse);
  } catch (error) {
    console.error('Manual transaction error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании ручной транзакции' } satisfies ApiResponse);
  }
});

export default financeRouter;

// ─── Payout queue ───
//
// The read that did not exist. `Payout` rows were created by the lecturer and
// supplier workspaces and consumed by nothing: no queue, no decision, no money
// movement. These two endpoints are the other end of that workflow.

/** The queue itself. Defaults to what is waiting on a human. */
financeRouter.get('/payouts', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  const status = String(req.query.status || 'requested');
  const payouts = await listPayouts({
    status: (PAYOUT_STATUSES as readonly string[]).includes(status)
      ? (status as PayoutStatus)
      : undefined,
    ownerType: req.query.ownerType ? (String(req.query.ownerType) as never) : undefined,
    take: req.query.take ? Number(req.query.take) : undefined,
  });
  return res.json({ ok: true, data: serializeBigInt(payouts) } satisfies ApiResponse);
});

/**
 * Move a payout along. The ledger entry is posted on `paid` and nowhere else —
 * the service owns that rule so a second caller cannot invent its own.
 */
financeRouter.post('/payouts/:id/status', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  const next = String((req.body || {}).status || '');
  if (!(PAYOUT_STATUSES as readonly string[]).includes(next)) {
    return res.status(400).json({
      ok: false,
      error: `Статус должен быть одним из: ${PAYOUT_STATUSES.join(', ')}`,
    } satisfies ApiResponse);
  }
  try {
    const payout = await transitionPayout(String(req.params.id), next as PayoutStatus, {
      actorUserId: req.user?.id ?? null,
    });
    await auditFromReq(req, {
      action: 'payout.status_changed',
      entity: 'payout',
      entityId: String(req.params.id),
      details: { to: next },
    });
    return res.json({ ok: true, data: serializeBigInt(payout) } satisfies ApiResponse);
  } catch (e: any) {
    if (e instanceof PayoutError) {
      const code = e.code === 'NOT_FOUND' ? 404 : e.code === 'INSUFFICIENT_FUNDS' ? 409 : 400;
      return res.status(code).json({ ok: false, error: e.message } satisfies ApiResponse);
    }
    throw e;
  }
});

// ─── Platform operating expenses ───
//
// getUnitEconomics() (bi.service.ts) needs real operating costs; before this
// nothing ever wrote them, so it silently fell back to a `revenue * 0.3`
// guess. These two endpoints are the write side of that gap.

const EXPENSE_CATEGORIES = ['SERVER', 'AI_API', 'MARKETING', 'SALARY', 'SUPPORT', 'PAYMENT_FEES'];

financeRouter.get('/expenses', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { category, from, to } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { tenantId: 'platform' };
    if (category) where.category = category;
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
    const expenses = await prisma.platformExpense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
    });
    return res.json({ ok: true, data: serializeBigInt(expenses) } satisfies ApiResponse);
  } catch (error) {
    console.error('List platform expenses error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении расходов' } satisfies ApiResponse);
  }
});

financeRouter.post('/expenses', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const { category, amount, date, meta } = req.body || {};
    if (!category || !EXPENSE_CATEGORIES.includes(String(category))) {
      return res.status(400).json({
        ok: false,
        error: `category должна быть одной из: ${EXPENSE_CATEGORIES.join(', ')}`,
      } satisfies ApiResponse);
    }
    let minor: bigint;
    try {
      minor = parseTengeToMinor(amount);
    } catch {
      return res.status(400).json({ ok: false, error: 'Некорректная сумма' } satisfies ApiResponse);
    }
    if (minor <= 0n) {
      return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
    }
    const expense = await prisma.platformExpense.create({
      data: {
        tenantId: 'platform',
        category: category as ExpenseCategory,
        amount: minor,
        date: date ? new Date(date) : undefined,
        meta: meta ?? undefined,
      },
    });
    await auditFromReq(req, {
      action: 'platform_expense.created',
      entity: 'platform_expense',
      entityId: expense.id,
      details: { category, amountMinor: String(minor) },
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(expense) } satisfies ApiResponse);
  } catch (error) {
    console.error('Create platform expense error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании расхода' } satisfies ApiResponse);
  }
});
