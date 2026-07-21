import type { WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import { cashbackMinor, defaultShopRateBps, pickBestRule, RATE_BPS, scaleEarnAfterSpend } from './rates.js';
import { clampRateBps, exceedsEarnVelocity, isSelfDeal } from './fraud.js';
import { balancedTransfer, getOrCreateUserDentWallet } from './wallet.service.js';

type LineInput = {
  productId?: string;
  name?: string;
  category?: string | null;
  priceTenge: number;
  qty: number;
  supplierId?: string | null;
  ownBrand?: boolean;
  promo?: boolean;
};

async function loadSupplierRules(supplierId: string) {
  return prisma.cashbackRule.findMany({
    where: {
      active: true,
      OR: [
        { ownerType: 'SUPPLIER', ownerId: supplierId },
        { ownerType: 'PLATFORM', ownerId: 'system' },
      ],
    },
  });
}

export async function resolveLineCashback(line: LineInput): Promise<{
  rateBps: number;
  amountMinor: bigint;
  fundedBy: WalletOwnerType;
  funderId: string;
}> {
  const amountMinor = BigInt(Math.round(line.priceTenge * 100)) * BigInt(Math.max(1, line.qty));
  const supplierId = line.supplierId || null;

  let rateBps = defaultShopRateBps({
    ownBrand: !!line.ownBrand,
    category: line.category,
    name: line.name,
    promo: !!line.promo,
  });
  let fundedBy: WalletOwnerType = supplierId ? 'SUPPLIER' : 'PLATFORM';
  let funderId = supplierId || 'system';
  let capMinor: bigint | null = null;

  if (supplierId) {
    const rules = await loadSupplierRules(supplierId);
    const best = pickBestRule(rules, {
      productId: line.productId,
      category: line.category,
      ownBrand: !!line.ownBrand,
    });
    if (best) {
      rateBps = clampRateBps(best.rateBps);
      capMinor = best.capMinor ?? null;
      const match = rules.find(
        (r) => r.scope === best.scope
          && r.rateBps === best.rateBps
          && (r.scopeKey || null) === (best.scopeKey || null),
      );
      if (match?.ownerType === 'PLATFORM') {
        fundedBy = 'PLATFORM';
        funderId = 'system';
      }
    }
  }

  return {
    rateBps,
    amountMinor: cashbackMinor(amountMinor, rateBps, capMinor),
    fundedBy,
    funderId,
  };
}

/**
 * Accrue DentCash for a shop order. Status starts as `pending` until delivery,
 * unless `immediate` is true.
 *
 * Pending = obligation only (no wallet move). Release does funder → USER.
 * `spendMinor` reduces earn proportionally (cash portion of goods only).
 */
export async function accrueShopOrderCashback(opts: {
  orderId: string;
  userId: string;
  lines: LineInput[];
  immediate?: boolean;
  spendMinor?: bigint;
}) {
  if (await exceedsEarnVelocity(opts.userId)) {
    return { skipped: true, reason: 'velocity', totalMinor: 0n, entries: [] as string[] };
  }

  const existingRows = await prisma.dentCashLedger.findMany({
    where: { userId: opts.userId, refType: 'order', refId: opts.orderId, type: 'earn' },
  });
  const doneProducts = new Set(
    existingRows
      .map((r) => String((r.meta as any)?.productId || ''))
      .filter(Boolean),
  );
  // Legacy single aggregated row without productId — treat whole order as done.
  if (existingRows.some((r) => !(r.meta as any)?.productId)) {
    const total = existingRows.reduce((s, r) => s + r.amountMinor, 0n);
    return { skipped: true, reason: 'already_accrued', totalMinor: total, entries: existingRows.map((r) => r.id) };
  }

  const goodsMinor = opts.lines.reduce(
    (s, l) => s + BigInt(Math.round(l.priceTenge * 100)) * BigInt(Math.max(1, l.qty)),
    0n,
  );
  const spendMinor = opts.spendMinor && opts.spendMinor > 0n ? opts.spendMinor : 0n;

  const userWallet = await getOrCreateUserDentWallet(opts.userId);
  let totalMinor = existingRows.reduce((s, r) => s + r.amountMinor, 0n);
  const entryIds: string[] = existingRows.map((r) => r.id);
  const status = opts.immediate ? 'available' : 'pending';

  for (const line of opts.lines) {
    const pid = line.productId || '';
    if (pid && doneProducts.has(pid)) continue;
    if (await isSelfDeal(opts.userId, line.supplierId)) continue;

    const resolved = await resolveLineCashback(line);
    const earn = scaleEarnAfterSpend({
      earnMinor: resolved.amountMinor,
      goodsMinor,
      spendMinor,
    });
    if (earn <= 0n) continue;

    if (status === 'available') {
      let fromWallet = await getOrCreateWallet(resolved.fundedBy, resolved.funderId);
      if (fromWallet.balance < earn && resolved.fundedBy !== 'PLATFORM') {
        fromWallet = await getOrCreateWallet('PLATFORM', 'system');
      }
      await balancedTransfer({
        type: 'dentcash_earn',
        amountMinor: earn,
        fromWalletId: fromWallet.id,
        toWalletId: userWallet.id,
        refType: 'order',
        refId: opts.orderId,
        meta: { rateBps: resolved.rateBps, productId: line.productId || null },
      });
    }
    // Pending: ledger obligation only — wallets move on release.

    const row = await prisma.dentCashLedger.create({
      data: {
        userId: opts.userId,
        type: 'earn',
        status,
        amountMinor: earn,
        refType: 'order',
        refId: opts.orderId,
        sellerType: resolved.fundedBy,
        sellerId: resolved.funderId,
        availableAt: status === 'available' ? new Date() : null,
        meta: {
          rateBps: resolved.rateBps,
          productId: line.productId,
          name: line.name,
          spendMinor: spendMinor.toString(),
          goodsMinor: goodsMinor.toString(),
        },
      },
    });
    entryIds.push(row.id);
    totalMinor += earn;
    if (pid) doneProducts.add(pid);
  }

  return { skipped: false, totalMinor, entries: entryIds };
}

/** Move pending earn → available: funder → USER via balanced transfer. */
export async function releaseOrderCashback(orderId: string, opts?: { sellerId?: string | null }) {
  const pending = await prisma.dentCashLedger.findMany({
    where: {
      refType: 'order',
      refId: orderId,
      type: 'earn',
      status: 'pending',
      ...(opts?.sellerId ? { sellerId: opts.sellerId } : {}),
    },
  });
  if (!pending.length) return { released: 0n };

  let released = 0n;
  for (const row of pending) {
    const userWallet = await getOrCreateUserDentWallet(row.userId);
    const funderType = (row.sellerType || 'PLATFORM') as WalletOwnerType;
    const funderId = row.sellerId || 'system';
    let funderWallet = await getOrCreateWallet(funderType, funderId);

    if (funderWallet.balance < row.amountMinor && funderType !== 'PLATFORM') {
      funderWallet = await getOrCreateWallet('PLATFORM', 'system');
    }

    await balancedTransfer({
      type: 'dentcash_release',
      amountMinor: row.amountMinor,
      fromWalletId: funderWallet.id,
      toWalletId: userWallet.id,
      refType: 'order',
      refId: orderId,
      meta: { ledgerId: row.id },
    });

    await prisma.dentCashLedger.update({
      where: { id: row.id },
      data: { status: 'available', availableAt: new Date() },
    });
    released += row.amountMinor;
  }
  return { released };
}

/** PLATFORM-funded SaaS cashback (10%) credited immediately on paid subscription. */
export async function accrueSaasCashback(opts: {
  userId: string;
  paymentId: string;
  amountMinor: bigint;
  clinicId: string;
}) {
  if (opts.amountMinor <= 0n) return null;
  const existing = await prisma.dentCashLedger.findFirst({
    where: { refType: 'payment', refId: opts.paymentId, type: 'earn' },
  });
  if (existing) return existing;

  const earn = cashbackMinor(opts.amountMinor, RATE_BPS.saas);
  if (earn <= 0n) return null;

  const userWallet = await getOrCreateUserDentWallet(opts.userId);
  const platform = await getOrCreateWallet('PLATFORM', 'system');

  await balancedTransfer({
    type: 'dentcash_earn_saas',
    amountMinor: earn,
    fromWalletId: platform.id,
    toWalletId: userWallet.id,
    refType: 'payment',
    refId: opts.paymentId,
    meta: { clinicId: opts.clinicId, rateBps: RATE_BPS.saas },
  });

  return prisma.dentCashLedger.create({
    data: {
      userId: opts.userId,
      type: 'earn',
      status: 'available',
      amountMinor: earn,
      refType: 'payment',
      refId: opts.paymentId,
      sellerType: 'PLATFORM',
      sellerId: 'system',
      availableAt: new Date(),
      meta: { clinicId: opts.clinicId, channel: 'saas' },
    },
  });
}

/** Academy default 5% — lecturer/academy funded when possible. */
export async function accrueAcademyCashback(opts: {
  userId: string;
  enrollmentId: string;
  amountMinor: bigint;
  lecturerId?: string | null;
  academyId?: string | null;
}) {
  if (opts.amountMinor <= 0n) return null;
  const existing = await prisma.dentCashLedger.findFirst({
    where: { refType: 'enrollment', refId: opts.enrollmentId, type: 'earn' },
  });
  if (existing) return existing;

  const earn = cashbackMinor(opts.amountMinor, RATE_BPS.academy);
  if (earn <= 0n) return null;

  const fundedBy: WalletOwnerType = opts.lecturerId ? 'LECTURER' : opts.academyId ? 'ACADEMY' : 'PLATFORM';
  const funderId = opts.lecturerId || opts.academyId || 'system';

  const userWallet = await getOrCreateUserDentWallet(opts.userId);
  const funder = await getOrCreateWallet(fundedBy, funderId);

  await balancedTransfer({
    type: 'dentcash_earn_academy',
    amountMinor: earn,
    fromWalletId: funder.id,
    toWalletId: userWallet.id,
    refType: 'enrollment',
    refId: opts.enrollmentId,
    meta: { rateBps: RATE_BPS.academy },
  });

  return prisma.dentCashLedger.create({
    data: {
      userId: opts.userId,
      type: 'earn',
      status: 'available',
      amountMinor: earn,
      refType: 'enrollment',
      refId: opts.enrollmentId,
      sellerType: fundedBy,
      sellerId: funderId,
      availableAt: new Date(),
      meta: { channel: 'academy' },
    },
  });
}

export async function quoteCartCashback(userId: string, lines: LineInput[]) {
  let totalEarn = 0n;
  const details = [];
  for (const line of lines) {
    if (await isSelfDeal(userId, line.supplierId)) {
      details.push({ ...line, rateBps: 0, earnMinor: '0', skipped: 'self_deal' });
      continue;
    }
    const r = await resolveLineCashback(line);
    totalEarn += r.amountMinor;
    details.push({
      productId: line.productId,
      rateBps: r.rateBps,
      earnMinor: r.amountMinor.toString(),
      earnTenge: Number(r.amountMinor) / 100,
    });
  }
  const wallet = await getOrCreateUserDentWallet(userId);
  return {
    earnMinor: totalEarn.toString(),
    earnTenge: Number(totalEarn) / 100,
    balanceMinor: wallet.balance.toString(),
    balanceTenge: Number(wallet.balance) / 100,
    details,
  };
}

/** Resolve cart product IDs from DB for accurate quote (supplier/ownBrand/category). */
export async function resolveQuoteLinesFromProducts(
  rawLines: Array<Record<string, unknown>>,
): Promise<LineInput[]> {
  const ids = rawLines
    .map((l) => String(l.productId || l.product_id || l.id || ''))
    .filter(Boolean);
  const products = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids } } })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  return rawLines.map((raw) => {
    const pid = String(raw.productId || raw.product_id || raw.id || '');
    const p = byId.get(pid);
    const qty = Math.max(1, Number(raw.qty ?? raw.quantity ?? 1));
    if (p) {
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        priceTenge: Number(p.price),
        qty,
        supplierId: p.supplierId,
        ownBrand: !!(p as any).ownBrand,
        promo: String(p.description || '').includes('[АКЦИЯ]') || !!(raw.promo),
      };
    }
    return {
      productId: pid || undefined,
      name: String(raw.name || ''),
      category: (raw.category as string) || null,
      priceTenge: Number(raw.priceTenge ?? raw.price ?? 0),
      qty,
      supplierId: (raw.supplierId || raw.supplier_id || null) as string | null,
      ownBrand: !!raw.ownBrand,
      promo: !!raw.promo,
    };
  });
}
