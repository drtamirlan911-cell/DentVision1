# DentVision Current State

This file is the human-readable control point for future development sessions. The generated machine-readable counterpart is `.dentvision/current-state.json`.

## Current phase

**Phase 1 — Economics Engine / Ledger vertical slice**

Phase 0 — CI stabilization is complete. The roadmap may advance because the required fresh CI, E2E, runtime and source-of-truth evidence is present.

## Verified baseline

- Main branch baseline: `59747e48777eb016b0d7e42cc7dbe1b3b2a9c067`.
- Fresh CI run `34684882069`: lint/test, frontend lint, backend lint and E2E all passed.
- Fresh E2E completed against an isolated database with the AI Employee SQL schema bootstrap and Playwright suite passing.
- Quality Gate `34684882055` passed the release-gate checks.
- `dentvision-backend/src/modules/patients/patients.routes.ts` is present and contains the restored tenant-scoped patient workflow with RBAC, IIN protection, idempotency and audit behavior.
- Render backend service `dentvision-api` deployed commit `59747e48777eb016b0d7e42cc7dbe1b3b2a9c067` successfully and is live at the configured production service URL.
- Canonical economics policy remains `docs/business/DENTVISION_PARTNER_ECONOMICS.md`; no competing economics source was introduced.

## Roadmap

1. Economics Engine / Ledger — in progress
2. Partner transparency / Partner Dashboard
3. Automated operations and reconciliation
4. Product-wide UX/navigation
5. Core clinical workflows
6. Ecosystem modules
7. Release hardening

## Immediate implementation slice

- Replace legacy referral-time 10% platform fee writes with the canonical Economics Engine.
- Complete accepted → paid → settled integration/concurrency coverage and immutable rule-version snapshots.
- Wire canonical economics into medical-analysis and dental-lab operational order flows.
- Expose economics snapshots, deductions, payout and contribution-margin status in Partner Dashboard / Finance Hub.
- Persist and reconcile economics events without introducing a competing financial source of truth.

## Protected state

- PR #247 remains a work-in-progress until the final release gates pass.
- PR #242 is obsolete/closed.
- Do not invent routes, permissions, data models or business rules to make tests pass.
- Preserve existing behavior when restoring/reconstructing files; compare against Git history first.

## Working rule

After each implementation slice: make the change, run the relevant checks, record evidence, then proceed. If a check fails, fix it before advancing. Prefer implementation over repeated audits.

## Index

Run `npm run project:index` after structural changes to routes, APIs, roles, workspaces, tests or Android screens.
