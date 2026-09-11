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
- Phase 0 is **not yet passed**. CI run `34631390749` was the verification run for the completed-lessons fix; later economics commits triggered newer CI/Quality Gate runs.
- Do not declare the technical gate green until migrations, unit tests and E2E complete successfully.

## 2026-09-11 — Partner Economics Engine foundation

### Canonical source mapped
The existing finance stack already contains `CommissionRule`, `Transaction`, `Wallet`, `Payment`, `Payout`; diagnostics already contains `Referral.platformFee` and DB-backed `Settlement`. We are reusing these primitives rather than creating a parallel commission or payout system.

### Implemented
- `28fdae6dd1f3b66be60b9c331a8ba4e38aef1371` — added `partner-economics.service.ts`.
  - Canonical verticals: diagnostics/3D, medical analyses, dental labs.
  - Canonical rates/floors/caps/tiers from policy v1.0.
  - Reuses `CommissionRule` as the rule registry; extra economics metadata is stored in `splitJson`.
  - Calculates platform commission, partner revenue, operating costs and contribution margin.
  - Returns explicit `HEALTHY` / `LOW_MARGIN` / `LOSS` status.
  - Records a durable, idempotent economics operation in existing `Transaction` without touching wallet balances; settlement/payout remain separate.
  - Transaction metadata snapshots the exact economics version and parameters used, preventing retroactive repricing.
- `380828ec11939c4fe1b157bd4cdad0d584fe738c` — added calculator tests covering floors, caps, dental-lab volume tiers, loss detection and rule snapshots.

### Verification in progress
- CI/Quality Gate for `380828ec11939c4fe1b157bd4cdad0d584fe738c` is running (`CI` and `Quality Gate`; Quality Gate run `34631504719` is currently in progress).
- The economics engine is intentionally not yet wired into diagnostic payment collection or partner dashboards until the calculator passes CI and the migration gate is green.

### Next action
1. Finish CI/Quality Gate and fix any concrete failures immediately.
2. Wire diagnostics payment/mark-paid commission calculation to `partner-economics.service.ts`, replacing the old flat 10% path with canonical 7% + floor/cap and recording the operation ledger.
3. Add medical-analysis and dental-lab order settlement hooks using the same engine, preserving existing payment/payout semantics.
4. Add partner-facing transparent breakdowns and Finance Hub aggregation after the backend hooks are stable.
