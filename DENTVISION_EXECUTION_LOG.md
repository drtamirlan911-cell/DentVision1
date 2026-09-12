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
- GitHub combined status for `b3e5f1c6043b4e46a0d3a0c049fbbced6ac9e7` reports Vercel `failure` with target indicating a Vercel build-rate-limit/plan limit (`upgradeToPro=build-rate-limit`).
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
- `6897620c3fc09ef1b4d767eaeca096f2f3facc9f132` adds a focused live-settlement economics contract test proving center referrals use 7% diagnostics economics and lab referrals use 6% medical-analysis economics.
- Existing settlement linking remains guarded by `Referral.settlementId`, so repeated settlement generation cannot double-link the same referral.

## 2026-09-12 — Fresh CI blocker fixes: settlement precision + raw AI Employee E2E schema

### Evidence
- Fresh CI run `34669278245` exposed a TypeScript failure in `settlement.service.ts`: a numeric commission amount was being assigned to Prisma `Decimal`-typed `Referral.platformFee`. The settlement path now uses `Prisma.Decimal` end-to-end and converts commission minor units exactly, without floating-point rounding.
- The same CI run exposed an E2E-only schema gap: the E2E database is initialized with `prisma db push`, so SQL-only AI Employee migrations are not executed. The failing scenario attempted to write `ai_employee_tasks` and received PostgreSQL `42P01`.
- `0af98391cb3ab6455ddfecf90b66b5fff3fa0fb7` updates the clinical tenant-isolation fixture to use the canonical `DiagnosticCategory.OPG` enum instead of the removed `DIGITAL_XRAY` value.
- `cec0f7abaddaf4b38c34fc246401d1178d95e45d` restores `settlement.service.ts` with exact `Prisma.Decimal` handling after replacing the file atomically.
- `aeffa5bac4e8473a701fcf61a531dfd3a688381c` makes the deterministic E2E seed execute the two authoritative AI Employee SQL migrations before seeding fixtures, so the E2E environment exercises the same raw schema as production.

## 2026-09-12 — Phase 0 closed; economics execution advanced

### Verification evidence
- Baseline commit `59747e48777eb016b0d7e42cc7dbe1b3b2a9c067` is on `main` and is deployed live on Render as deployment `dep-daihb50u01pc738avlq0`.
- Fresh CI run `34684882069` passed all jobs: frontend lint, backend lint, build/typecheck/test, command-center audit and the full Playwright E2E suite.
- The E2E job successfully synchronized the isolated Prisma schema, bootstrapped the SQL-only AI Employee migrations, started the backend, waited for readiness and completed the suite successfully.
- Quality Gate `34684882055` passed its release-gate checks.
- `patients.routes.ts` is present on `main` and retains tenant-scoped access, RBAC, IIN protection, idempotency, event publication and audit behavior.
- The canonical partner economics policy remains the sole business-rule source; no competing economics policy was introduced.

### Phase status
- **Phase 0 — COMPLETE.**
- **Phase 1 — IN PROGRESS.**

## 2026-09-12 — Dental laboratory economics wired to the production workflow

### Implemented
- Added `dentvision-backend/src/modules/finance/dental-lab-economics.service.ts` as the single adapter from `LabOrder` to the canonical `DENTAL_LAB` economics vertical.
- A dental-lab case becomes an economic operation only at `delivered`, avoiding premature GMV/revenue recognition while a case can still be remade, adjusted, delayed or cancelled.
- The adapter resolves the actual `laboratoryId` from the existing tenant-safe `LabOrder.files.meta` assignment and uses the stored `LabOrder.price` as gross GMV.
- Wired `labOrder.status_changed` → `delivered` to the adapter. The downstream `recordPartnerEconomics()` operation-id guard makes repeated events/callbacks idempotent and stores the immutable economics rule/version snapshot.
- Added focused tests for delivered-only recognition, missing laboratory assignment, zero-value orders, and canonical `DENTAL_LAB` routing.

## 2026-09-12 — Partner economics exposed through Platform BI / Finance Hub data contract

### Implemented
- `a0e471ffa77a3d7ad009301a5bbc9512b91edfb2` extends the already-mounted `/api/bi` router with `GET /api/bi/partner-economics`.
- The endpoint is restricted to `bi.platform`, uses the immutable `partner_economics` transaction ledger, and never recalculates historical transactions using current rules.
- Supports `from`, `to` and `vertical` filters.
- Returns total operations, GMV, platform commission, contribution margin, effective take-rate and margin, plus per-vertical `HEALTHY / LOW_MARGIN / LOSS` status and loss/low-margin counts.
- Returns the current canonical rules as a read-only reference for the Finance Hub; historical transaction metadata retains its own rule/version snapshot.
- A temporary standalone duplicate router was removed before merge so there is only one mounted economics read surface.

## 2026-09-12 — Medical-analysis referral economics coverage expanded

### Implemented
- `8ea72a6e90d41465ea01bce9f31e650ca5eec38a` extends `referral-economics.reconciliation.test.ts` beyond diagnostics-only coverage.
- Added explicit laboratory referral routing coverage: a referral with `labId` is reconciled through `MEDICAL_ANALYSIS` and a 6% canonical rule, producing ₸600 on a ₸10,000 gross referral in the test fixture.
- Added a zero/invalid billable-cost guard regression so no economics rule lookup or fee mutation occurs when the referral has no positive gross value.
- Preserved the lifecycle race guard: the asynchronous reconciliation update is conditional on `ACCEPTED` / `IN_PROGRESS`, so a stale event cannot mutate a referral that has already advanced or been cancelled.

## 2026-09-12 — Verification and concurrency hardening

### Verified
- CI `34687718217` for commit `90898259163da48b8c31b368bd116fd6a7fcf359` completed successfully: backend lint, frontend lint, build/typecheck/test, command-center audit and full Playwright E2E all passed.
- Quality Gate `34687718230` completed successfully with the release-gate script passing.
- Vercel status for the same commit is `success`.

### Implemented
- `08f0295a1dabec8d03ef53937577787f9db3f580` adds a concurrency regression to `referral-economics.reconciliation.test.ts`.
- Two simultaneous canonical referral reconciliations now model the real conditional-update race: exactly one lifecycle winner receives the canonical fee and the losing stale event receives `null`.
- The regression asserts both calls remain guarded by `status IN (ACCEPTED, IN_PROGRESS)` and therefore cannot overwrite a referral after its lifecycle has advanced.

## 2026-09-12 — CI regression repair and continued ledger hardening

### Implemented
- `0eaa498e1d4ee3c9a8d68fda137e33a018c903b9` removed the referral economics fallback behavior so legacy referral-time fees cannot become the authoritative settlement source.
- Fresh CI for that commit found two test-state/race-model defects rather than TypeScript, build, backend-lint or E2E failures: 172 test files passed and only two economics tests failed.
- `054042404d1f516f64c91a59161243376cf529b9` resets the mocked canonical diagnostic rule/calculator state between referral reconciliation cases, preventing the medical-analysis 6% test from leaking into the later concurrency test.
- `1c665c6b10260c136d818c75126a06789d845b8c` corrects the settlement payment concurrency fixture so both requests first observe no reservation, the unique insert race is what selects the winner, and the loser re-reads the durable payment. This directly models the production idempotency boundary rather than weakening the assertion.

### Verification
- The failed run `34696332372` was analyzed to the exact two failing tests; all other CI jobs were successful, including frontend lint, backend lint, build/typecheck, command-center audit and full Playwright E2E.
- New commits `0540424...` and `1c665c6...` are now on `main` and trigger fresh CI verification.

### Next implementation slice
1. Confirm fresh CI is green after the two regression fixes.
2. Complete the Partner/Finance UI integration against `/api/bi/partner-economics` without weakening `bi.platform` authorization.
3. Add/verify end-to-end accepted → paid → settled rule-version immutability and settlement ledger idempotency.
4. Identify and wire the real medical-analysis payment/settlement lifecycle using the existing `Referral + Laboratory + LaboratoryTest + Payment` domain; do not create a duplicate order model.
5. Keep dental-lab economics at the existing `delivered` recognition boundary until a real paid/settled callback exists.
