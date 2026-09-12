# DentVision — Master Execution Plan

## Purpose
This document is the persistent execution contract for DentVision. It is the source of truth for what is being implemented, in what order, and what is considered complete. Progress must not live only in a chat session.

## Operating rules
1. `main` is the product source of truth unless a dedicated implementation branch is explicitly required.
2. Existing canonical product/economics documents are authoritative; do not create competing rules.
3. Every completed material change must be committed to GitHub and recorded in `DENTVISION_EXECUTION_LOG.md`.
4. Every unfinished item has an explicit status and next action.
5. Prefer implementation over repeated audits. Audit only to unblock, verify, or prevent regressions.
6. Do not duplicate UI, business rules, calculations, permissions, or data models when an existing implementation can be extended.
7. Backend/domain logic is authoritative; frontend must consume the same rules rather than reimplementing economics.
8. Historical financial records must remain reproducible even after rules change.
9. AI may explain, recommend, and detect anomalies, but canonical financial/economic rules require deterministic domain logic and explicit governance.
10. A release is complete only when the relevant implementation, tests, documentation, and verification evidence are present in the repository.

## Execution phases

### Phase 0 — Technical baseline / control plane
**Status:** COMPLETE

Evidence recorded in `CURRENT_STATE.md` and `DENTVISION_EXECUTION_LOG.md`.

- [x] Create this master execution plan.
- [x] Create persistent execution log.
- [x] Confirm the existing project control plane: `ARCHITECTURE.md`, `CURRENT_STATE.md`, and `.dentvision/current-state.json`.
- [x] Stabilize CI and record evidence.
- [x] Restore/verify `dentvision-backend/src/modules/patients/patients.routes.ts` against Git history as required by `CURRENT_STATE.md`.
- [x] Verify backend runtime/infrastructure baseline.
- [x] Record the exact baseline commit and active implementation branch in the execution log.
- [x] Locate and read the canonical `DENTVISION_PARTNER_ECONOMICS.md`; retain it as the sole economics policy source.

### Phase 1 — Economics Engine and Ledger vertical slice
**Status:** IN PROGRESS

- [x] Convert canonical partner economics into deterministic executable rules for diagnostic 3D, medical analysis and dental laboratory partners.
- [x] Calculate operation price, platform commission, partner payout, attributable costs, contribution margin and margin status.
- [x] Version applied economics rules and retain snapshots on economics transactions.
- [x] Make economics calculations idempotent and auditable.
- [x] Add automated tests for floors, caps, dental-lab volume tiers, loss detection and rule snapshots.
- [x] Connect diagnostic settlement calculation to the canonical engine.
- [ ] Replace legacy referral-time platform-fee writes with the canonical engine.
- [ ] Complete accepted → paid → settled integration/concurrency tests.
- [ ] Wire the engine into medical-analysis and dental-lab operational order flows.
- [ ] Complete the ledger/reconciliation surface and connect Finance Hub to the durable economics transactions.

### Phase 2 — Partner transparency and Finance Hub
**Status:** QUEUED
- [ ] Partner dashboard shows applicable fee/commission, gross order value, deductions, net payout, payout status, and rule/version reference.
- [ ] Diagnostic centers see branch economics and platform deductions.
- [ ] Analysis laboratories see per-analysis economics.
- [ ] Dental laboratories see per-order/service economics.
- [ ] Expose platform revenue, partner payout, cost, contribution and margin by partner/type/branch/period.
- [ ] Add discrepancy and low-margin alerts.
- [ ] Preserve historical calculations when economics rules change.

### Phase 3 — Automated operations
**Status:** QUEUED
- [ ] Trigger economics automatically when an eligible order/payment is created or completed.
- [ ] Automate payout readiness and notifications.
- [ ] Handle refunds, cancellations, partial fulfillment, discounts, taxes/fees where supported by the domain model.
- [ ] Add scheduled reconciliation and anomaly detection.

### Phase 4 — Product-wide UX and navigation
**Status:** QUEUED
- [ ] Verify the first-load AI workspace flow is functional, not decorative.
- [ ] Remove duplicate navigation/content and establish one clear information architecture.
- [ ] Ensure role-specific navigation and permissions are consistent.
- [ ] Align the web/mobile experience with the canonical DentVision design system/Figma direction.

### Phase 5 — Core clinical workflows
**Status:** QUEUED
- [ ] Patient/visit/medical record workflow.
- [ ] Treatment plans and odontogram history.
- [ ] Diagnostics ordering/results workflow.
- [ ] Laboratory and dental-lab workflows.
- [ ] Notifications, reminders, waitlist, debts/prepayments/installments.
- [ ] Audit trail and medical-data safety controls.

### Phase 6 — Ecosystem modules
**Status:** QUEUED
- [ ] Marketplace/shop.
- [ ] Academy.
- [ ] Jobs/community.
- [ ] Finance Hub.
- [ ] Partner onboarding.
- [ ] AI domain modules and orchestration.

### Phase 7 — Release hardening
**Status:** QUEUED
- [ ] Backend/frontend integration checks.
- [ ] Critical workflow E2E verification.
- [ ] Android build/release verification.
- [ ] Security/permissions/audit checks.
- [ ] Production readiness and rollback evidence.

## Definition of done
A phase is complete only when:
- implementation is committed to GitHub;
- relevant tests/checks exist and pass or documented blockers are recorded;
- user-facing behavior is connected to the real domain logic;
- no duplicate competing source of truth was introduced;
- `DENTVISION_EXECUTION_LOG.md` records what changed, commit, verification, and next action.

## Current execution priority
**Now:** complete the Economics Engine → Ledger vertical slice, starting with referral-time canonical commission writes and lifecycle/concurrency verification.

**Next:** Partner transparency → Finance Hub → automated operations → product-wide UX/clinical/ecosystem hardening.

The work proceeds in vertical slices: implement → verify → commit → update the persistent log → move to the next slice.
