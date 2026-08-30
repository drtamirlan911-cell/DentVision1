/**
 * Приход на склад клиники из доставленного заказа маркетплейса.
 *
 * Клиника заказывала перчатки через наш же магазин, коробка приезжала — и
 * склад об этом не узнавал: заказ и склад жили как две несвязанные таблицы,
 * и остаток приходилось вбивать руками поверх того, что система уже знала.
 *
 * Повторные вызовы безопасны: движения пишутся с ссылкой на заказ, а
 * уникальный ключ журнала (refType, refId, itemId) не даёт оприходовать один
 * и тот же заказ дважды — сколько бы раз ни повторился переход в «доставлен».
 */

import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { recordMovement, isMovementApplied } from './ledger.js';

/** Строка снимка заказа: так её кладёт shop.routes при создании. */
interface OrderLine {
  product_id?: string;
  productId?: string;
  id?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  price?: number;
}

export interface RestockResult {
  /** Позиции, остаток которых вырос. */
  received: Array<{ itemId: string; name: string; quantity: number; created: boolean }>;
  /** Позиции, которые клиника ведёт вручную (autoRestock выключен). */
  skippedManual: string[];
  /** Заказ уже приходовали — второй раз ничего не сделано. */
  alreadyApplied: boolean;
}

/**
 * Ключ сопоставления по названию.
 *
 * Регистр, пунктуация и повторные пробелы у одного товара расходятся между
 * карточкой маркета и тем, как позицию назвали на складе; на них опираться
 * нельзя. `\p{L}` с флагом `u` намеренно — латинский `\w` в JavaScript это
 * `[A-Za-z0-9_]`, и на русских названиях он молча выкидывает половину строки.
 */
export function normalizeItemName(raw: string | null | undefined): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export async function restockFromOrder(orderId: string): Promise<RestockResult> {
  const empty: RestockResult = { received: [], skippedManual: [], alreadyApplied: false };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, clinicId: true, items: true },
  });
  // Заказ без клиники — покупка пользователя маркетплейса, а не клиники:
  // приходовать некуда.
  if (!order || !order.clinicId) return empty;

  const clinicId = order.clinicId;
  const lines: OrderLine[] = Array.isArray(order.items) ? (order.items as OrderLine[]) : [];
  if (lines.length === 0) return empty;

  const productIds = lines
    .map((l) => String(l.product_id || l.productId || l.id || ''))
    .filter(Boolean);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true, name: true, sku: true, unit: true, price: true,
          category: true, shopCategory: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      })
    : [];
  const productById = new Map(products.map((p) => [p.id, p]));

  const existing = await prisma.inventoryItem.findMany({
    where: { clinicId },
    select: { id: true, name: true, sku: true, productId: true, autoRestock: true },
  });
  const byProduct = new Map(existing.filter((i) => i.productId).map((i) => [i.productId as string, i]));
  const bySku = new Map(existing.filter((i) => i.sku).map((i) => [String(i.sku).toLowerCase(), i]));
  const byName = new Map(existing.map((i) => [normalizeItemName(i.name), i]));

  // Строки схлопываем до цикла: ключ идемпотентности — (заказ, позиция), и
  // две строки на один товар превратились бы в один приход с потерянным
  // количеством вместо суммы.
  const merged = new Map<string, { productId: string; name: string; qty: number; price: number }>();
  for (const line of lines) {
    const productId = String(line.product_id || line.productId || line.id || '');
    const qty = Math.max(0, Math.trunc(Number(line.quantity ?? line.qty ?? 0)));
    if (qty === 0) continue;
    const product = productId ? productById.get(productId) : undefined;
    const name = String(line.name || product?.name || '').trim();
    if (!name) continue;
    const key = productId || normalizeItemName(name);
    const prev = merged.get(key);
    if (prev) prev.qty += qty;
    else merged.set(key, { productId, name, qty, price: Number(line.price) || 0 });
  }

  const result: RestockResult = { received: [], skippedManual: [], alreadyApplied: false };
  let sawDuplicate = false;
  let sawWork = false;

  for (const line of merged.values()) {
    const { productId, name, qty } = line;
    const product = productId ? productById.get(productId) : undefined;

    // Артикул — единственный надёжный ключ; название идёт последним, потому
    // что у одного товара оно расходится от поставщика к поставщику.
    let item =
      (productId ? byProduct.get(productId) : undefined)
      || (product?.sku ? bySku.get(String(product.sku).toLowerCase()) : undefined)
      || byName.get(normalizeItemName(name));

    let created = false;
    if (!item) {
      const fresh = await prisma.inventoryItem.create({
        data: {
          id: uid(),
          clinicId,
          name,
          // Позиция создаётся пустой, а остаток даёт движение прихода —
          // иначе в журнале была бы дыра: количество есть, объяснения нет.
          quantity: 0,
          minimum: 0,
          category: product?.shopCategory?.name || product?.category || null,
          unit: product?.unit || null,
          price: product?.price != null ? Number(product.price) : Number(line.price) || null,
          supplier: product?.supplier?.name || null,
          sku: product?.sku || null,
          productId: productId || null,
          autoRestock: true,
        },
        select: { id: true, name: true, sku: true, productId: true, autoRestock: true },
      });
      item = fresh;
      created = true;
      byProduct.set(productId || fresh.id, fresh);
      byName.set(normalizeItemName(name), fresh);
    } else if (!item.autoRestock) {
      // Клиника ведёт эту позицию вручную — молча плюсовать остаток нельзя.
      result.skippedManual.push(item.name);
      continue;
    } else if (productId && !item.productId) {
      // Сопоставили по названию или артикулу — закрепляем связь, чтобы
      // следующий заказ нашёл позицию сразу и точно.
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { productId, ...(product?.sku && !item.sku ? { sku: product.sku } : {}) },
      });
    }

    const outcome = await prisma.$transaction((tx) => recordMovement(tx, {
      clinicId,
      itemId: item!.id,
      delta: qty,
      reason: 'order_delivery',
      refType: 'order',
      refId: order.id,
      note: `Заказ ${order.id.slice(0, 8)}`,
    }));

    if (isMovementApplied(outcome)) {
      sawWork = true;
      result.received.push({ itemId: item.id, name: item.name, quantity: outcome.delta, created });
    } else if (outcome.reason === 'duplicate') {
      sawDuplicate = true;
    }
  }

  result.alreadyApplied = sawDuplicate && !sawWork;
  return result;
}
