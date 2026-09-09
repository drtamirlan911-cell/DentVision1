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
6. `docs/security/SHOP_CHECKOUT_FAILURE_MATRIX.md`

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
- Dispute administration is now explicitly SUPERADMIN-only; clinic-level `finance.manage` cannot list or resolve marketplace disputes.
- Dedicated security release-blocker register added and refreshed with hardened-vs-open status.
- Platform-finance E2E fixtures now include a dedicated `SUPERADMIN`; platform revenue, payout administration and platform-expense tests no longer require insecure clinic-owner access.
- Idempotency reservation now uses a PostgreSQL transaction-scoped advisory lock per key, eliminating expected concurrent `P2002`/unique-constraint error noise while retaining the database unique index as the integrity boundary.
- Shop checkout failure/compensation matrix added as a durable release-control artifact, documenting required state transitions, money/inventory invariants and regression cases.
- Dispute transition rules extracted into a testable guard and regression tests added for valid forward transitions, backward transitions, terminal-state immutability and unknown states.
- Security blocker register expanded with strict checkout quantity validation and explicit files/storage verification requirements.
- Patient-ID audit sweep identified additional internal AI/event and context-manager paths that must prove tenant scope before resolving arbitrary client-derived patient IDs; these remain verification targets rather than being declared safe from static search alone.
- Files route review confirms clinic scoping is present on document/patient reads and uploads; MIME/content validation and delete-path isolation remain release verification targets.
- AI ContextManager patient loading now requires authenticated clinic access and resolves patient, visits, treatment plans and images through clinic-scoped predicates before clinical context is assembled.
- Finance sale recording now uses a database compare-and-set balance guard on the GATEWAY wallet, preventing concurrent sale processing from overdrawing the gateway balance; its transaction-client unit tests now model the guarded `updateMany` correctly.
- DentCash refund authorization now validates ownership of both spend and earn ledger rows before any refund mutation; unauthorized callers cannot reach the spend-refund operation before the ownership check.
- Shop checkout validation helpers and regression tests were added for strict positive-integer quantities, non-negative minor-unit DentCash values and malformed checkout items. The main checkout route still requires integration of these helpers before the P0 quantity requirement can be marked closed.
- AI patient escalation lookup now enforces `patientId + clinicId` together before patient identity/contact data is used for staff notification; global patient-ID resolution was removed from this path.
- AI patient escalation now hard-fails before conversation creation/broadcast when the patient is missing from the target clinic, with regression coverage for cross-clinic rejection and same-clinic success.
- Shop checkout now has a side-effect-free state-machine contract (`checkout.state.ts`) and regression tests for normal payment, retry, failure mapping, terminal immutability and invalid transitions. The contract is intentionally not treated as route integration.
- Storage now rejects unsafe S3 object keys before upload, deletion or signed-read generation; clinic-prefixed namespace, traversal, absolute-path and control-character checks are enforced in the storage boundary, with regression tests.
- Patient portal linking now uses an atomic unclaimed-card compare-and-set, supports normalized Kazakh phone matching, prefers an explicit booking phone hint, and never adopts a card already owned by another user.
- AI patient/appointment access resolvers now fail closed when either identifier or clinic context is absent; their tests isolate mock state between cases so tenant-boundary assertions cannot inherit prior calls.

## Verification state

Older verified runs remain valid only for the commits they tested. The latest pre-fix CI cycle failed in unit tests: 166/169 test files passed, with 7 failures caused by test doubles not yet reflecting the newly hardened finance `wallet.updateMany` and atomic patient-link `updateMany`, plus one test leaking mock calls between cases. Those test-suite mismatches have now been corrected. A fresh PR-triggered verification cycle is running for the current branch head: CI `34347014412` is in progress, Quality Gate `34347014482` is in progress, and DentVision Quality Gate `34347014694` is pending. Do not count the current cycle as green until all required jobs finish successfully. Release remains **NOT READY**.

## Known release blockers / work queue

1. Verify active CI runs `34347014412`, `34347014482`, and `34347014694` to completion; do not rely on older snapshots.
2. Review and remediate npm audit findings, including high-severity issues, without blind major-version upgrades.
3. P0 finance platform authorization: hardened; complete route-by-route verification and retain negative clinic-role tests.
4. P0 finance typed owner isolation: hardened; add collision regression tests and complete route audit.
5. P0 shop checkout compensation: OPEN. Integrate strict quantity validation, then wire `checkout.state.ts` through the route/service and implement stock/DentCash compensation plus provider reconciliation.
6. Complete shop supplier/order integrity tests for supplier ownership, price/quantity tampering, retries, refunds and cross-clinic access.
7. Dispute state-machine regression coverage added; next add HTTP authorization and concurrent terminal/non-terminal integration coverage.
8. Complete authentication, RBAC, tenant isolation and IDOR audit across every API domain; prioritize finance, shop, IAM, files and patient-facing routes.
9. Harden the remaining internal AI/event patient-resolution paths with explicit clinic/authorization context before accepting client-derived patient IDs.
10. Map and harden Patient 360 and core clinical workflows.
11. Verify AI authorization, confirmation, auditability and clinical safety boundaries, including expiry and replay behavior.
12. Implement/verify document orchestration and in-app electronic signing for patient and clinician workflows.
13. Verify Web/Android domain, API, permission and offline-sync parity.
14. Reconcile the documented legacy/new schema discrepancy before further domain expansion.
15. Refine Home/sidebar/service-card UX against the Master Constitution.
16. Re-run all executable release gates after security fixes.
17. Only after all blocking gates pass: prepare merge/release to `main`.

## Operating rule

After every material change, verify it, record the result here, and continue with the next highest-risk blocker. Do not declare production readiness from static inspection alone.
