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

### Canonical economics document
- Located and confirmed: `docs/business/DENTVISION_PARTNER_ECONOMICS.md`.
- Commit `9a1139a8df0e915b9c1ba5064f6f5cec0892da3b` establishes it as **CANONICAL BUSINESS POLICY v1.0**.
- Policy covers diagnostics/3D centers, medical analysis laboratories, dental laboratories, Marketplace, Academy and Finance Hub unit economics. No competing economics specification is permitted.

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
- Fix committed: `ff3b1adeafe8ad66b1af11ff8c01ef10b14f42b6`.

### Third blocker: completed-lessons migration
- CI run `34631170839` for the settlement fix passed backend/frontend lint, build/typecheck and command-center audit, but E2E migration setup then failed at `20260809_add_completed_lessons`.
- Exact PostgreSQL error: `42P01: relation "school_enrollments" does not exist`.
- Root cause is the same migration-ordering pattern: `init_full_schema` creates `school_enrollments` later, so the early `ALTER TABLE` cannot assume it exists.
- Fixes committed: `ee413a7e3e9206aa3c2274b0155a856c337b127c` makes the original migration safe when the table is absent; `938b0a8f399810265b8ad45cb5abff8892e3b8be` adds the post-init compatibility migration that applies `completedLessons` after the legacy base schema exists.

### Current verification
- Phase 0 is **not yet passed**. A fresh CI run is already queued for `938b0a8f399810265b8ad45cb5abff8892e3b8be` (`CI` run `34631390749`, with Quality Gate `34631390830`).
- Do not declare the technical gate green until migrations, unit tests and E2E complete successfully.

## Economics architecture mapping already confirmed
- The backend already has a generic `CommissionRule` model and `resolveCommissionBps()` for Marketplace/Education flows.
- The diagnostics domain already has `Referral.platformFee` plus a DB-backed `Settlement` and an idempotent settlement service. This is reusable infrastructure, not a reason to create a duplicate settlement system.
- The canonical policy requires minimums, caps, volume tiers, transparent breakdowns and versioned pricing with no retroactive repricing. The new economics engine must therefore extend the existing finance/settlement infrastructure rather than hard-code percentages in UI or create a second commission source of truth.

### Next action
1. Verify CI/Quality Gate run `34631390749` / `34631390830` until complete; fix the next migration blocker if any.
2. Implement the first Partner Economics Engine vertical slice against the canonical policy: versioned rule storage + calculator + durable operation ledger + idempotency + transparent breakdown + contribution-margin status for diagnostics/3D, medical analyses and dental labs.
3. Reuse existing `CommissionRule`, `Referral`, `Settlement`, `Wallet`, `Transaction`, `Payment` and `Payout` infrastructure where semantics already match; do not duplicate ledgers or payout systems.
4. Add calculation/edge/concurrency tests, then wire Finance Hub / partner visibility after backend economics is stable.
