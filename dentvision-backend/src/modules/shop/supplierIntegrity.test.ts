import { describe, expect, it } from 'vitest';
import {
  assertCheckoutSupplierEligibility,
  isSupplierEligibleForCheckout,
} from './supplierIntegrity.js';

describe('shop supplier checkout integrity', () => {
  it('allows only verified and official partners', () => {
    expect(isSupplierEligibleForCheckout('verified')).toBe(true);
    expect(isSupplierEligibleForCheckout('official_partner')).toBe(true);
    expect(isSupplierEligibleForCheckout('pending')).toBe(false);
    expect(isSupplierEligibleForCheckout('documents_review')).toBe(false);
    expect(isSupplierEligibleForCheckout('suspended')).toBe(false);
    expect(isSupplierEligibleForCheckout(null)).toBe(false);
  });

  it('requires a supplier for normal checkout', () => {
    expect(() => assertCheckoutSupplierEligibility('verified', 'supplier-1')).not.toThrow();
    expect(() => assertCheckoutSupplierEligibility('pending', 'supplier-1')).toThrow('CHECKOUT_SUPPLIER_NOT_ELIGIBLE');
    expect(() => assertCheckoutSupplierEligibility('verified', null)).toThrow('CHECKOUT_SUPPLIER_REQUIRED');
  });

  it('allows explicitly platform-owned products without a supplier', () => {
    expect(() => assertCheckoutSupplierEligibility(null, null, true)).not.toThrow();
    expect(() => assertCheckoutSupplierEligibility(null, null, false)).toThrow('CHECKOUT_SUPPLIER_REQUIRED');
  });
});
