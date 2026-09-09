# DentVision Project State

**Status:** ACTIVE — operational state for autonomous execution
**Branch:** `autonomous/superapp-foundation-2026-09-09`
**Main:** intentionally untouched during autonomous hardening

## Source of truth

1. `docs/00_CONSTITUTION/08_DENTVISION_MASTER_CONSTITUTION.md`
2. `docs/00_CONSTITUTION/07_AUTONOMOUS_SUPERAPP_EXECUTION.md`
3. this file
4. ADRs and implementation docs
5. `docs/00_CONSTITUTION/11_SECURITY_RELEASE_BLOCKERS.md`

## Completed in this cycle

- Autonomous execution contract established.
- Web + Backend + Android CI quality workflow established.
- Android debug build included in CI.
- Release-gate orchestration established.
- Treatment-plan tenant/security controls preserved.
- Master Product Constitution established as the single product source of truth.
- Durable project state established so decisions and next actions survive beyond chat context.
- Vitest treatment-plan security test fixed for mock-hoisting semantics with `vi.hoisted()`.
- AI approval approve/reject transitions hardened with database-level compare-and-set (`updateMany` with `status: pending`) to prevent concurrent double decisions.
- AI approval expiry is now part of the atomic approval claim, preventing an approval from winning a race after its expiry boundary.
- Legal document status transitions hardened with database-level compare-and-set so concurrent requests cannot both advance the same document.
- Security audit reviewed organization/person platform-wide routes, finance ownership boundaries, patient presentation access, and AI event-action data access; no unverified tenant bypass was promoted to main.
- Commerce dispute creation validates the referenced order/enrollment against the authenticated user or clinic; arbitrary reference IDs are rejected.
- Dispute terminal transitions are compare-and-set, preventing concurrent resolution/rejection from double-triggering a refund.
- Dispute status transitions are now an explicit compare-and-set state machine: `open -> review|resolved|rejected`, `review -> resolved|rejected`; terminal states are immutable.
- CI compile failure in dispute creation fixed: backend `SchoolEnrollment` does not expose `clinicId`, so enrollment disputes now enforce authenticated `userId` ownership only rather than querying a non-existent field.
- Dedicated security release-blocker register added with verified P0/P1 findings for finance platform authorization, shop checkout compensation, and typed owner isolation.
- Platform-finance E2E fixtures now include a dedicated `SUPERADMIN`; platform revenue, payout administration and platform-expense tests no longer require insecure clinic-owner access.
- Idempotency reservation now uses a PostgreSQL transaction-scoped advisory lock per key, eliminating expected concurrent `P2002`/unique-constraint error noise while retaining the database unique index as the integrity boundary.

## Verification state

The latest verified Quality Gate run `34338158426` reached 188/199 E2E passes and failed only because tests still expected clinic-owner access to platform-only finance endpoints after the security hardening. The code contract was intentionally not weakened. Follow-up fixes are committed and Quality Gate run `34339054986` is queued on head `27fe346f59dcf71630354dd407eab7a30a5ada51`. Release remains **NOT READY** until the active gate completes and remaining blockers are cleared.

## Known release blockers / work queue

1. Verify active Quality Gate `34339054986` to completion and fix any failures before proceeding.
2. Review and remediate npm audit findings, including high-severity issues, without blind major-version upgrades.
3. Fix P0 finance platform authorization: platform-only finance mutations/administration must not be reachable through clinic `billing.manage` alone.
4. Fix finance typed owner isolation: authorization and transaction filters must constrain `ownerType + ownerId` rather than treating IDs from different domains as interchangeable.
5. Fix shop checkout compensation: failed DentCash/payment stages must not leave stock permanently decremented or money irreconcilably spent without a recoverable order state.
6. Complete shop supplier/order integrity tests for supplier ownership, price/quantity tampering, retries, refunds and cross-clinic access.
7. Add regression tests for dispute state transitions and concurrent terminal/non-terminal races.
8. Complete authentication, RBAC, tenant isolation and IDOR audit across every API domain; prioritize finance, shop, IAM, files and patient-facing routes.
9. Map and harden Patient 360 and core clinical workflows.
10. Verify AI authorization, confirmation, auditability and clinical safety boundaries, including expiry and replay behavior.
11. Implement/verify document orchestration and in-app electronic signing for patient and clinician workflows.
12. Verify Web/Android domain, API, permission and offline-sync parity.
13. Reconcile the documented legacy/new schema discrepancy before further domain expansion.
14. Refine Home/sidebar/service-card UX against the Master Constitution.
15. Re-run all executable release gates after security fixes.
16. Only after all blocking gates pass: prepare merge/release to `main`.

## Operating rule

After every material change, verify it, record the result here, and continue with the next highest-risk blocker. Do not declare production readiness from static inspection alone.
