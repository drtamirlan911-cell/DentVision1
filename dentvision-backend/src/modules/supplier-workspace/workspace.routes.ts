import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import { serializeBigInt, tengeToMinor, parseTengeToMinor } from '../../lib/money.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import { requestPayout, PayoutError } from '../finance/payout.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { buildSupplierDashboard, buildSupplierInsights, getSupplierOrders } from './supplierDashboard.js';
import { canTransitionOrder } from '../../lib/orderStatus.js';
import { writeAuditLog } from '../compliance/audit.service.js';
import { orderHasSupplierLine } from './supplierOrderOwnership.js';

// ─────────────────────────────────────────────────────────────────────────────
// Supplier Workspace (self-service cabinet). All routes operate strictly on the
// supplier from the active SUPPLIER context (req.user.supplierId).
// ─────────────────────────────────────────────────────────────────────────────
export const supplierWorkspaceRouter = Router();

supplierWorkspaceRouter.use(authenticate);

function requireSupplierContext(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.supplierId) {
    return res.status(403).json({ ok: false, error: 'Требуется контекст поставщика (switch-context)' } satisfies ApiResponse);
  }
  next();
}

function requireSupplierWrite(req: AuthRequest, res: Response, next: NextFunction) {
  if (!['owner', 'manager'].includes(req.user?.supplierRole || '')) {
    return res.status(403).json({ ok: false, error: 'Недостаточно прав в кабинете поставщика' } satisfies ApiResponse);
  }
  next();
}

supplierWorkspaceRouter.use(requireSupplierContext);

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

supplierWorkspaceRouter.patch('/me', requireSupplierWrite, async (req: AuthRequest, res) => {
  const b = req.body || {};
  const supplier = await prisma.supplier.update({
    where: { id: req.user!.supplierId },
    data: {
      ...(b.name !== undefined && { name: b.name }),
      ...(b.bin !== undefined && { bin: b.bin || null }),
      ...(b.legalAddress !== undefined && { legalAddress: b.legalAddress || null }),
      ...(b.city !== undefined && { city: b.city || null }),
      ...(b.contactPerson !== undefined && { contactPerson: b.contactPerson || null }),
      ...(b.phone !== undefined && { phone: b.phone || null }),
      ...(b.email !== undefined && { email: b.email || null }),
    },
  });
  return res.json({ ok: true, data: supplier } satisfies ApiResponse);
});

supplierWorkspaceRouter.post('/documents', requireSupplierWrite, async (req: AuthRequest, res) => {
  const { type, url } = req.body || {};
  if (!type || !url) {
    return res.status(400).json({ ok: false, error: 'type и url обязательны' } satisfies ApiResponse);
  }
  const doc = await prisma.supplierDocument.create({ data: { supplierId: req.user!.supplierId!, type, url } });
  return res.status(201).json({ ok: true, data: doc } satisfies ApiResponse);
});

supplierWorkspaceRouter.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const data = await buildSupplierDashboard(req.user!.supplierId!);
    return res.json({ ok: true, data: serializeBigInt(data) } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier dashboard error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить кабинет' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.get('/insights', async (req: AuthRequest, res) => {
  try {
    const insights = await buildSupplierInsights(req.user!.supplierId!);
    return res.json({ ok: true, data: insights } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier insights error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить рекомендации' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.get('/orders', async (req: AuthRequest, res) => {
  try {
    const orders = await getSupplierOrders(req.user!.supplierId!);
    return res.json({ ok: true, data: orders } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier orders error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить заказы' } satisfies ApiResponse);
  }
});


function isSecureEvidenceUrl(value: unknown): boolean {
  const raw = String(value || '').trim();
  if (raw.length < 8 || raw.length > 2048) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

supplierWorkspaceRouter.get('/orders/:id/fulfillment', async (req: AuthRequest, res) => {
  try {
    const supplierId = req.user!.supplierId!;
    const orderId = String(req.params.id);
    const mine = await getSupplierOrders(supplierId);
    if (!(mine as any[]).some((order) => order.id === orderId)) {
      return res.status(404).json({ ok: false, error: 'Заказ не найден в текущем кабинете поставщика' } satisfies ApiResponse);
    }
    const [shipment, events] = await Promise.all([
      prisma.supplierShipment.findFirst({ where: { orderId, supplierId }, orderBy: { createdAt: 'desc' } }),
      prisma.supplierShipmentEvent.findMany({ where: { orderId, supplierId }, orderBy: { createdAt: 'asc' } }),
    ]);
    return res.json({ ok: true, data: { shipment, events } } satisfies ApiResponse);
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить данные отгрузки' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.post('/orders/:id/shipments', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const supplierId = req.user!.supplierId!;
    const orderId = String(req.params.id);
    const mine = await getSupplierOrders(supplierId);
    if (!(mine as any[]).some((order) => order.id === orderId)) return res.status(404).json({ ok: false, error: 'Заказ не найден в текущем кабинете поставщика' });
    const carrier = String(req.body?.carrier || '').trim().slice(0, 100);
    const trackingNumber = String(req.body?.trackingNumber || '').trim().slice(0, 120);
    const trackingUrl = req.body?.trackingUrl ? String(req.body.trackingUrl).trim() : null;
    if (carrier.length < 2 || trackingNumber.length < 4) return res.status(400).json({ ok: false, error: 'Укажите перевозчика и корректный трек-номер' } satisfies ApiResponse);
    if (trackingUrl && !isSecureEvidenceUrl(trackingUrl)) return res.status(400).json({ ok: false, error: 'Ссылка отслеживания должна быть защищённым HTTPS-адресом' } satisfies ApiResponse);

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: string; status: string; supplierId: string | null }>>(
        `SELECT "id","status","supplierId" FROM "orders" WHERE "id"=$1 FOR UPDATE`, orderId,
      );
      if (!locked[0]) return { kind: 'not_found' as const };
      if (locked[0].supplierId && locked[0].supplierId !== supplierId) return { kind: 'foreign_supplier' as const };
      const existing = await tx.supplierShipment.findFirst({ where: { orderId, supplierId } });
      if (existing) {
        const same = existing.carrier === carrier && existing.trackingNumber === trackingNumber && existing.trackingUrl === trackingUrl;
        return same ? { kind: 'idempotent' as const, shipment: existing, orderStatus: locked[0].status } : { kind: 'already_exists' as const };
      }
      if (!['packing', 'shipped'].includes(locked[0].status)) return { kind: 'invalid_status' as const };
      const shipment = await tx.supplierShipment.create({
        data: { id: uid(), orderId, supplierId, carrier, trackingNumber, trackingUrl, status: 'shipped', shippedAt: new Date(), createdByUserId: req.user!.id },
      });
      await tx.supplierShipmentEvent.create({
        data: {
          id: uid(), shipmentId: shipment.id, orderId, supplierId,
          eventType: 'DISPATCHED', toStatus: 'shipped',
          note: 'Отгрузка зарегистрирована поставщиком.', actorUserId: req.user!.id,
          metadata: { carrier, trackingNumber, trackingUrl },
        },
      });
      let orderStatus = locked[0].status;
      if (locked[0].supplierId === supplierId && locked[0].status === 'packing') {
        const update = await tx.order.updateMany({ where: { id: orderId, status: 'packing', supplierId }, data: { status: 'shipped' } });
        if (update.count !== 1) throw new Error('Статус заказа изменился. Обновите страницу.');
        orderStatus = 'shipped';
      }
      return { kind: 'created' as const, shipment, orderStatus };
    });
    if (result.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден' } satisfies ApiResponse);
    if (result.kind === 'foreign_supplier') return res.status(403).json({ ok: false, error: 'Заказ закреплён за другим поставщиком' } satisfies ApiResponse);
    if (result.kind === 'already_exists') return res.status(409).json({ ok: false, error: 'Для этого заказа уже зарегистрирована отгрузка', code: 'SUPPLIER_SHIPMENT_ALREADY_EXISTS' } satisfies ApiResponse);
    if (result.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Сначала переведите заказ в сборку', code: 'SUPPLIER_ORDER_NOT_PACKED' } satisfies ApiResponse);
    if (result.kind === 'created') {
      await writeAuditLog({ action: 'SUPPLIER_SHIPMENT_CREATED', entity: 'supplier_shipment', entityId: result.shipment.id, details: { orderId, supplierId, carrier, trackingNumber }, userId: req.user!.id });
    }
    return res.status(result.kind === 'created' ? 201 : 200).json({ ok: true, data: { shipment: result.shipment, orderStatus: result.orderStatus, idempotent: result.kind === 'idempotent' } } satisfies ApiResponse);
  } catch (error: any) {
    if (String(error?.code || '') === 'P2002') return res.status(409).json({ ok: false, error: 'Этот трек-номер уже используется поставщиком', code: 'SUPPLIER_TRACKING_DUPLICATE' } satisfies ApiResponse);
    console.error('Supplier shipment create error:', error);
    return res.status(400).json({ ok: false, error: 'Не удалось зарегистрировать отгрузку' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.post('/orders/:id/delivery-confirmation', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const supplierId = req.user!.supplierId!;
    const orderId = String(req.params.id);
    const mine = await getSupplierOrders(supplierId);
    if (!(mine as any[]).some((order) => order.id === orderId)) return res.status(404).json({ ok: false, error: 'Заказ не найден в текущем кабинете поставщика' });
    const proofUrl = String(req.body?.proofUrl || '').trim();
    const recipientName = String(req.body?.recipientName || '').trim().slice(0, 120);
    const deliveryNote = String(req.body?.note || '').trim().slice(0, 500) || null;
    if (!isSecureEvidenceUrl(proofUrl)) return res.status(400).json({ ok: false, error: 'Для подтверждения доставки нужна HTTPS-ссылка на доказательство вручения' } satisfies ApiResponse);
    if (recipientName.length < 2) return res.status(400).json({ ok: false, error: 'Укажите имя получателя' } satisfies ApiResponse);

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: string; status: string; supplierId: string | null }>>(
        `SELECT "id","status","supplierId" FROM "orders" WHERE "id"=$1 FOR UPDATE`, orderId,
      );
      if (!locked[0]) return { kind: 'not_found' as const };
      if (locked[0].supplierId && locked[0].supplierId !== supplierId) return { kind: 'foreign_supplier' as const };
      const shipment = await tx.supplierShipment.findFirst({ where: { orderId, supplierId } });
      if (!shipment) return { kind: 'shipment_required' as const };
      if (shipment.status === 'delivered') {
        const same = shipment.proofOfDeliveryUrl === proofUrl && shipment.recipientName === recipientName;
        return same ? { kind: 'idempotent' as const, shipment } : { kind: 'already_delivered' as const };
      }
      if (shipment.status !== 'shipped') return { kind: 'invalid_shipment_status' as const };
      const updated = await tx.supplierShipment.updateMany({
        where: { id: shipment.id, status: 'shipped' },
        data: { status: 'delivered', deliveredAt: new Date(), proofOfDeliveryUrl: proofUrl, recipientName, deliveryNote, deliveredByUserId: req.user!.id },
      });
      if (updated.count !== 1) throw new Error('Состояние отгрузки уже изменилось. Обновите страницу.');
      await tx.supplierShipmentEvent.create({
        data: {
          id: uid(), shipmentId: shipment.id, orderId, supplierId,
          eventType: 'DELIVERED', fromStatus: 'shipped', toStatus: 'delivered',
          note: deliveryNote || 'Поставка вручена получателю; доказательство сохранено.',
          actorUserId: req.user!.id, metadata: { proofOfDeliveryUrl: proofUrl, recipientName },
        },
      });
      let orderCompleted = false;
      if (locked[0].supplierId === supplierId) {
        const orderUpdate = await tx.order.updateMany({ where: { id: orderId, supplierId, status: 'shipped' }, data: { status: 'delivered', deliveredAt: new Date() } });
        orderCompleted = orderUpdate.count === 1;
      }
      return { kind: 'delivered' as const, shipment: await tx.supplierShipment.findUnique({ where: { id: shipment.id } }), orderCompleted };
    });
    if (result.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден' } satisfies ApiResponse);
    if (result.kind === 'foreign_supplier') return res.status(403).json({ ok: false, error: 'Заказ закреплён за другим поставщиком' } satisfies ApiResponse);
    if (result.kind === 'shipment_required') return res.status(409).json({ ok: false, error: 'Сначала зарегистрируйте отгрузку и трек-номер', code: 'SUPPLIER_SHIPMENT_REQUIRED' } satisfies ApiResponse);
    if (result.kind === 'invalid_shipment_status') return res.status(409).json({ ok: false, error: 'Отгрузка не находится в пути', code: 'SUPPLIER_SHIPMENT_NOT_IN_TRANSIT' } satisfies ApiResponse);
    if (result.kind === 'already_delivered') return res.status(409).json({ ok: false, error: 'Доставка уже подтверждена другим доказательством', code: 'SUPPLIER_DELIVERY_ALREADY_CONFIRMED' } satisfies ApiResponse);
    if (result.kind === 'delivered') {
      await writeAuditLog({ action: 'SUPPLIER_DELIVERY_CONFIRMED', entity: 'supplier_shipment', entityId: result.shipment?.id || orderId, details: { orderId, supplierId, orderCompleted: result.orderCompleted, recipientName }, userId: req.user!.id });
      if (result.orderCompleted) {
        const { releaseOrderCashback } = await import('../dentcash/cashback.engine.js');
        await releaseOrderCashback(orderId).catch((error) => console.error('[dentcash release]', error));
        const { restockFromOrder } = await import('../inventory/orderRestock.js');
        await restockFromOrder(orderId).catch((error) => console.error('[inventory restock]', error));
      }
    }
    return res.status(200).json({ ok: true, data: { shipment: result.shipment, orderCompleted: result.kind === 'delivered' ? result.orderCompleted : false, idempotent: result.kind === 'idempotent' } } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier delivery confirmation error:', error);
    return res.status(400).json({ ok: false, error: 'Не удалось подтвердить доставку' } satisfies ApiResponse);
  }
});



async function supplierOwnsOrderLine(supplierId: string, disputeId: string, orderId: string, client: any = prisma): Promise<boolean> {
  const [order, requestedItems] = await Promise.all([
    client.order.findUnique({ where: { id: orderId }, select: { id: true, items: true } }),
    client.marketplaceReturnItem.findMany({
      where: { disputeId, orderId, supplierId },
      select: { lineIndex: true, productId: true },
    }),
  ]);
  if (!order || requestedItems.length === 0) return false;
  const lines = Array.isArray(order.items) ? order.items as Array<Record<string, unknown>> : [];
  return requestedItems.some((item: { lineIndex: number; productId: string }) => {
    const line = lines[item.lineIndex];
    if (!line || typeof line !== 'object') return false;
    const productId = String(line.product_id ?? line.productId ?? '');
    const lineSupplierId = String(line.supplier_id ?? line.supplierId ?? '').trim();
    return productId === item.productId && lineSupplierId === supplierId;
  });
}

// Supplier answers are evidence for platform adjudication, not a financial instruction.
// Lock the canonical dispute while checking state, ownership and recording the response.
supplierWorkspaceRouter.post('/returns/:id/respond', requireSupplierWrite, async (req: AuthRequest, res) => {
  const supplierId = req.user!.supplierId!;
  const disputeId = String(req.params.id);
  const responseType = String(req.body?.responseType || '').trim().toUpperCase();
  const note = String(req.body?.note || '').trim();
  if (!['ACKNOWLEDGE_RETURN_REQUEST', 'CONTEST_RETURN_REQUEST'].includes(responseType)) {
    return res.status(400).json({ ok: false, error: 'Выберите корректную позицию по претензии' } satisfies ApiResponse);
  }
  if (note.length < 10 || note.length > 2000) {
    return res.status(400).json({ ok: false, error: 'Комментарий должен содержать от 10 до 2000 символов' } satisfies ApiResponse);
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; refType: string; refId: string; status: string }>>`
        SELECT "id", "refType", "refId", "status"
        FROM "disputes"
        WHERE "id" = ${disputeId}
        FOR UPDATE
      `;
      const dispute = locked[0];
      // Non-owned and unsupported references return the same result to avoid claim enumeration.
      if (!dispute || !['order', 'shop_order'].includes(dispute.refType.trim().toLowerCase())) {
        return { status: 404, body: { ok: false, error: 'Претензия не найдена в заказах текущего поставщика' } };
      }
      if (!await supplierOwnsOrderLine(supplierId, disputeId, dispute.refId, tx)) {
        return { status: 404, body: { ok: false, error: 'Претензия не найдена в заказах текущего поставщика' } };
      }
      if (!['open', 'review', 'pending'].includes(dispute.status.trim().toLowerCase())) {
        return { status: 409, body: { ok: false, error: 'Претензия уже закрыта и не принимает ответы' } };
      }

      const existing = await tx.supplierDisputeResponse.findUnique({
        where: { disputeId_supplierId: { disputeId, supplierId } },
      });
      if (existing) {
        const same = existing.responseType === responseType && existing.note === note;
        if (!same) {
          return { status: 409, body: { ok: false, error: 'Ответ уже зарегистрирован; новая позиция требует рассмотрения платформой' } };
        }
        return { status: 200, body: { ok: true, data: { response: existing, idempotent: true } } };
      }

      const created = await tx.supplierDisputeResponse.create({
        data: { id: uid(), disputeId, orderId: dispute.refId, supplierId, responseType, note, actorUserId: req.user!.id },
      });
      await writeAuditLog({
        action: 'SUPPLIER_DISPUTE_RESPONDED',
        entity: 'supplier_dispute_response',
        entityId: created.id,
        details: { disputeId, orderId: dispute.refId, supplierId, responseType },
        userId: req.user!.id,
      }, tx);
      return { status: 201, body: { ok: true, data: { response: created, idempotent: false } } };
    });
    return res.status(outcome.status).json(outcome.body as ApiResponse);
  } catch (error: any) {
    console.error('Supplier dispute response error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось зарегистрировать ответ по претензии' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.patch('/orders/:id/status', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const status = String(req.body?.status || '').toLowerCase();
    if (status === 'shipped') return res.status(409).json({ ok: false, error: 'Зарегистрируйте перевозчика и трек-номер в форме отгрузки', code: 'SUPPLIER_SHIPMENT_REQUIRED' } satisfies ApiResponse);
    if (status === 'delivered') return res.status(409).json({ ok: false, error: 'Доставка закрывается только с подтверждением вручения', code: 'SUPPLIER_DELIVERY_PROOF_REQUIRED' } satisfies ApiResponse);
    const allowed = ['packing', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'Недопустимый статус' } satisfies ApiResponse);

    const mine = await getSupplierOrders(req.user!.supplierId!);
    const owned = (mine as any[]).find((o) => o.id === req.params.id);
    if (!owned) {
      return res.status(404).json({ ok: false, error: 'Заказ не найден' } satisfies ApiResponse);
    }

    // Enforce the order status state machine — no arbitrary jumps (audit F-2).
    if (!canTransitionOrder(owned.status, status)) {
      return res.status(409).json({
        ok: false,
        error: `Недопустимый переход статуса: ${owned.status} → ${status}`,
      } satisfies ApiResponse);
    }

    let order;
    if (status === 'cancelled') {
      // Claim before restoring stock; concurrent buyer/payment transitions
      // cannot both win and restore the same reservation.
      order = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: owned.id, status: owned.status },
          data: { status, cancelledAt: new Date(), cancelReason: 'supplier_requested' },
        });
        if (claimed.count === 0) return null;
        const items = Array.isArray(owned.items) ? (owned.items as any[]) : [];
        for (const item of items) {
          if (item.productId && item.qty) {
            await tx.product.updateMany({
              where: { id: item.productId },
              data: { stock: { increment: item.qty } },
            });
          }
        }
        return tx.order.findUnique({ where: { id: owned.id } });
      });
    } else {
      const claimed = await prisma.order.updateMany({
        where: { id: owned.id, status: owned.status },
        data: { status },
      });
      if (claimed.count === 0) return res.status(409).json({ ok: false, error: 'Статус заказа уже изменился' } satisfies ApiResponse);
      order = await prisma.order.findUnique({ where: { id: owned.id } });
    }
    if (!order) return res.status(409).json({ ok: false, error: 'Статус заказа уже изменился' } satisfies ApiResponse);

    if (status === 'delivered' || status === 'completed') {
      const { releaseOrderCashback } = await import('../dentcash/cashback.engine.js');
      // Full-order release: multi-supplier split needs per-line status (future).
      await releaseOrderCashback(order.id)
        .catch((err) => console.error('[dentcash release]', err));

      // Коробка приехала — склад клиники должен узнать об этом сам.
      // Приход идемпотентен по ссылке на заказ, так что повторный перевод
      // в «доставлен» ничего не задвоит. Ошибка не валит смену статуса:
      // заказ доставлен независимо от того, удалось ли оприходовать.
      const { restockFromOrder } = await import('../inventory/orderRestock.js');
      await restockFromOrder(order.id)
        .catch((err) => console.error('[inventory restock]', err));
    }
    await writeAuditLog({
      action: 'SUPPLIER_ORDER_STATUS_CHANGED',
      entity: 'order',
      entityId: order.id,
      details: { workflow: 'supplier-operations', queueKey: 'orders', fromStatus: owned.status, toStatus: status, supplierId: req.user!.supplierId },
      userId: req.user!.id,
    });

    if (status === 'cancelled') {
      const { reverseCashback } = await import('../dentcash/refund.service.js');
      await reverseCashback({
        refType: 'order',
        refId: order.id,
        reason: 'cancelled',
      }).catch((err) => console.error('[dentcash reverse]', err));
    }

    return res.json({ ok: true, data: order } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier order status error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить статус' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.post('/promotions', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const { productId, title, discountPercent, cashbackPercent, startsAt, endsAt } = req.body || {};
    if (!productId) {
      return res.status(400).json({ ok: false, error: 'productId обязателен' } satisfies ApiResponse);
    }
    const product = await prisma.product.findFirst({
      where: { id: productId, supplierId: req.user!.supplierId },
    });
    if (!product) {
      return res.status(404).json({ ok: false, error: 'Товар не найден' } satisfies ApiResponse);
    }
    const label = title || `Акция −${Number(discountPercent) || 10}%`;
    const desc = `${product.description || ''}\n[АКЦИЯ] ${label}`.trim();
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { description: desc },
    });

    const cbPct = Number(cashbackPercent ?? discountPercent ?? 10);
    const rateBps = Math.max(0, Math.min(1500, Math.round(cbPct * 100)));
    const rule = await prisma.cashbackRule.create({
      data: {
        id: uid(),
        ownerType: 'SUPPLIER',
        ownerId: req.user!.supplierId!,
        scope: 'PRODUCT',
        scopeKey: product.id,
        rateBps,
        active: true,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });

    return res.status(201).json({
      ok: true,
      data: {
        id: rule.id,
        productId: updated.id,
        title: label,
        cashbackPercent: rateBps / 100,
        active: true,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier promotion error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать акцию' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.get('/cashback-rules', async (req: AuthRequest, res) => {
  try {
    const rules = await prisma.cashbackRule.findMany({
      where: { ownerType: 'SUPPLIER', ownerId: req.user!.supplierId! },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ ok: true, data: serializeBigInt(rules) } satisfies ApiResponse);
  } catch (error) {
    console.error('Cashback rules list error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить правила кэшбэка' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.put('/cashback-rules', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const b = req.body || {};
    const rateBps = Math.max(0, Math.min(1500, Math.round(Number(b.rateBps ?? (b.percent != null ? Number(b.percent) * 100 : 0)))));
    if (rateBps <= 0 && !b.id) {
      return res.status(400).json({ ok: false, error: 'Укажите percent или rateBps' } satisfies ApiResponse);
    }
    const scope = String(b.scope || 'ALL').toUpperCase();
    const allowed = ['ALL', 'CATEGORY', 'PRODUCT', 'OWN_BRAND'];
    if (!allowed.includes(scope)) {
      return res.status(400).json({ ok: false, error: 'Некорректный scope' } satisfies ApiResponse);
    }

    let rule;
    if (b.id) {
      const existing = await prisma.cashbackRule.findFirst({
        where: { id: b.id, ownerType: 'SUPPLIER', ownerId: req.user!.supplierId! },
      });
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'Правило не найдено' } satisfies ApiResponse);
      }
      rule = await prisma.cashbackRule.update({
        where: { id: existing.id },
        data: {
          ...(b.scope !== undefined && { scope: scope as any }),
          ...(b.scopeKey !== undefined && { scopeKey: b.scopeKey || null }),
          ...(rateBps > 0 && { rateBps }),
          ...(b.active !== undefined && { active: !!b.active }),
          ...(b.startsAt !== undefined && { startsAt: b.startsAt ? new Date(b.startsAt) : null }),
          ...(b.endsAt !== undefined && { endsAt: b.endsAt ? new Date(b.endsAt) : null }),
          ...(b.capTenge !== undefined && { capMinor: b.capTenge != null ? tengeToMinor(Number(b.capTenge)) : null }),
        },
      });
    } else {
      rule = await prisma.cashbackRule.create({
        data: {
          id: uid(),
          ownerType: 'SUPPLIER',
          ownerId: req.user!.supplierId!,
          scope: scope as any,
          scopeKey: b.scopeKey || null,
          rateBps,
          capMinor: b.capTenge != null ? tengeToMinor(Number(b.capTenge)) : null,
          active: b.active !== false,
          startsAt: b.startsAt ? new Date(b.startsAt) : null,
          endsAt: b.endsAt ? new Date(b.endsAt) : null,
        },
      });
    }
    return res.json({ ok: true, data: serializeBigInt(rule) } satisfies ApiResponse);
  } catch (error) {
    console.error('Cashback rules upsert error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить правило' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.delete('/cashback-rules/:id', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.cashbackRule.findFirst({
      where: { id: req.params.id as string, ownerType: 'SUPPLIER', ownerId: req.user!.supplierId! },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Правило не найдено' } satisfies ApiResponse);
    }
    await prisma.cashbackRule.delete({ where: { id: existing.id } });
    return res.json({ ok: true, data: { id: existing.id } } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Не удалось удалить правило' } satisfies ApiResponse);
  }
});

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
        imageUrl: typeof b.imageUrl === 'string' && b.imageUrl.trim() ? b.imageUrl.trim() : null,
        manufacturer: b.manufacturer || null,
        country: b.country || null,
        compatibility: b.compatibility || null,
        ownBrand: !!b.ownBrand,
        supplierId: req.user!.supplierId,
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
      ...(b.ownBrand !== undefined && { ownBrand: !!b.ownBrand }),
      ...(b.brand !== undefined && { brand: b.brand || null }),
      ...(b.imageUrl !== undefined && {
        imageUrl: typeof b.imageUrl === 'string' && b.imageUrl.trim() ? b.imageUrl.trim() : null,
      }),
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

supplierWorkspaceRouter.get('/wallet', async (req: AuthRequest, res) => {
  const wallet = await getOrCreateWallet('SUPPLIER', req.user!.supplierId!);
  return res.json({ ok: true, data: serializeBigInt(wallet) } satisfies ApiResponse);
});

supplierWorkspaceRouter.post('/payouts', requireSupplierWrite, async (req: AuthRequest, res) => {
  const { amount, amountMinor } = req.body || {};
  if (amount === undefined && amountMinor === undefined) {
    return res.status(400).json({ ok: false, error: 'amount обязателен' } satisfies ApiResponse);
  }
  let minor: bigint;
  try {
    minor = amountMinor !== undefined ? BigInt(amountMinor) : parseTengeToMinor(amount);
  } catch {
    return res.status(400).json({ ok: false, error: 'Некорректная сумма' } satisfies ApiResponse);
  }
  // Through the service, not inline: the balance check that used to live here
  // compared against the raw wallet balance, so the same funds could be
  // requested any number of times. `requestPayout` checks what is actually
  // available — balance minus everything already requested and unresolved.
  try {
    const payout = await requestPayout({ ownerType: 'SUPPLIER', ownerId: req.user!.supplierId!, amountMinor: minor });
    return res.status(201).json({ ok: true, data: serializeBigInt(payout) } satisfies ApiResponse);
  } catch (e: any) {
    if (e instanceof PayoutError) {
      return res.status(e.code === 'INSUFFICIENT_FUNDS' ? 409 : 400).json({ ok: false, error: e.message } satisfies ApiResponse);
    }
    throw e;
  }
});

supplierWorkspaceRouter.get('/analytics', async (req: AuthRequest, res) => {
  try {
    const dash = await buildSupplierDashboard(req.user!.supplierId!);
    return res.json({
      ok: true,
      data: {
        balanceMinor: dash.kpis.balanceMinor,
        earnedMinor: dash.kpis.earnedMinor,
        salesCount: dash.kpis.salesCount,
        productCount: dash.kpis.productCount,
        currency: dash.kpis.currency,
        orders30: dash.kpis.orders30,
        revenue30: dash.kpis.revenue30,
        avgRating: dash.kpis.avgRating,
        lowStockCount: dash.kpis.lowStockCount,
        openReturns: dash.kpis.openReturns,
        insights: dash.insights.slice(0, 5),
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Supplier analytics error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка аналитики' } satisfies ApiResponse);
  }
});

// ─── Delivery Zones ───

supplierWorkspaceRouter.get('/delivery-zones', requireSupplierContext, async (req: AuthRequest, res) => {
  try {
    const zones = await prisma.deliveryZone.findMany({
      where: { supplierId: req.user!.supplierId },
      orderBy: { name: 'asc' },
    });
    return res.json({ ok: true, data: zones } satisfies ApiResponse);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Ошибка загрузки зон доставки' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.post('/delivery-zones', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const { name, cities, cost, freeFrom, estimatedDays } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'Название зоны обязательно' } satisfies ApiResponse);
    const zone = await prisma.deliveryZone.create({
      data: {
        id: uid(),
        supplierId: req.user!.supplierId!,
        name,
        cities: cities || [],
        cost: cost ? parseInt(cost) : 0,
        freeFrom: freeFrom ? parseInt(freeFrom) : null,
        estimatedDays: estimatedDays ? parseInt(estimatedDays) : null,
      },
    });
    return res.status(201).json({ ok: true, data: zone } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message || 'Ошибка создания зоны' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.put('/delivery-zones/:id', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.deliveryZone.findUnique({ where: { id: req.params.id as string } });
    if (!existing || existing.supplierId !== req.user!.supplierId) {
      return res.status(404).json({ ok: false, error: 'Зона не найдена' } satisfies ApiResponse);
    }
    const { name, cities, cost, freeFrom, estimatedDays } = req.body || {};
    const zone = await prisma.deliveryZone.update({
      where: { id: req.params.id as string },
      data: {
        ...(name && { name }),
        ...(cities !== undefined && { cities }),
        ...(cost !== undefined && { cost: parseInt(cost) }),
        ...(freeFrom !== undefined && { freeFrom: freeFrom ? parseInt(freeFrom) : null }),
        ...(estimatedDays !== undefined && { estimatedDays: estimatedDays ? parseInt(estimatedDays) : null }),
      },
    });
    return res.json({ ok: true, data: zone } satisfies ApiResponse);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message || 'Ошибка обновления зоны' } satisfies ApiResponse);
  }
});

supplierWorkspaceRouter.delete('/delivery-zones/:id', requireSupplierWrite, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.deliveryZone.findUnique({ where: { id: req.params.id as string } });
    if (!existing || existing.supplierId !== req.user!.supplierId) {
      return res.status(404).json({ ok: false, error: 'Зона не найдена' } satisfies ApiResponse);
    }
    await prisma.deliveryZone.delete({ where: { id: req.params.id as string } });
    return res.json({ ok: true } satisfies ApiResponse);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Ошибка удаления зоны' } satisfies ApiResponse);
  }
});

export default supplierWorkspaceRouter;
