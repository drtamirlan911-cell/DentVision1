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

## 2026-09-12 — Production deployment trigger

### Action
- Current `main` contains the Google Sign-In UI integration and the latest execution-state updates.
- Vercel Production had previously been observed behind `main`; this commit intentionally updates the persistent execution log to trigger the repository's Git-connected Production deployment from the current `main` state.
- `VITE_GOOGLE_CLIENT_ID` is expected to remain configured in Vercel and must not be committed to the repository.

### Next verification
1. Confirm the new Vercel Production deployment is READY and corresponds to this commit.
2. Confirm the production login UI renders Google Sign-In.
3. Verify the production Google OAuth flow and inspect runtime errors.
4. If production is healthy, continue with wiring the canonical Economics Engine into real diagnostics, medical-analysis and dental-lab settlement flows.
