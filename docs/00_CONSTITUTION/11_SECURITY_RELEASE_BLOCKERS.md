# DentVision Security Release Blockers

Status: ACTIVE
Branch: `autonomous/superapp-foundation-2026-09-09`
Date: 2026-09-09

This document records verified blockers found during autonomous release-gate work. It is part of the durable project state and must be resolved before production release.

## P0 — Platform finance authorization boundary — HARDENED, VERIFICATION REQUIRED

The platform-only finance routes were changed from the generic clinic-capable `finance.manage` permission to an explicit `requireSuperadmin` boundary. Dedicated E2E coverage was also added for SUPERADMIN access and negative clinic-owner access.

The remaining release requirement is verification on the resulting commit and a complete route-by-route re-audit. Clinic billing must continue to use its legitimate clinic-level permissions.

## P0 — Shop checkout compensation / money-flow consistency — OPEN

`dentvision-backend/src/modules/shop/shop.routes.ts` performs stock decrement and order creation atomically, then performs DentCash spending outside that transaction. If DentCash spending fails, the order is cancelled but the already-decremented stock is not restored.

The same checkout path creates an external Kaspi payment while inside a database transaction. A provider-side success followed by a database failure can therefore create an orphaned external payment unless the provider supports an idempotent cancellation/reconciliation operation.

Required fix:

1. Redesign checkout as a recoverable state machine with explicit stock reservation/compensation.
2. Restore stock on every failed post-reservation path, exactly once.
3. Refund DentCash on every failed post-spend path, exactly once.
4. Do not hold a database transaction open across external payment-provider calls.
5. Persist provider references before/after the external call in a retry-safe state machine.
6. Add regression tests for DentCash failure, provider failure, DB failure after provider success, retry, cancellation, and concurrent checkout.
7. Strictly validate every requested quantity as a finite positive integer before any stock mutation; never coerce malformed quantities such as `NaN`, fractional values, or negative values into checkout quantities.

## P0 — Dispute administration authorization and state integrity — HARDENED, VERIFICATION REQUIRED

Dispute listing and administrative status transitions were changed to `requireSuperadmin`. Creation remains ownership-bound to the authenticated user/clinic. Terminal transitions use compare-and-set semantics so stale/concurrent transitions cannot advance the same dispute twice.

Required verification:

- clinic OWNER/ADMIN cannot list disputes;
- clinic OWNER/ADMIN cannot transition dispute status;
- only valid transitions are accepted;
- terminal states are immutable;
- concurrent transition attempts result in one successful transition and one conflict;
- refund is triggered only after a successful `resolved` transition.

## P1 — Shop supplier/tenant ownership — OPEN

Shop checkout derives line price and supplier from the server-side product record rather than trusting the client-supplied total. This invariant must remain.

A dedicated integrity suite is still required for:

- inactive/unverified supplier products;
- product reassignment between suppliers;
- cross-clinic orders;
- supplier ownership of payouts;
- price/quantity tampering;
- replayed checkout;
- refund/cancellation after supplier settlement.

Additional verified concern: product reads and offer aggregation are public catalogue operations, so only explicitly public catalogue fields should be exposed; supplier status and identity must not become an authorization signal for checkout without a server-side policy check.

## P1 — Finance owner-type collision — HARDENED, VERIFICATION REQUIRED

Finance wallet authorization was tightened to constrain clinic and supplier ownership using typed owner predicates. The organization branch that relied on an unsupported Prisma owner type was removed rather than retaining an unsafe fallback. Transaction filtering was also moved away from a bare mixed owner-ID list.

Required verification:

- collision regression tests for same-looking IDs across owner domains;
- complete audit of every finance read/write route;
- confirmation that legitimate clinic and supplier wallet operations still work.

## P1 — Files / clinical attachment boundary — HARDENED, VERIFICATION REQUIRED

The files module now requires authentication and patient permissions, applies clinic scoping to patient/document reads, rejects guest access, stores uploads under clinic-prefixed object keys, and returns short-lived signed URLs for stored objects. Uploads are limited to 60 MB and restricted by extension.

Remaining verification requirement: confirm MIME/content validation, object-key traversal resistance, signed URL lifetime, delete-path tenant isolation, and that the production storage bucket does not allow public object reads.

## Release rule

These blockers are not documentation-only findings. Production release remains blocked until every P0 item is fixed and tested, P1 items are fixed or explicitly risk-accepted by the product/security owner, and the complete Web + Backend + Android quality gate passes on the resulting commit.
