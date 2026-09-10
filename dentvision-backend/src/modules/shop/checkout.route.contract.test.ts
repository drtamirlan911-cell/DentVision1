import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { normalizeCheckoutItems } from './checkout.validation.js';

const here = dirname(fileURLToPath(import.meta.url));
const route = await readFile(resolve(here, 'shop.routes.ts'), 'utf8');

describe('checkout route contract', () => {
  it('enforces checkout validation, provider phases, compensation, and quantity boundaries', () => {
    const checkoutRouteStart = route.indexOf("shopRouter.post('/orders'");
    assert.ok(checkoutRouteStart >= 0, 'checkout order route must exist');
    const checkoutRoute = route.slice(checkoutRouteStart);
    const normalizeCall = 'const normalizedItems = normalizeCheckoutItems(items);';

    assert.match(checkoutRoute, /const normalizedItems = normalizeCheckoutItems\(items\);/);
    assert.ok(checkoutRoute.indexOf(normalizeCall) < checkoutRoute.indexOf('reserveIdempotencyKey('));
    assert.ok(checkoutRoute.indexOf(normalizeCall) < checkoutRoute.indexOf('prisma.product.findMany('));
    assert.doesNotMatch(checkoutRoute, /Math\.max\(1, Number\(raw\.(?:quantity|qty)/);
    assert.match(checkoutRoute, /for \(const line of normalizedItems\)/);
    assert.match(checkoutRoute, /assertCheckoutSupplierEligibility\(p\.supplier\?\.status, p\.supplierId\)/);

    const providerCall = "providers.kaspi_qr.createPayment({ amountMinor, refId: order.id })";
    const providerIndex = checkoutRoute.indexOf(providerCall);
    const phase3Index = checkoutRoute.indexOf('// Phase 3: persist payment intent');
    const phase4Index = checkoutRoute.indexOf('// Phase 4: Cashback');
    assert.ok(providerIndex > phase3Index && providerIndex < phase4Index);
    const providerWindow = checkoutRoute.slice(Math.max(0, checkoutRoute.lastIndexOf('prisma.$transaction', providerIndex)), providerIndex);
    assert.doesNotMatch(providerWindow, /providers\.kaspi_qr\.createPayment/);

    assert.match(checkoutRoute, /compensateDeterministicCheckoutFailure\(orderId, 'dentcash_spend_failed'\)/);
    assert.match(checkoutRoute, /compensateDeterministicCheckoutFailure\(order\.id, 'payment_provider_rejected'\)/);
    assert.match(checkoutRoute, /status: 'payment_unknown'/);
    assert.match(checkoutRoute, /paymentUnknown \? 202 : 201/);

    for (const raw of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '1.5', '-1', 'Infinity', null, {}, []]) {
      assert.equal(normalizeCheckoutItems([{ productId: 'p1', quantity: raw }]), null, `quantity ${String(raw)} must be rejected`);
    }
    assert.deepEqual(normalizeCheckoutItems([{ productId: 'p1', quantity: 1 }]), [{ productId: 'p1', quantity: 1 }]);
    assert.equal(normalizeCheckoutItems([
      { productId: 'p1', quantity: 1 },
      { productId: 'p1', quantity: 2 },
    ]), null, 'duplicate product lines must be rejected');
  });
});
