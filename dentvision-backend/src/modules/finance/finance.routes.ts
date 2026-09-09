import { Router } from 'express';
import type { Prisma, WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireSuperadmin } from '../../middleware/rbac.js';
import { serializeBigInt, parseTengeToMinor } from '../../lib/money.js';
import type { ExpenseCategory } from '@prisma/client';
import { getOrCreateWallet, recordSale, ledgerNetBalance } from './finance.service.js';
import { revenueBySource } from './revenue.service.js';
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

/**
 * Wallet reads are intentionally NOT gated by `requirePermission('finance.manage')`:
 * a clinic/supplier needs to read its own balance without holding that platform
 * permission. This is the actual authorization boundary for /wallets/:ownerType/:ownerId
 * — kept as a named guard (rather than inline in the handler) so it can't be
 * silently dropped in a future refactor.
 */
function walletOwnershipGuard(req: AuthRequest, ownerType: string, ownerId: string): boolean {
  if (req.user?.role === 'SUPERADMIN') return true;
  if (ownerType === 'CLINIC') return req.user?.clinicId === ownerId;
  if (ownerType === 'SUPPLIER') return req.user?.supplierId === ownerId;
  // The Prisma WalletOwnerType enum has no ORGANIZATION value. An organizationId
  // must therefore never authorize an arbitrary wallet owner type by ID collision.
  return false;
}

// Wallet list for current user context
financeRouter.get('/wallets', async (req: AuthRequest, res) => {
  try {
    const ownership: Array<{ ownerType: WalletOwnerType; ownerId: string }> = [];
    if (req.user?.clinicId) ownership.push({ ownerType: 'CLINIC', ownerId: req.user.clinicId });
    if (req.user?.supplierId) ownership.push({ ownerType: 'SUPPLIER', ownerId: req.user.supplierId });
    const wallets = ownership.length === 0
      ? []
      : await prisma.wallet.findMany({
          where: { OR: ownership },
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
    if (!walletOwnershipGuard(req, ownerType, ownerId)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' } satisfies ApiResponse);
    }
    const wallet = await getOrCreateWallet(ownerType as WalletOwnerType, ownerId);
    return res.json({ ok: true, data: serializeBigInt(wallet) } satisfies ApiResponse);
  } catch (error) {
    console.error('Get wallet error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении кошелька' } satisfies ApiResponse);
  }
});

// Transactions list. Clinic/supplier finance managers may read transactions that
// actually touched one of their typed wallets; platform administration is SUPERADMIN-only.
financeRouter.get('/transactions', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const isSuper = req.user?.role === 'SUPERADMIN';
    const ownerFilter: Prisma.TransactionWhereInput = {};
    if (!isSuper) {
      const typedOwners: Array<{ ownerType: WalletOwnerType; ownerId: string }> = [];
      if (req.user?.clinicId) typedOwners.push({ ownerType: 'CLINIC', ownerId: req.user.clinicId });
      if (req.user?.supplierId) typedOwners.push({ ownerType: 'SUPPLIER', ownerId: req.user.supplierId });
      if (typedOwners.length === 0) {
        return res.json({ ok: true, data: [] } satisfies ApiResponse);
      }
      ownerFilter.ledgerEntries = {
        some: {
          wallet: {
            OR: typedOwners,
          },
        },
      };
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

// Platform finance administration is SUPERADMIN-only. Clinic billing permissions
// must never imply access to platform-wide ledger governance.
financeRouter.get('/ledger/health', requireSuperadmin, async (_req, res) => {
  const net = await ledgerNetBalance();
  return res.json({ ok: true, data: { netBalance: net.toString(), balanced: net === 0n } } satisfies ApiResponse);
});

financeRouter.get('/commission-rules', requireSuperadmin, async (req: AuthRequest, res) => {
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

financeRouter.post('/commission-rules', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { domain, scopeId, percentBps, splitJson } = req.body || {};
    if (!domain || percentBps === undefined) {
      return res.status(400).json({ ok: false, error: 'domain и percentBps обязательны' } satisfies ApiResponse);
    }
    const normalizedScopeId = scopeId || null;
    const existing = await prisma.commissionRule.findFirst({ where: { domain, scopeId: normalizedScopeId } });
    const rule = existing
      ? await prisma.commissionRule.update({
          where: { id: existing.id },
          data: { percentBps, splitJson: splitJson ?? undefined },
        })
      : await prisma.commissionRule.create({
          data: { domain, scopeId: normalizedScopeId, percentBps, splitJson: splitJson ?? undefined },
        });
    await auditFromReq(req, {
      action: 'commission_rule.upserted',
      entity: 'commission_rule',
      entityId: rule.id,
      details: { domain, scopeId: normalizedScopeId, percentBps },
    });
    return res.status(201).json({ ok: true, data: rule } satisfies ApiResponse);
  } catch (error) {
    console.error('Commission rule error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании правила комиссии' } satisfies ApiResponse);
  }
});

financeRouter.post('/sales', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { domain, sellerType, sellerId, amount, amountMinor, refId, refType } = req.body || {};
    if (!domain || !sellerType || !sellerId || (amount === undefined && amountMinor === undefined)) {
      return res.status(400).json({ ok: false, error: 'domain, sellerType, sellerId и amount обязательны' } satisfies ApiResponse);
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
    if (minor <= 0n) return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
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

financeRouter.post('/transactions/manual', requireSuperadmin, async (req: AuthRequest, res) => {
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
    if (minor <= 0n) return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) return res.status(404).json({ ok: false, error: 'Кошелёк не найден' } satisfies ApiResponse);
    const transaction = await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          type: 'manual', status: 'completed', amount: minor, currency: wallet.currency,
          refType: refType || 'manual', refId: refId || null,
          meta: { description, direction: type } as Prisma.InputJsonValue,
          ledgerEntries: { create: [{ walletId: wallet.id, direction: type === 'CREDIT' ? 'credit' : 'debit', amount: minor }] },
        },
        include: { ledgerEntries: true },
      });
      if (type === 'CREDIT') await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: minor } } });
      else await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: minor } } });
      return txn;
    });
    await auditFromReq(req, {
      action: 'finance.manual_transaction', entity: 'transaction', entityId: transaction.id,
      details: { walletId, type, amountMinor: String(minor), description },
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(transaction) } satisfies ApiResponse);
  } catch (error) {
    console.error('Manual transaction error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании ручной транзакции' } satisfies ApiResponse);
  }
});

// ─── Payout queue ───
// Payout administration is platform-only.
financeRouter.get('/payouts', requireSuperadmin, async (req: AuthRequest, res) => {
  const status = String(req.query.status || 'requested');
  const payouts = await listPayouts({
    status: (PAYOUT_STATUSES as readonly string[]).includes(status) ? (status as PayoutStatus) : undefined,
    ownerType: req.query.ownerType ? (String(req.query.ownerType) as never) : undefined,
    take: req.query.take ? Number(req.query.take) : undefined,
  });
  return res.json({ ok: true, data: serializeBigInt(payouts) } satisfies ApiResponse);
});

financeRouter.post('/payouts/:id/status', requireSuperadmin, async (req: AuthRequest, res) => {
  const next = String((req.body || {}).status || '');
  if (!(PAYOUT_STATUSES as readonly string[]).includes(next)) {
    return res.status(400).json({ ok: false, error: `Статус должен быть одним из: ${PAYOUT_STATUSES.join(', ')}` } satisfies ApiResponse);
  }
  try {
    const payout = await transitionPayout(String(req.params.id), next as PayoutStatus, { actorUserId: req.user?.id ?? null });
    await auditFromReq(req, { action: 'payout.status_changed', entity: 'payout', entityId: String(req.params.id), details: { to: next } });
    return res.json({ ok: true, data: serializeBigInt(payout) } satisfies ApiResponse);
  } catch (e: any) {
    if (e instanceof PayoutError) {
      const code = e.code === 'NOT_FOUND' ? 404 : e.code === 'INSUFFICIENT_FUNDS' ? 409 : 400;
      return res.status(code).json({ ok: false, error: e.message } satisfies ApiResponse);
    }
    throw e;
  }
});

const EXPENSE_CATEGORIES = ['SERVER', 'AI_API', 'MARKETING', 'SALARY', 'SUPPORT', 'PAYMENT_FEES'];

financeRouter.get('/expenses', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { category, from, to } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { tenantId: 'platform' };
    if (category) where.category = category;
    if (from || to) where.date = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
    const expenses = await prisma.platformExpense.findMany({ where, orderBy: { date: 'desc' }, take: limit });
    return res.json({ ok: true, data: serializeBigInt(expenses) } satisfies ApiResponse);
  } catch (error) {
    console.error('List platform expenses error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении расходов' } satisfies ApiResponse);
  }
});

financeRouter.post('/expenses', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { category, amount, date, meta } = req.body || {};
    if (!category || !EXPENSE_CATEGORIES.includes(String(category))) {
      return res.status(400).json({ ok: false, error: `category должна быть одной из: ${EXPENSE_CATEGORIES.join(', ')}` } satisfies ApiResponse);
    }
    let minor: bigint;
    try { minor = parseTengeToMinor(amount); } catch { return res.status(400).json({ ok: false, error: 'Некорректная сумма' } satisfies ApiResponse); }
    if (minor <= 0n) return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
    const expense = await prisma.platformExpense.create({
      data: { tenantId: 'platform', category: category as ExpenseCategory, amount: minor, date: date ? new Date(date) : undefined, meta: meta ?? undefined },
    });
    await auditFromReq(req, { action: 'platform_expense.created', entity: 'platform_expense', entityId: expense.id, details: { category, amountMinor: String(minor) } });
    return res.status(201).json({ ok: true, data: serializeBigInt(expense) } satisfies ApiResponse);
  } catch (error) {
    console.error('Create platform expense error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании расхода' } satisfies ApiResponse);
  }
});

financeRouter.get('/revenue-by-source', requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const parseDate = (value: unknown): Date | undefined => {
      if (typeof value !== 'string' || !value) return undefined;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    const report = await revenueBySource({ from: parseDate(req.query.from), to: parseDate(req.query.to) });
    return res.json({ ok: true, data: report } satisfies ApiResponse);
  } catch (error) {
    console.error('[finance] revenue-by-source', error);
    return res.status(500).json({ ok: false, error: 'Не удалось собрать выручку по источникам' } satisfies ApiResponse);
  }
});

export default financeRouter;
