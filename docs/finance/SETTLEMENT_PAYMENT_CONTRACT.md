# Settlement Payment Contract

## Canonical lifecycle

`accepted/in_progress` → referral economics reconciliation → `paid` → settlement generation → `invoiced` → payment callback → `paid`.

The durable `partner_economics` transaction is created from the canonical Partner Economics Engine when a referral is linked to a settlement. Historical transactions retain their rule/version snapshot.

## Payment callback idempotency

`markSettlementPaid(settlementId, paymentId)` performs a conditional update:

- target settlement must not already be `paid`;
- exactly one successful conditional update is considered the callback winner;
- a redelivered/concurrent callback receives `false` and cannot apply a second state transition.

Regression coverage: `dentvision-backend/src/modules/diagnostics/settlement.payment.test.ts`.

## Important boundary

No payment callback is invented for medical-analysis or dental-lab operations. Those domains must use their existing payment/settlement lifecycle before economics recognition is moved to `paid/settled`.

Dental-lab economics is **not** recognized at `delivered`. Delivery records operational completion only and must not create a `DENTAL_LAB` `partner_economics` transaction or mutate partner/platform wallets or ledger. Recognition remains disabled until an approved invoice/payment/settlement contract supplies verifiable successful settlement evidence with idempotency, partner ownership, exact amount and clinic/branch scope. Refunds and chargebacks must follow the same approved financial contract. Historical rows are read-only until reconciled against external payment evidence; do not auto-delete, reverse or backfill them. D10 remains OPEN.
