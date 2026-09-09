import type { SupplierStatus } from '@prisma/client';

/**
 * Checkout must never rely on a client-visible supplier flag. Only suppliers
 * that have completed verification may have products sold through the Shop.
 * Official partners inherit the verified state.
 */
export function isSupplierEligibleForCheckout(status: SupplierStatus | string | null | undefined): boolean {
  return status === 'verified' || status === 'official_partner';
}

/**
 * Server-side invariant for a product selected for checkout.
 * A missing supplier is only valid for explicitly owned platform products;
 * callers must pass `allowPlatformOwned=true` for that exceptional case.
 */
export function assertCheckoutSupplierEligibility(
  supplierStatus: SupplierStatus | string | null | undefined,
  supplierId: string | null | undefined,
  allowPlatformOwned = false,
): void {
  if (!supplierId && allowPlatformOwned) return;
  if (!supplierId) throw new Error('CHECKOUT_SUPPLIER_REQUIRED');
  if (!isSupplierEligibleForCheckout(supplierStatus)) {
    throw new Error('CHECKOUT_SUPPLIER_NOT_ELIGIBLE');
  }
}
