import { describe, expect, it } from 'vitest';
import { isValidCheckoutItem, parseCheckoutCashMinor, parseCheckoutQuantity } from './checkout.validation.js';

describe('shop checkout validation', () => {
  it('accepts only positive safe integers for quantity', () => {
    expect(parseCheckoutQuantity(1)).toBe(1);
    expect(parseCheckoutQuantity('2')).toBe(2);
    expect(parseCheckoutQuantity(' 3 ')).toBe(3);
    expect(parseCheckoutQuantity('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects zero, negative, fractional, NaN, infinity and unsafe quantities', () => {
    expect(parseCheckoutQuantity(0)).toBeNull();
    expect(parseCheckoutQuantity(-1)).toBeNull();
    expect(parseCheckoutQuantity(1.5)).toBeNull();
    expect(parseCheckoutQuantity(Number.NaN)).toBeNull();
    expect(parseCheckoutQuantity(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseCheckoutQuantity('1.5')).toBeNull();
    expect(parseCheckoutQuantity('-2')).toBeNull();
    expect(parseCheckoutQuantity('1e3')).toBeNull();
    expect(parseCheckoutQuantity(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(parseCheckoutQuantity('9007199254740992')).toBeNull();
    expect(parseCheckoutQuantity('')).toBeNull();
    expect(parseCheckoutQuantity('0')).toBeNull();
    expect(parseCheckoutQuantity(true)).toBeNull();
    expect(parseCheckoutQuantity({})).toBeNull();
    expect(parseCheckoutQuantity(null)).toBeNull();
  });

  it('accepts non-negative minor-unit cash values and rejects malformed values', () => {
    expect(parseCheckoutCashMinor(0)).toBe(0n);
    expect(parseCheckoutCashMinor('1250')).toBe(1250n);
    expect(parseCheckoutCashMinor(Number.MAX_SAFE_INTEGER)).toBe(BigInt(Number.MAX_SAFE_INTEGER));
    expect(parseCheckoutCashMinor(-1)).toBeNull();
    expect(parseCheckoutCashMinor('1.5')).toBeNull();
    expect(parseCheckoutCashMinor('abc')).toBeNull();
    expect(parseCheckoutCashMinor('')).toBeNull();
    expect(parseCheckoutCashMinor('-1')).toBeNull();
    expect(parseCheckoutCashMinor(true)).toBeNull();
  });

  it('requires a plain checkout item object', () => {
    expect(isValidCheckoutItem({ productId: 'p1', quantity: 1 })).toBe(true);
    expect(isValidCheckoutItem(null)).toBe(false);
    expect(isValidCheckoutItem([])).toBe(false);
    expect(isValidCheckoutItem('item')).toBe(false);
    expect(isValidCheckoutItem(1)).toBe(false);
  });
});
