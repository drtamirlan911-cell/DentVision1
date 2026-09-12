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

Dental-lab economics therefore remains recognized at `delivered` until a real payment callback/reconciliation path is identified and wired.
