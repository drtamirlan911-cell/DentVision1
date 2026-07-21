import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { tengeToMinor, serializeBigInt } from '../../lib/money.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { getWalletSummary, listTransactions } from './wallet.service.js';
import { quoteCartCashback } from './cashback.engine.js';
import { clampRateBps } from './fraud.js';

export const dentcashRouter = Router();

dentcashRouter.use(authenticate);

dentcashRouter.get('/wallet', async (req: AuthRequest, res) => {
  try {
    const data = await getWalletSummary(req.user!.id);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('DentCash wallet error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить Dent Wallet' } satisfies ApiResponse);
  }
});

dentcashRouter.get('/transactions', async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
    const data = await listTransactions(req.user!.id, limit);
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('DentCash txns error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить операции' } satisfies ApiResponse);
  }
});

/** Preview earn for cart lines + current balance for spend. */
dentcashRouter.post('/quote', async (req: AuthRequest, res) => {
  try {
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    const normalized = lines.map((l: any) => ({
      productId: l.productId || l.product_id || l.id,
      name: l.name,
      category: l.category,
      priceTenge: Number(l.priceTenge ?? l.price ?? 0),
      qty: Number(l.qty ?? l.quantity ?? 1),
      supplierId: l.supplierId || l.supplier_id || null,
      ownBrand: !!l.ownBrand,
      promo: !!l.promo,
    }));
    const data = await quoteCartCashback(req.user!.id, normalized);
    const spendWanted = req.body?.spendTenge != null
      ? tengeToMinor(Number(req.body.spendTenge))
      : req.body?.spendMinor != null
        ? BigInt(req.body.spendMinor)
        : 0n;
    const maxSpend = BigInt(data.balanceMinor);
    const spend = spendWanted > maxSpend ? maxSpend : spendWanted < 0n ? 0n : spendWanted;
    return res.json({
      ok: true,
      data: {
        ...data,
        maxSpendMinor: maxSpend.toString(),
        maxSpendTenge: Number(maxSpend) / 100,
        applySpendMinor: spend.toString(),
        applySpendTenge: Number(spend) / 100,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('DentCash quote error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось рассчитать кэшбэк' } satisfies ApiResponse);
  }
});

/** Platform boost rule (SUPERADMIN). */
dentcashRouter.post('/platform-rules', async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'SUPERADMIN') {
      return res.status(403).json({ ok: false, error: 'Только SUPERADMIN' } satisfies ApiResponse);
    }
    const b = req.body || {};
    const rateBps = clampRateBps(Number(b.rateBps ?? b.percent * 100 ?? 0));
    if (rateBps <= 0) {
      return res.status(400).json({ ok: false, error: 'rateBps обязателен' } satisfies ApiResponse);
    }
    const rule = await prisma.cashbackRule.create({
      data: {
        id: uid(),
        ownerType: 'PLATFORM',
        ownerId: 'system',
        scope: (b.scope || 'ALL') as any,
        scopeKey: b.scopeKey || null,
        rateBps,
        capMinor: b.capMinor != null ? BigInt(b.capMinor) : b.capTenge != null ? tengeToMinor(Number(b.capTenge)) : null,
        active: b.active !== false,
        startsAt: b.startsAt ? new Date(b.startsAt) : null,
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
      },
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(rule) } satisfies ApiResponse);
  } catch (error) {
    console.error('Platform cashback rule error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать правило' } satisfies ApiResponse);
  }
});
