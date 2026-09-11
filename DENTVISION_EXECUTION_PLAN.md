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

### Phase 0 — Persistent control plane
**Status:** IN PROGRESS
- [x] Create this master execution plan.
- [x] Create persistent execution log.
- [ ] Establish current repository baseline and identify the active product source of truth.
- [ ] Locate and read the canonical `DENTVISION_PARTNER_ECONOMICS.md` wherever it exists in the repository history/branches.
- [ ] Record the exact baseline commit and active implementation branch in the execution log.

### Phase 1 — Economics Engine (priority)
**Status:** QUEUED
- [ ] Convert canonical partner economics into deterministic executable rules.
- [ ] Support diagnostic 3D centers, laboratory analyses, dental technical laboratories, and extensible future partner types.
- [ ] Calculate operation price, platform commission, partner payout, DentVision gross revenue, attributable costs, net contribution, and margin-floor status.
- [ ] Version every applied economics rule and retain the rule version on financial transactions.
- [ ] Prevent transactions that violate configured loss/margin floors unless an authorized override is recorded.
- [ ] Make calculations idempotent and auditable.
- [ ] Add automated tests for normal, boundary, discount, refund/cancellation, and low-margin cases.

### Phase 2 — Economics Ledger & Finance Hub
**Status:** QUEUED
- [ ] Persist every economics event in a ledger.
- [ ] Reconcile orders/payments/refunds/payouts against the ledger.
- [ ] Expose platform revenue, partner payout, cost, contribution, and margin by partner/type/branch/period.
- [ ] Add discrepancy and low-margin alerts.
- [ ] Preserve historical calculations when economics rules change.

### Phase 3 — Partner transparency
**Status:** QUEUED
- [ ] Partner dashboard shows applicable fee/commission, gross order value, deductions, net payout, payout status, and rule/version reference.
- [ ] Diagnostic centers see branch economics and platform deductions.
- [ ] Analysis laboratories see per-analysis economics.
- [ ] Dental laboratories see per-order/service economics.
- [ ] Add clear explanations without exposing sensitive internal platform cost data where inappropriate.

### Phase 4 — Automated operations
**Status:** QUEUED
- [ ] Trigger economics automatically when an eligible order/payment is created or completed.
- [ ] Automate payout readiness and notifications.
- [ ] Handle refunds, cancellations, partial fulfillment, discounts, taxes/fees where supported by the domain model.
- [ ] Add scheduled reconciliation and anomaly detection.

### Phase 5 — Product-wide UX and navigation
**Status:** QUEUED
- [ ] Verify the first-load AI workspace flow is functional, not decorative.
- [ ] Remove duplicate navigation/content and establish one clear information architecture.
- [ ] Ensure role-specific navigation and permissions are consistent.
- [ ] Align the web/mobile experience with the canonical DentVision design system/Figma direction.

### Phase 6 — Core clinical workflows
**Status:** QUEUED
- [ ] Patient/visit/medical record workflow.
- [ ] Treatment plans and odontogram history.
- [ ] Diagnostics ordering/results workflow.
- [ ] Laboratory and dental-lab workflows.
- [ ] Notifications, reminders, waitlist, debts/prepayments/installments.
- [ ] Audit trail and medical-data safety controls.

### Phase 7 — Ecosystem modules
**Status:** QUEUED
- [ ] Marketplace/shop.
- [ ] Academy.
- [ ] Jobs/community.
- [ ] Finance Hub.
- [ ] Partner onboarding.
- [ ] AI domain modules and orchestration.

### Phase 8 — Release hardening
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

## Current priority
**Priority 1: Partner Economics → Economics Engine → Ledger → Partner transparency → Finance Hub automation.**

The immediate next action is to locate the canonical partner-economics document in the repository/branches, read it completely, then map its rules onto the existing code before implementing anything that could duplicate current business logic.
