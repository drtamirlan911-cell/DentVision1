export const MARKETPLACE_RETURN_REASON_CODES = [
  'DAMAGED',
  'WRONG_ITEM',
  'MISSING_ITEMS',
  'NOT_AS_DESCRIBED',
  'NOT_DELIVERED',
  'OTHER',
] as const;

export type MarketplaceReturnReasonCode = (typeof MARKETPLACE_RETURN_REASON_CODES)[number];

export interface NormalizedMarketplaceReturnItem {
  lineIndex: number;
  productId: string;
  supplierId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  reasonCode: MarketplaceReturnReasonCode;
  note: string | null;
}

type OrderLineSnapshot = {
  product_id?: unknown;
  productId?: unknown;
  supplier_id?: unknown;
  supplierId?: unknown;
  name?: unknown;
  productName?: unknown;
  quantity?: unknown;
  qty?: unknown;
  price?: unknown;
};

export function normalizeMarketplaceReturnItems(
  input: unknown,
  orderItems: unknown,
  previouslyRequested: ReadonlyMap<number, number> = new Map(),
): NormalizedMarketplaceReturnItem[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 30 || !Array.isArray(orderItems)) return null;

  const usedLines = new Set<number>();
  const result: NormalizedMarketplaceReturnItem[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    const lineIndex = item.lineIndex;
    const quantity = item.quantity;
    const reasonCode = String(item.reasonCode || '').trim().toUpperCase();
    const note = typeof item.note === 'string' ? item.note.trim() : '';

    if (!Number.isSafeInteger(lineIndex) || Number(lineIndex) < 0 || Number(lineIndex) >= orderItems.length) return null;
    const index = Number(lineIndex);
    if (usedLines.has(index)) return null;
    usedLines.add(index);

    if (!Number.isSafeInteger(quantity) || Number(quantity) <= 0) return null;
    if (!(MARKETPLACE_RETURN_REASON_CODES as readonly string[]).includes(reasonCode)) return null;
    if (note.length > 1000 || (reasonCode === 'OTHER' && note.length < 10)) return null;

    const rawLine = orderItems[index];
    if (!rawLine || typeof rawLine !== 'object' || Array.isArray(rawLine)) return null;
    const line = rawLine as OrderLineSnapshot;
    const productId = String(line.product_id ?? line.productId ?? '').trim();
    const purchasedQuantity = Number(line.quantity ?? line.qty);
    const unitPrice = Number(line.price);
    if (!productId || !Number.isSafeInteger(purchasedQuantity) || purchasedQuantity <= 0) return null;
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) return null;

    const outstanding = purchasedQuantity - (previouslyRequested.get(index) || 0);
    if (Number(quantity) > outstanding) return null;

    const supplierRaw = line.supplier_id ?? line.supplierId;
    const supplierId = supplierRaw == null || String(supplierRaw).trim() === ''
      ? null
      : String(supplierRaw).trim();
    const productName = String(line.productName ?? line.name ?? 'Товар').trim().slice(0, 240) || 'Товар';

    result.push({
      lineIndex: index,
      productId,
      supplierId,
      productName,
      quantity: Number(quantity),
      unitPrice,
      reasonCode: reasonCode as MarketplaceReturnReasonCode,
      note: note || null,
    });
  }

  return result;
}

export function canRequestMarketplaceReturn(
  order: { status: string; paymentStatus: string; paymentMethod?: string | null; meta?: unknown },
  items: readonly Pick<NormalizedMarketplaceReturnItem, 'reasonCode'>[],
): boolean {
  if (items.length === 0) return false;
  const status = String(order.status || '').trim().toLowerCase();
  const paymentStatus = String(order.paymentStatus || '').trim().toLowerCase();
  const meta = order.meta && typeof order.meta === 'object' && !Array.isArray(order.meta)
    ? order.meta as Record<string, unknown>
    : {};
  const paymentMethod = String(order.paymentMethod || meta.payment_method || '').trim().toLowerCase();
  const delivered = ['delivered', 'completed'].includes(status);
  const shipped = status === 'shipped';
  if (!delivered && !shipped) return false;

  const settled = ['paid', 'completed', 'succeeded'].includes(paymentStatus);
  const cashOnDelivery = paymentMethod === 'cash' && delivered;
  if (!settled && !cashOnDelivery) return false;

  if (shipped) return items.every((item) => item.reasonCode === 'NOT_DELIVERED');
  return true;
}
