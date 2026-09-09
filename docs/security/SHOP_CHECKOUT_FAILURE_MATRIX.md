# Shop Checkout Failure Matrix

Status: ACTIVE / RELEASE CONTROL
Branch: `autonomous/superapp-foundation-2026-09-09`

## Invariants

1. Client totals, prices, supplier IDs, and stock values are never trusted as financial truth.
2. Every checkout has one idempotency key and one canonical order reference.
3. Inventory must be reserved/decremented at most once and restored at most once.
4. DentCash must be debited at most once and reversed at most once.
5. External payment-provider calls must be retry-safe and must not be coupled to an open DB transaction.
6. An order must never become `paid` without a durable payment record/reference.
7. A failed checkout must end in a recoverable state; no silent partial success.

## Required state machine

`pending` → `payment_processing` → `awaiting_payment` → `paid`

Failure branches:

- `pending` → `cancelled`
- `payment_processing` → `payment_failed` → retry or `cancelled`
- `awaiting_payment` → `paid` or `cancelled`
- `paid` → refund workflow only; never reuse cancellation as a refund mechanism

## Failure cases

| Failure | Inventory | DentCash | External payment | Order |
|---|---|---|---|---|
| Stock unavailable | no change | no debit | none | not created |
| DB order creation failure | transaction rollback | no debit | none | absent |
| DentCash failure | restore exactly once | no successful debit | none | cancelled |
| DentCash success + finalization failure | restore exactly once | reverse exactly once | none/unchanged | cancelled or recovery-required |
| Provider call fails | restore or retain reservation according to state | reverse if already spent | retry-safe | payment_failed/retryable |
| Provider succeeds, DB write fails | retain/reconcile provider reference | reverse only if business state is cancelled | reconcile/cancel using provider API | recovery-required |
| Client retry with same key | no duplicate | no duplicate | no duplicate | return canonical order |
| Concurrent checkout with different keys | atomic stock guard | wallet balance guard | separate payment refs | only orders with successfully reserved stock |
| Cancellation after payment | release only reserved stock; paid inventory follows refund policy | refund if spent and refundable | refund/reversal workflow | refunding/refunded |

## Required automated tests

- invalid/negative/non-integer quantity;
- client price tampering;
- client total tampering;
- client supplier tampering;
- insufficient stock;
- concurrent stock race;
- concurrent identical idempotency key;
- DentCash failure after stock reservation;
- finalization failure after DentCash spend;
- provider failure;
- provider success followed by DB failure;
- retry after timeout;
- cancellation/refund replay;
- supplier split integrity;
- cross-clinic order access.

## Release gate

Do not mark Shop checkout production-ready until the state machine and compensation paths are implemented and the above failure classes have executable regression coverage.