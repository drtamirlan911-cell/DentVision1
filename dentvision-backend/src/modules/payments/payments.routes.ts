import { Router } from 'express';
import type { WalletOwnerType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { serializeBigInt, tengeToMinor } from '../../lib/money.js';
import { recordSale } from '../finance/finance.service.js';
import { providers } from './kaspi.provider.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Payments (Phase 5). Payment gateway abstraction + Kaspi QR (mock) with an
// idempotent callback that settles the underlying sale into the ledger.
export const paymentsRouter = Router();

// Create a payment (returns provider QR/deeplink). Requires auth.
paymentsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { amount, amountMinor, provider = 'kaspi_qr', domain, sellerType, sellerId, refType, refId } = req.body || {};
    const gateway = providers[provider];
    if (!gateway) {
      return res.status(400).json({ ok: false, error: 'Неизвестный провайдер' } satisfies ApiResponse);
    }
    if (amount === undefined && amountMinor === undefined) {
      return res.status(400).json({ ok: false, error: 'amount обязателен' } satisfies ApiResponse);
    }
    const minor = amountMinor !== undefined ? BigInt(amountMinor) : tengeToMinor(Number(amount));
    if (minor <= 0n) {
      return res.status(400).json({ ok: false, error: 'Сумма должна быть положительной' } satisfies ApiResponse);
    }

    const created = await gateway.createPayment({ amountMinor: minor, refId });
    const payment = await prisma.payment.create({
      data: {
        provider,
        externalId: created.externalId,
        amount: minor,
        status: 'pending',
        refType: refType || null,
        refId: refId || null,
        domain: domain || null,
        sellerType: sellerType || null,
        sellerId: sellerId || null,
        meta: { qr: created.qr },
      },
    });

    return res.status(201).json({
      ok: true,
      data: { ...serializeBigInt(payment), qr: created.qr },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Create payment error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании платежа' } satisfies ApiResponse);
  }
});

paymentsRouter.get('/:id', authenticate, async (req: AuthRequest, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id as string } });
  if (!payment) {
    return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);
  }
  return res.json({ ok: true, data: serializeBigInt(payment) } satisfies ApiResponse);
});

// Provider callback (no user auth — external webhook). Idempotent: a payment is
// settled into the ledger at most once. In production this must verify a
// provider signature/HMAC before trusting the payload.
paymentsRouter.post('/callbacks/kaspi', async (req, res) => {
  try {
    const { externalId, status } = req.body || {};
    if (!externalId) {
      return res.status(400).json({ ok: false, error: 'externalId обязателен' } satisfies ApiResponse);
    }
    const payment = await prisma.payment.findUnique({ where: { externalId } });
    if (!payment) {
      return res.status(404).json({ ok: false, error: 'Платёж не найден' } satisfies ApiResponse);
    }

    // Idempotency: if already paid, acknowledge without re-settling.
    if (payment.status === 'paid') {
      return res.json({ ok: true, data: { id: payment.id, status: payment.status, settled: false } } satisfies ApiResponse);
    }

    const newStatus = status === 'paid' ? 'paid' : status === 'failed' ? 'failed' : 'pending';
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus },
    });

    let settled = false;
    if (newStatus === 'paid' && payment.refType === 'sale' && payment.sellerType && payment.sellerId) {
      await recordSale({
        domain: payment.domain || 'shop',
        sellerType: payment.sellerType as WalletOwnerType,
        sellerId: payment.sellerId,
        amountMinor: payment.amount,
        refType: 'payment',
        refId: payment.id,
      });
      settled = true;
    }

    // SaaS clinic subscription renewal
    if (newStatus === 'paid' && payment.refType === 'subscription' && payment.refId) {
      const meta = (payment.meta || {}) as { saasPlan?: string; months?: number };
      const planRaw = String(meta.saasPlan || 'professional').toLowerCase();
      const saasPlan = (planRaw === 'pro' ? 'professional' : planRaw) as
        'starter' | 'professional' | 'enterprise';
      const { activateClinicSubscriptionFromPayment, isSaasPlanId } = await import(
        '../billing/clinicSubscription.service.js'
      );
      if (isSaasPlanId(saasPlan)) {
        await activateClinicSubscriptionFromPayment({
          clinicId: payment.refId,
          saasPlan,
          months: meta.months || 1,
          paymentId: payment.id,
        });
        settled = true;
      }
    }

    return res.json({ ok: true, data: { id: updated.id, status: updated.status, settled } } satisfies ApiResponse);
  } catch (error) {
    console.error('Kaspi callback error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка обработки callback' } satisfies ApiResponse);
  }
});

export default paymentsRouter;
