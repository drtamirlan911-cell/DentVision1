import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCheckoutItems } from './checkout.validation.js';

const here = dirname(fileURLToPath(import.meta.url));
const route = await readFile(resolve(here, 'shop.routes.ts'), 'utf8');

// Input validation must be a hard boundary before idempotency or inventory work.
const normalizeCall = 'const normalizedItems = normalizeCheckoutItems(items);';
assert.match(route, /const normalizedItems = normalizeCheckoutItems\(items\);/);
assert.ok(route.indexOf(normalizeCall) < route.indexOf('reserveIdempotencyKey('));
assert.ok(route.indexOf(normalizeCall) < route.indexOf('prisma.product.findMany('));

// The real route must consume canonical quantities everywhere inventory is touched.
assert.doesNotMatch(route, /Math\.max\(1, Number\(raw\.(?:quantity|qty)/);
assert.match(route, /for \(const line of normalizedItems\)/);

// Supplier status must be checked from the server-side relation, not client input.
assert.match(route, /assertCheckoutSupplierEligibility\(p\.supplier\?\.status, p\.supplierId\)/);

// External payment creation must not live inside a Prisma transaction callback.
const providerCall = "providers.kaspi_qr.createPayment({ amountMinor, refId: order.id })";
const providerIndex = route.indexOf(providerCall);
const phase3Index = route.indexOf('// Phase 3: persist payment intent');
const phase4Index = route.indexOf('// Phase 4: Cashback');
assert.ok(providerIndex > phase3Index && providerIndex < phase4Index);
const providerWindow = route.slice(Math.max(0, route.lastIndexOf('prisma.$transaction', providerIndex)), providerIndex);
assert.doesNotMatch(providerWindow, /providers\.kaspi_qr\.createPayment/);

// Known failures compensate; uncertain provider outcomes are preserved for reconciliation.
assert.match(route, /compensateDeterministicCheckoutFailure\(orderId, 'dentcash_spend_failed'\)/);
assert.match(route, /compensateDeterministicCheckoutFailure\(order\.id, 'payment_provider_rejected'\)/);
assert.match(route, /status: 'payment_unknown'/);
assert.match(route, /paymentUnknown \? 202 : 201/);

// Regression matrix for malformed client quantities.
for (const raw of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '1.5', '-1', 'Infinity', null, {}, []]) {
  assert.equal(normalizeCheckoutItems([{ productId: 'p1', quantity: raw }]), null, `quantity ${String(raw)} must be rejected`);
}
assert.deepEqual(normalizeCheckoutItems([{ productId: 'p1', quantity: 1 }]), [{ productId: 'p1', quantity: 1 }]);
assert.equal(normalizeCheckoutItems([
  { productId: 'p1', quantity: 1 },
  { productId: 'p1', quantity: 2 },
]), null, 'duplicate product lines must be rejected');

console.log('checkout route contract: PASS');
