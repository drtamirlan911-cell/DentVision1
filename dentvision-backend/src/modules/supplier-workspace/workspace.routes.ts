import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import { serializeBigInt, tengeToMinor } from '../../lib/money.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Supplier Workspace (self-service cabinet). All routes operate strictly on the
// supplier from the active SUPPLIER context (req.user.supplierId), so a supplier
// user can only ever see/manage their own data. Switch into this context via
// POST /api/iam/switch-context { scopeType: "SUPPLIER", scopeId }.
// ─────────────────────────────────────────────────────────────────────────────
export const supplierWorkspaceRouter = Router();

supplierWorkspaceRouter.use(authenticate);

// Requires an active SUPPLIER context.
function requireSupplierContext(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.supplierId) {
    return res.status(403).json({ ok: false, error: 'Требуется контекст поставщика (switch-context)' } satisfies ApiResponse);
  }
  next();
}

// Requires a write-capable supplier role (owner/manager).
function requireSupplierWrite(req: AuthRequest, res: Response, next: NextFunction) {
  if (!['owner', 'manager'].includes(req.user?.supplierRole || '')) {
    return res.status(403).json({ ok: false, error: 'Недостаточно прав в кабинете поставщика' } satisfies ApiResponse);
  }
  next();
}

supplierWorkspaceRouter.use(requireSupplierContext);

// ─── Profile ───
supplierWorkspaceRouter.get('/me', async (req: AuthRequest, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.user!.supplierId },
    include: { documents: true, _count: { select: { products: true } } },
  });
  if (!supplier) {
    return res.status(404).json({ ok: false, error: 'Поставщик не найден' } satisfies ApiResponse);
  }
  return res.json({ ok: true, data: { ...supplier, myRole: req.user!.supplierRole } } satisfies ApiResponse);
});

// Update own profile. Status/kind stay platform-controlled (verification pipeline).
supplierWorkspaceRouter.patch('/me', requireSupplierWrite, async (req: AuthRequest, res) => {
  const b = req.body || {};
  const supplier = await prisma.supplier.update({
    where: { id: req.user!.supplierId },
    data: {
      ...(b.name !== undefined && { name: b.name }),
      ...(b.bin !== undefined && { bin: b.bin || null }),
      ...(b.legalAddress !== undefined && { legalAddress: b.legalAddress || null }),
      ...(b.contactPerson !== undefined && { contactPerson: b.contactPerson || null }),
      ...(b.phone !== undefined && { phone: b.phone || null }),
      ...(b.email !== undefined && { email: b.email || null }),
    },
  });
  return res.json({ ok: true, data: supplier } satisfies ApiResponse);
});

// Upload a document toward verification.
supplierWorkspaceRouter.post('/documents', requireSupplierWrite, async (req: AuthRequest, res) => {
  const { type, url } = req.body || {};
  if (!type || !url) {
    return res.status(400).json({ ok: false, error: 'type и url обязательны' } satisfies ApiResponse);
  }
  const doc = await prisma.supplierDocument.create({ data: { supplierId: req.user!.supplierId!, type, url } });
  return res.status(201).json({ ok: true, data: doc } satisfies ApiResponse);
});

// ─── Own catalog ───
supplierWorkspaceRouter.get('/products', async (req: AuthRequest, res) => {
  const products = await prisma.product.findMany({
    where: { supplierId: req.user!.supplierId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ ok: true, data: products } satisfies ApiResponse);
});

supplierWorkspaceRouter.post('/products', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    if (!b.name || b.price === undefined) {
      return res.status(400).json({ ok: false, error: 'name и price обязательны' } satisfies ApiResponse);
    }
    const product = await prisma.product.create({
      data: {
        id: uid(),
        name: b.name,
        brand: b.brand || null,
        category: b.category || null,
        price: Number(b.price),
        stock: Number(b.stock) || 0,
        description: b.description || null,
        manufacturer: b.manufacturer || null,
        country: b.country || null,
        compatibility: b.compatibility || null,
        supplierId: req.user!.supplierId, // forced to own supplier
      },
    });
    return res.status(201).json({ ok: true, data: product } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier create product error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании товара' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.patch('/products/:id', requireSupplierWrite, async (req: AuthRequest, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id as string, supplierId: req.user!.supplierId },
  });
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'Товар не найден' } satisfies ApiResponse);
  }
  const b = req.body || {};
  const product = await prisma.product.update({
    where: { id: existing.id },
    data: {
      ...(b.name !== undefined && { name: b.name }),
      ...(b.price !== undefined && { price: Number(b.price) }),
      ...(b.stock !== undefined && { stock: Number(b.stock) }),
      ...(b.description !== undefined && { description: b.description || null }),
      ...(b.category !== undefined && { category: b.category || null }),
    },
  });
  return res.json({ ok: true, data: product } satisfies ApiResponse);
});

supplierWorkspaceRouter.delete('/products/:id', requireSupplierWrite, async (req: AuthRequest, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id as string, supplierId: req.user!.supplierId },
  });
  if (!existing) {
    return res.status(404).json({ ok: false, error: 'Товар не найден' } satisfies ApiResponse);
  }
  await prisma.product.delete({ where: { id: existing.id } });
  return res.json({ ok: true, data: { id: existing.id } } satisfies ApiResponse);
});

// ─── Wallet + payouts ───
supplierWorkspaceRouter.get('/wallet', async (req: AuthRequest, res) => {
  const wallet = await getOrCreateWallet('SUPPLIER', req.user!.supplierId!);
  return res.json({ ok: true, data: serializeBigInt(wallet) } satisfies ApiResponse);
});

// Request a payout from own wallet (platform approves it via /api/finance).
supplierWorkspaceRouter.post('/payouts', requireSupplierWrite, async (req: AuthRequest, res) => {
  const { amount, amountMinor } = req.body || {};
  if (amount === undefined && amountMinor === undefined) {
    return res.status(400).json({ ok: false, error: 'amount обязателен' } satisfies ApiResponse);
  }
  const minor = amountMinor !== undefined ? BigInt(amountMinor) : tengeToMinor(Number(amount));
  const wallet = await getOrCreateWallet('SUPPLIER', req.user!.supplierId!);
  if (wallet.balance < minor) {
    return res.status(409).json({ ok: false, error: 'Недостаточно средств' } satisfies ApiResponse);
  }
  const payout = await prisma.payout.create({ data: { walletId: wallet.id, amount: minor, status: 'requested' } });
  return res.status(201).json({ ok: true, data: serializeBigInt(payout) } satisfies ApiResponse);
});

// ─── Sales analytics (from own wallet ledger) ───
supplierWorkspaceRouter.get('/analytics', async (req: AuthRequest, res) => {
  const wallet = await getOrCreateWallet('SUPPLIER', req.user!.supplierId!);
  const [creditAgg, productCount] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { walletId: wallet.id, direction: 'credit' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.product.count({ where: { supplierId: req.user!.supplierId } }),
  ]);
  return res.json({
    ok: true,
    data: {
      balanceMinor: wallet.balance.toString(),
      earnedMinor: (creditAgg._sum.amount ?? 0n).toString(),
      salesCount: creditAgg._count,
      productCount,
      currency: wallet.currency,
    },
  } satisfies ApiResponse);
});

export default supplierWorkspaceRouter;
