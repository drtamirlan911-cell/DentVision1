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
- `af7743b655da4e406432d7aabd25f1cc19212675` — serialized economics rule initialization to prevent duplicate rule creation under concurrent workers.

## 2026-09-12 — Google Sign-In connected to the actual login UI

### Implemented
- Backend already had a complete ID-token verification path in `dentvision-backend/src/modules/auth/googleAuth.ts`, including audience/issuer/signature validation through `google-auth-library`, verified-email enforcement, Google account creation/linking, normal session/JWT issuance, audit events, and shared permission hydration.
- Frontend already had Google Identity Services loading/rendering and `loginWithGoogle` API/store support, but the production login modal was not actually rendering the Google button.
- `6090077918b77d85c0b5c5784c0f8953f6761c8d` connected `GoogleSignInButton` to `LoginModal` for both sign-in and registration.
- `fba72f2930aacfaab2d3d373f0f7f93959c18f87` corrected the modal to use the hook API without illegal direct store access.
- Google remains safely feature-gated by `VITE_GOOGLE_CLIENT_ID`; when the client id is absent, the button does not render. Backend similarly returns a controlled 503 when `GOOGLE_CLIENT_ID` is not configured.

### Current verification state
- Code path is now end-to-end wired in the repository: Google GIS button → ID token → `/api/auth/google` → verified profile → account/linking → normal DentVision session/permissions.
- Production readiness still depends on the actual `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` configuration and authorized Google origin(s), followed by CI/build and a real browser login test.
- Phase 0 remains **NOT PASSED** until the current CI run confirms the migration chain and the frontend integration builds cleanly.

## 2026-09-12 — Production deployment trigger and Vercel rate-limit blocker

### Evidence
- `main` is at/after `b3e5f1c6043b4e46a0d3a0c049fbbced6acbc9e7`.
- GitHub combined status for `b3e5f1c6043b4e46a0d3a0c049fbbced6acbc9e7` reports Vercel `failure` with target indicating a Vercel build-rate-limit/plan limit (`upgradeToPro=build-rate-limit`).
- Vercel Production for project `dent-vision1` is now receiving subsequent `main` deployments; latest observed deployment includes `e68f35d137925079b17a2f6dad70f2c02c5e2c19` and is READY.
- The deployed build completed without compile errors; only a chunk-size warning was emitted.
- Vercel runtime error aggregation for the project over the last 7 days reports no runtime errors.

## 2026-09-12 — Canonical economics connected to live diagnostic settlement

### Implemented
- `e68f35d137925079b17a2f6dad70f2c02c5e2c19` updates `dentvision-backend/src/modules/diagnostics/settlement.service.ts` so settlement-time commission is resolved from the canonical Partner Economics Engine instead of trusting stale `Referral.platformFee` values.
- Diagnostic-center referrals route to `DIAGNOSTIC_3D`; laboratory referrals route to `MEDICAL_ANALYSIS`.
- Settlement gross value comes from the referral `cost`; the engine applies the canonical percentage/floor/cap and the resulting commission is used for the settlement amount.
- Each settled referral records an idempotent `partner_economics` transaction snapshot with the exact economics rule/version, commission, partner revenue, contribution margin and status.
- `9a6d5d4020a36253f2f3facc9f132fcd9bbf3648` adds focused tests for referral owner and vertical routing while preserving existing settlement arithmetic tests.
- `6897620c3fc09ef1b4d767eaeca096cc2c0cea5d` adds a focused live-settlement economics contract test proving center referrals use 7% diagnostics economics and lab referrals use 6% medical-analysis economics.
- Existing settlement linking remains guarded by `Referral.settlementId`, so repeated settlement generation cannot double-link the same referral.

### Remaining implementation work
1. Replace the legacy 10% `platformFee` calculation during referral `ACCEPTED`/`IN_PROGRESS` with the same canonical Economics Engine, so the live referral record itself is authoritative before settlement.
2. Add/verify integration tests around accepted → paid → settled lifecycle, including concurrency and exact rule-version snapshots.
3. Wire the canonical engine into medical-analysis and dental-lab operational order flows (not only the diagnostics settlement adapter).
4. Expose economics snapshots and margin status in Partner Dashboard and Finance Hub.
5. Resolve any remaining Vercel build-rate-limit capacity issue and run the fresh CI/E2E release gate.
