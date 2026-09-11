# DentVision — Persistent Execution Log

This log is the durable handoff between work sessions/agents. It records completed work, evidence, blockers, and the exact next action.

## 2026-09-11 — Control plane initialized and baseline reconciled

**Plan:** `DENTVISION_EXECUTION_PLAN.md`

**Status:** Phase 0 remains in progress, aligned with the repository's existing `CURRENT_STATE.md` / `.dentvision/current-state.json`. No competing roadmap was introduced.

### Completed
- Added the persistent master execution plan to `main`.
- Added this persistent execution log to `main`.
- Established that material progress must be committed to GitHub and recorded here rather than retained only in chat.
- Read and reconciled `ARCHITECTURE.md`, `CURRENT_STATE.md`, and `.dentvision/current-state.json`.
- Confirmed the repository architecture contract: database/event state is authoritative, AI context is not durable state, actions must be permissioned/auditable/idempotent, and web/Android must share product contracts.

### Evidence
- Initial plan commit: `77a9628265e1372e8b9a41feab9b5c35ecf2cd66`
- Plan alignment commit: `65fcdf61f5c17d3889e44852eeed2d133e525da6`
- Repository control state currently reports: **Phase 0 — CI stabilization**, release status **NOT_RELEASED**.

### Important sequencing decision
The repository's existing Phase 0 technical gate is authoritative. We will not bypass it by merging financial-domain changes blindly. Economics work is the first business priority immediately after the technical gate, while code mapping and source discovery can proceed in parallel.

### Canonical economics document discovery
- Exact-path lookup on `main` and repository commit history did not resolve `DENTVISION_PARTNER_ECONOMICS.md`.
- This is treated as a **location/discovery task**, not as evidence that the document does not exist. No competing economics specification was created.

## 2026-09-11 — Phase 0 migration blockers

### First blocker: performance indexes
- CI run `34630189371` for commit `65c66ffa039bdb53563d0e6960199584db4c7362` failed only in E2E migration setup; lint/typecheck/build/unit tests/backend lint/frontend lint all passed.
- Prisma `P3018`: `ERROR: relation "invoices" does not exist` in `20260808_add_performance_indexes`.
- Root cause: legacy `init_full_schema` is lexically ordered after the dated migrations, while the performance-index migration assumed base tables already existed.
- Fixes committed: `e232a1628a059c8cb3c05765c7e104cb3fe0c5d1` and `e4e4f33560d74e28cd77659da734fd6f9f811c43`.

### Second blocker: settlement migration
- CI run `34630922860` for `e4e4f33560d74e28cd77659da734fd6f9f811c43` passed frontend lint, backend lint, typecheck/build, command-center audit and unit tests, but E2E migration setup failed.
- Exact Prisma failure: migration `20260808_add_settlement`, PostgreSQL `42P01`, `ERROR: relation "referrals" does not exist`.
- Root cause: the migration guarded the `ALTER TABLE` and foreign-key creation for an optional referrals table, but unconditionally executed `CREATE INDEX ... ON referrals`, so a fresh database without that table still failed.
- The failure was confirmed from the CI job log and the migration source.

### Fix committed to `main`
- `ff3b1adeafe8ad66b1af11ff8c01ef10b14f42b6` — made `20260808_add_settlement` fully safe when the referrals table is absent; the column, index and FK are now created only inside the table-existence branch for either `referrals` or `Referral`.

### Current verification
- Phase 0 is **not yet passed**. The settlement migration fix must be verified by a fresh CI run before declaring the technical gate green.

### Next action
1. Verify the CI/Quality Gate runs triggered by `ff3b1adeafe8ad66b1af11ff8c01ef10b14f42b6`.
2. If migrations pass, let the full E2E suite run and record the final evidence.
3. Continue locating the existing canonical economics document and map current order/payment/partner/finance/payout code in parallel; do not create duplicate economics rules.
4. Once the technical gate is green and economics source-of-truth is located, implement the first Partner Economics Engine vertical slice with durable ledger/versioning rather than frontend-only calculations.
