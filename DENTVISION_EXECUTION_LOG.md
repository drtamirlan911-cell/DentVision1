# DentVision — Persistent Execution Log

This log is the durable handoff between work sessions/agents. It records completed work, evidence, blockers, and the exact next action.

## 2026-09-11 — Control plane initialized and baseline reconciled

**Plan:** `DENTVISION_EXECUTION_PLAN.md`

**Status:** Phase 0 remains in progress. Material progress is committed to `main` and recorded here.

### Completed
- Persistent execution plan and execution log established.
- Repository architecture contract reconciled: database/event state is authoritative, AI context is not durable state, actions must be permissioned/auditable/idempotent, and web/Android share product contracts.
- Canonical economics policy confirmed at `docs/business/DENTVISION_PARTNER_ECONOMICS.md`.

## 2026-09-11 — Phase 0 migration blockers and fixes

### Fixed blockers
- `20260808_add_performance_indexes`: missing `invoices` on fresh DB. Fixed with guarded/deferred index creation.
- `20260808_add_settlement`: missing `referrals`. Fixed by guarding table-dependent operations.
- `20260809_add_completed_lessons`: missing `school_enrollments`. Fixed with guarded original migration plus post-init compatibility migration.
- `20260809_add_notification_preferences`: missing `users` for FK. Fixed in `d6aa6e64123de5171dacd1e8c6d2ff82a77f2e51` with guarded FK plus post-init finalizer.

### Fifth blocker: Google sign-in
- CI `34638148706` on `d6aa6e64123de5171dacd1e8c6d2ff82a77f2e51` passed lint/typecheck/build-related jobs, while E2E failed at `20260810_google_sign_in` with PostgreSQL `42P01: relation "users" does not exist`.
- Root cause: the original migration executed `ALTER TABLE users` before legacy `init_full_schema` creates `users`. A post-init migration alone cannot fix a migration that fails before reaching it.
- Fixed on `main`: `29d66a41a09b2cafe53f862eca80d1984cb4caba` guards `20260810_google_sign_in`; `8f17f3a86849315b3e173b4eec55d761bcefd33d` adds `20260912_finalize_google_sign_in` to apply the fields/index after the base schema exists.

### Verification
- Quality Gate `34638148700` passed its release-gate checks.
- Phase 0 remains **NOT PASSED** until a fresh CI E2E run confirms the complete migration chain.

## 2026-09-11 — Partner Economics Engine foundation

### Implemented
- `28fdae6dd1f3b66be60b9c331a8ba4e38aef1371` — `partner-economics.service.ts` with canonical diagnostics/3D, medical-analysis and dental-lab rules, floors/caps/tiers, operating-cost and contribution-margin calculation, explicit status, durable idempotent operation ledger, and rule-version snapshots.
- `380828ec11939c4fe1b157bd4cdad0d584fe738c` — calculator tests for floors, caps, dental-lab tiers, loss detection and rule snapshots.
- `29eda06dad3e6f4dadc807b68a4f37eda088fb84` — Prisma JSON typing fix.

### Next action
1. Validate the Google sign-in migration fix through CI/E2E.
2. If green, harden economics rule initialization against concurrent creation.
3. Wire economics into real diagnostics payment/mark-paid, medical-analysis and dental-lab settlement flows.
4. Add partner-visible economics breakdown and Finance Hub aggregation.
