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
11. Browser automation must use isolated test data and must never perform real production payments, messages, or destructive production actions.
12. UX tests must verify behavior and user comprehension signals, not merely that a route renders.

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
- [x] Remove the legacy referral-time economics fallback so settlement cannot use stale `Referral.platformFee` as its authoritative source.
- [x] Add referral lifecycle/concurrency protection for canonical economics reconciliation.
- [x] Connect Partner Economics data to the existing Finance Hub Platform view.
- [ ] Complete accepted → paid → settled integration/concurrency tests with immutable rule/version verification at the durable ledger boundary.
- [ ] Wire the real medical-analysis paid/settled operational lifecycle using the existing `Referral + Laboratory + LaboratoryTest + Payment` domain; do not create a duplicate order model.
- [ ] Complete the ledger/reconciliation surface and connect Finance Hub to the durable economics transactions end-to-end.
- [ ] Keep dental-lab recognition at the existing `delivered` boundary until a real paid/settled callback exists.

### Phase 2 — Partner onboarding, transparency and Finance Hub
**Status:** IN PROGRESS

- [x] Establish E2E coverage entry points for diagnostic-center, medical-laboratory and dental-laboratory owner onboarding.
- [x] Establish E2E coverage entry points for employee management and invitations.
- [ ] Complete full owner lifecycle: registration → organization profile → verification/approval state → first login → operational workspace.
- [ ] Complete full branch lifecycle: create → edit → switch → assign employees → enforce branch permissions → archive/delete according to the existing domain model.
- [ ] Verify partner dashboard shows applicable fee/commission, gross order value, deductions, net payout, payout status, and rule/version reference.
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
**Status:** IN PROGRESS
- [x] Add browser-level UX coverage for the existing critical route matrix.
- [x] Add Playwright CLI as a complementary browser-exploration/smoke layer without replacing `@playwright/test`.
- [ ] Expand UX coverage from route reachability to real user workflows and outcomes.
- [ ] Verify the first-load AI workspace flow is functional, not decorative.
- [ ] Remove duplicate navigation/content and establish one clear information architecture.
- [ ] Ensure role-specific navigation and permissions are consistent.
- [ ] Align the web/mobile experience with the canonical DentVision design system/Figma direction.
- [ ] Verify visible buttons/links/forms have understandable labels and produce the expected result.
- [ ] Verify loading, empty, error and success states for critical workflows.
- [ ] Verify responsive behavior and keyboard/accessibility basics on critical screens.

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
**Status:** IN PROGRESS
- [x] Backend/frontend integration checks exist in CI.
- [x] Critical workflow E2E verification exists and runs in CI.
- [ ] Full owner/partner lifecycle E2E for every partner type.
- [ ] Full employee/role/permission/branch matrix for Owner/Admin/Doctor/Assistant and applicable partner roles.
- [ ] CRUD verification: create → save → refresh → reopen → edit → delete/archive where supported.
- [ ] Negative-path verification: unauthorized access, cross-tenant access, cross-branch access and expired invitations.
- [ ] Button/action audit: visible interactive controls must either work or be explicitly disabled with a reason.
- [ ] Browser console/network/runtime error audit on critical workflows.
- [ ] Android build/release verification.
- [ ] Security/permissions/audit checks.
- [ ] Production readiness and rollback evidence.

## Business-owner lifecycle release matrix

Every partner type must be tested from first contact to daily operation in an isolated E2E environment.

### Diagnostic center owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state using existing workflow.
- [ ] Login as owner.
- [ ] Create/edit/archive branch where supported by the canonical domain model.
- [ ] Add, invite, edit, disable and remove staff according to existing permissions.
- [ ] Assign staff to branch(es) and verify access boundaries.
- [ ] Configure services/diagnostic capabilities using existing screens.
- [ ] Receive/create diagnostic orders.
- [ ] Process order through the actual status lifecycle.
- [ ] Produce/attach result where supported.
- [ ] Verify clinic-side result visibility.
- [ ] Verify payment/settlement/economics and Finance Hub records.

### Medical laboratory owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state.
- [ ] Login as owner.
- [ ] Manage branches and staff.
- [ ] Configure analyses/services using existing domain screens.
- [ ] Receive/process analysis workflow.
- [ ] Publish/attach results using the existing workflow.
- [ ] Verify referral and clinic visibility.
- [ ] Verify medical-analysis economics and settlement lifecycle.

### Dental laboratory owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state.
- [ ] Login as owner.
- [ ] Manage branches and technicians/staff.
- [ ] Receive lab order.
- [ ] Process order through existing statuses.
- [ ] Verify `delivered` economics recognition.
- [ ] Verify remake/cancel/delay behavior does not create premature economics.
- [ ] Verify clinic-side visibility and financial records.

## Role and security matrix

- [ ] Owner: organization-wide management, branch management, staff management, finance visibility according to existing permissions.
- [ ] Admin/manager: only permitted operational/administrative scopes.
- [ ] Doctor/clinical user: only permitted clinical and assigned-organization/branch scopes.
- [ ] Assistant: only permitted assistant workflows.
- [ ] Partner operational roles: only their organization/branch data.
- [ ] Cross-tenant reads/writes denied.
- [ ] Cross-branch reads/writes denied where the domain model requires branch isolation.
- [ ] Expired/revoked invitations denied.
- [ ] Disabled staff denied access without deleting required audit history.
- [ ] Every privileged mutation remains auditable and idempotent where applicable.

## Definition of done
A phase is complete only when:
- implementation is committed to GitHub;
- relevant tests/checks exist and pass or documented blockers are recorded;
- user-facing behavior is connected to the real domain logic;
- no duplicate competing source of truth was introduced;
- `DENTVISION_EXECUTION_LOG.md` records what changed, commit, verification, and next action.

## Current execution priority
**Now:** run the business-owner lifecycle vertical slice in parallel with the remaining Economics Engine → Ledger work. Start at registration for each partner type, then organization, branches, staff, permissions, operational workflows and economics. Convert every discovered real defect into an implementation fix plus regression test.

**Next:** complete partner transparency/Finance Hub, then automated operations, then product-wide UX/clinical/ecosystem hardening.

The work proceeds in vertical slices: implement → verify → commit → update the persistent log → move to the next slice.
