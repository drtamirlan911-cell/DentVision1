# DentVision Security Release Blockers

Status: ACTIVE
Branch: `autonomous/superapp-foundation-2026-09-09`
Date: 2026-09-09

This document records verified blockers found during autonomous release-gate work. It is part of the durable project state and must be resolved before production release.

## P0 — Platform finance authorization boundary

`dentvision-backend/src/modules/finance/finance.routes.ts` currently protects several platform-level finance endpoints with `requirePermission('finance.manage')`.

The fallback IAM matrix grants `billing.manage` (the canonical mapping of `finance.manage`) to clinic `OWNER` and `ADMIN` roles. Therefore a clinic-level finance manager can potentially reach operations explicitly documented in the finance router as platform operations.

Affected platform operations include:

- ledger integrity/health;
- commission-rule administration;
- recording arbitrary platform sales;
- manual wallet transactions;
- payout queue/status operations;
- platform transaction visibility.

Required fix:

1. Introduce an explicit platform-finance authorization boundary, preferably a dedicated permission or `requireSuperadmin` for operations that are genuinely platform-only.
2. Keep clinic/supplier self-service wallet reads separate from platform finance administration.
3. Add regression tests proving clinic OWNER/ADMIN cannot mutate or inspect platform finance resources.
4. Re-audit every finance route after the change.

Do not solve this by removing `billing.manage` from clinic OWNER/ADMIN globally; clinic billing remains a legitimate product capability.

## P0 — Shop checkout compensation / money-flow consistency

`dentvision-backend/src/modules/shop/shop.routes.ts` performs stock decrement and order creation atomically, then performs DentCash spending outside that transaction. If DentCash spending fails, the order is cancelled but the already-decremented stock is not restored.

This can permanently consume inventory without a successful purchase.

Required fix:

1. Make checkout a compensating workflow with explicit stock restoration on failed external payment/cash spending, or redesign the order lifecycle so stock is reserved rather than consumed until payment settlement.
2. Make the state machine explicit (`pending` → `awaiting_payment` → `paid`/`cancelled` etc.).
3. Ensure every external-money operation is idempotent and has a recoverable failure path.
4. Add regression tests for DentCash failure, payment-provider failure, retry, and cancellation.

## P1 — Shop supplier/tenant ownership

Shop checkout correctly resolves the clinic through JWT/membership checks and derives line price/supplier from the server-side product record rather than trusting the client-supplied total. This is good and must remain invariant.

However, product lookup is by product ID alone and the downstream financial split is based on the product's stored supplier. The supplier/product/order relationship needs a dedicated authorization and integrity test suite covering:

- inactive/unverified supplier products;
- product reassignment between suppliers;
- cross-clinic orders;
- supplier ownership of payouts;
- price/quantity tampering;
- replayed checkout;
- refund/cancellation after supplier settlement.

## P1 — Finance owner-type collision

The finance wallet authorization currently accepts `organizationId` as an owner ID without constraining the owner type in the same expression. Transaction filtering also collects clinic, supplier, and organization IDs into one ID list.

If identifiers from different owner domains can collide, this can cross an ownership boundary.

Required fix:

- use typed owner predicates (`ownerType + ownerId`) everywhere;
- define the canonical owner type for organization wallets in the Prisma schema;
- add collision regression tests.

## Release rule

These blockers are not documentation-only findings. They are release-gate work items. Production release remains blocked until P0 items are fixed and tested, P1 items are either fixed or explicitly risk-accepted by the product/security owner, and the complete Web + Backend + Android quality gate passes on the resulting commit.
