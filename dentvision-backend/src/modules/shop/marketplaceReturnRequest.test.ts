import { describe, expect, it } from 'vitest';
import {
  canRequestMarketplaceReturn,
  normalizeMarketplaceReturnItems,
} from './marketplaceReturnRequest.js';

const orderItems = [
  { product_id: 'product-a', supplier_id: 'supplier-a', name: 'Материал A', quantity: 3, price: 1200 },
  { product_id: 'product-b', supplier_id: 'supplier-b', name: 'Бор B', qty: 2, price: 800 },
];

describe('Marketplace return request validation', () => {
  it('snapshots seller, product, quantity and price from the canonical order line', () => {
    expect(normalizeMarketplaceReturnItems([
      { lineIndex: 0, quantity: 2, reasonCode: 'DAMAGED', note: 'Упаковка повреждена' },
      { lineIndex: 1, quantity: 1, reasonCode: 'WRONG_ITEM' },
    ], orderItems)).toEqual([
      { lineIndex: 0, productId: 'product-a', supplierId: 'supplier-a', productName: 'Материал A', quantity: 2, unitPrice: 1200, reasonCode: 'DAMAGED', note: 'Упаковка повреждена' },
      { lineIndex: 1, productId: 'product-b', supplierId: 'supplier-b', productName: 'Бор B', quantity: 1, unitPrice: 800, reasonCode: 'WRONG_ITEM', note: null },
    ]);
  });

  it('rejects duplicated lines, invalid indexes, non-integer or excessive quantities', () => {
    expect(normalizeMarketplaceReturnItems([], orderItems)).toBeNull();
    expect(normalizeMarketplaceReturnItems([{ lineIndex: 0, quantity: 1, reasonCode: 'DAMAGED' }, { lineIndex: 0, quantity: 1, reasonCode: 'DAMAGED' }], orderItems)).toBeNull();
    expect(normalizeMarketplaceReturnItems([{ lineIndex: 4, quantity: 1, reasonCode: 'DAMAGED' }], orderItems)).toBeNull();
    expect(normalizeMarketplaceReturnItems([{ lineIndex: 0, quantity: 1.5, reasonCode: 'DAMAGED' }], orderItems)).toBeNull();
    expect(normalizeMarketplaceReturnItems([{ lineIndex: 0, quantity: 4, reasonCode: 'DAMAGED' }], orderItems)).toBeNull();
  });

  it('enforces remaining quantity across previous non-rejected return requests', () => {
    expect(normalizeMarketplaceReturnItems([{ lineIndex: 0, quantity: 2, reasonCode: 'DAMAGED' }], orderItems, new Map([[0, 1]]))).toEqual([
      expect.objectContaining({ lineIndex: 0, quantity: 2 }),
    ]);
    expect(normalizeMarketplaceReturnItems([{ lineIndex: 0, quantity: 3, reasonCode: 'DAMAGED' }], orderItems, new Map([[0, 1]]))).toBeNull();
  });

  it('validates the reason code and note without trusting client product data', () => {
    expect(normalizeMarketplaceReturnItems([{ lineIndex: 0, quantity: 1, reasonCode: 'FREE_REFUND' }], orderItems)).toBeNull();
    expect(normalizeMarketplaceReturnItems([{ lineIndex: 0, quantity: 1, reasonCode: 'OTHER', note: 'short' }], orderItems)).toBeNull();
    expect(normalizeMarketplaceReturnItems([{ lineIndex: 0, quantity: 1, reasonCode: 'DAMAGED', note: 'x'.repeat(1001) }], orderItems)).toBeNull();
  });

  it('allows paid shipped orders only for non-delivery claims and paid/cash delivered orders for item claims', () => {
    const shipped = { status: 'shipped', paymentStatus: 'paid', paymentMethod: 'kaspi' };
    expect(canRequestMarketplaceReturn(shipped, [{ reasonCode: 'NOT_DELIVERED' }])).toBe(true);
    expect(canRequestMarketplaceReturn(shipped, [{ reasonCode: 'DAMAGED' }])).toBe(false);
    expect(canRequestMarketplaceReturn({ status: 'delivered', paymentStatus: 'paid' }, [{ reasonCode: 'DAMAGED' }])).toBe(true);
    expect(canRequestMarketplaceReturn({ status: 'delivered', paymentStatus: 'pending', paymentMethod: 'cash' }, [{ reasonCode: 'WRONG_ITEM' }])).toBe(true);
    expect(canRequestMarketplaceReturn({ status: 'packing', paymentStatus: 'paid' }, [{ reasonCode: 'DAMAGED' }])).toBe(false);
    expect(canRequestMarketplaceReturn({ status: 'delivered', paymentStatus: 'pending', paymentMethod: 'kaspi' }, [{ reasonCode: 'DAMAGED' }])).toBe(false);
  });
});
