import { describe, expect, it } from 'vitest';
import { orderHasSupplierLine } from './supplierOrderOwnership.js';

describe('supplier order-line ownership', () => {
  it('allows each seller to act only on its own line in a multi-supplier order', () => {
    const orderItems = [
      { product_id: 'product-a', supplier_id: 'supplier-a' },
      { product_id: 'product-b', supplier_id: 'supplier-b' },
    ];
    // The order-level supplier pointer may identify supplier A only; it is not
    // used as proof that every line belongs to A.
    expect(orderHasSupplierLine(orderItems, 'supplier-a', new Set(['product-a']))).toBe(true);
    expect(orderHasSupplierLine(orderItems, 'supplier-b', new Set(['product-b']))).toBe(true);
    expect(orderHasSupplierLine(orderItems, 'supplier-c', new Set(['product-c']))).toBe(false);
  });

  it('uses the persisted seller snapshot even if the product is no longer in the live catalogue', () => {
    expect(orderHasSupplierLine(
      [{ product_id: 'archived-product', supplier_id: 'supplier-b' }],
      'supplier-b',
      new Set(),
    )).toBe(true);
    expect(orderHasSupplierLine(
      [{ product_id: 'archived-product', supplier_id: 'supplier-b' }],
      'supplier-a',
      new Set(['archived-product']),
    )).toBe(false);
  });

  it('uses live product ownership only for legacy lines without a seller snapshot', () => {
    expect(orderHasSupplierLine([{ product_id: 'legacy-product' }], 'supplier-a', new Set(['legacy-product']))).toBe(true);
    expect(orderHasSupplierLine([{ product_id: 'legacy-product' }], 'supplier-b', new Set())).toBe(false);
  });

  it('fails closed for malformed items and missing supplier context', () => {
    expect(orderHasSupplierLine(null, 'supplier-a', new Set(['product-a']))).toBe(false);
    expect(orderHasSupplierLine(['not-an-object', null], 'supplier-a', new Set(['product-a']))).toBe(false);
    expect(orderHasSupplierLine([{ supplier_id: 'supplier-a' }], '', new Set())).toBe(false);
  });
});
