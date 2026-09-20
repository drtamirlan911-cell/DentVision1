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
- [x] Complete accepted → paid → settled integration/concurrency tests with immutable rule/version verification at the durable ledger boundary.
- [x] Wire the real medical-analysis paid/settled operational lifecycle using the existing `Referral + Laboratory + LaboratoryTest + Payment` domain; do not create a duplicate order model.
- [x] Complete the ledger/reconciliation surface and connect Finance Hub to the durable economics transactions end-to-end.
- [x] Keep dental-lab recognition at the existing `delivered` boundary until a real paid/settled callback exists.

### Phase 2 — Partner onboarding, transparency and Finance Hub
**Status:** IN PROGRESS

- [x] Establish E2E coverage entry points for diagnostic-center, medical-laboratory and dental-laboratory owner onboarding.
- [x] Establish E2E coverage entry points for employee management and invitations.
- [x] Complete full owner lifecycle: registration → organization profile → verification/approval state → first login → operational workspace.
- [x] Complete full branch lifecycle: create → edit → switch → assign employees → enforce branch permissions → archive/delete according to the existing domain model.
- [x] Verify the durable Partner Economics dashboard transparency surface shows applicable commission, gross value, deductions/cost, partner net payout, payout status and economics rule/version reference.
- [ ] Diagnostic centers see branch economics and platform deductions.
- [ ] Analysis laboratories see per-analysis economics.
- [ ] Dental laboratories see per-order/service economics.
- [x] Expose platform revenue, partner payout, cost, contribution and margin by partner/type/branch/period through durable transparency/dashboard aggregation.
- [x] Add discrepancy, low-margin and loss alerts from immutable economics rows.
- [x] Preserve historical calculations when economics rules change.

## Canonical Branch Management Contract

Branch management is part of the existing Organization/Workspace model. Do not create a separate branch product or parallel organization model. A branch is an operational scope inside an organization and must use the existing identity, membership, permissions, audit, events and AI context primitives.

### Owner entry point
The organization owner must have one discoverable management path:

`Owner → Settings / Organization → Branches`

The branch list is the canonical place to:
- see all active and archived branches;
- create a branch;
- open a branch workspace;
- edit branch configuration;
- activate/archive a branch;
- manage branch staff and assignments;
- inspect branch operational and financial status;
- enter branch-specific settings.

If the existing navigation has an organization/settings surface, extend it rather than creating a duplicate route or dashboard.

### Branch creation
Creation must be a real persisted workflow, not a modal-only UI.

Required baseline fields:
- name;
- unique organization-scoped code;
- city;
- address;
- phone;
- active state;
- default-branch semantics where applicable.

Optional settings may contain branding, working hours, holidays, communication and operational configuration, but these must remain compatible with the existing `Branch.settings` domain field rather than creating a duplicate settings model.

Creation requirements:
- authorize against the actor's organization scope;
- allow only roles with branch-management permission;
- validate organization-scoped code uniqueness;
- create audit/event records;
- return the persisted branch and make it immediately discoverable after refresh;
- never create a branch outside the current organization/tenant.

### Branch workspace
Opening a branch must provide an operational workspace with the current branch context visible and switchable only within the actor's authorized organization/branch scope.

The branch workspace should expose, according to role and existing domain support:
- Overview / Today;
- Schedule;
- Patients;
- Cases / Clinical;
- Diagnostics;
- Laboratory;
- Team;
- Services & Prices;
- Rooms / Chairs / Equipment;
- Inventory / Warehouse;
- Finance / Cash / Payments;
- Documents / Templates;
- Notifications / Communication;
- Analytics;
- Settings.

Do not expose a screen merely because the label exists. Each item must resolve to an implemented workflow or be explicitly unavailable with a reason.

### Branch settings contract
Branch settings should be organized into practical domains:

1. **General** — name, code, contacts, address, status, default state.
2. **Working time** — schedule, holidays, exceptions and appointment availability.
3. **Team** — invite/add staff, role assignment, branch assignment, enable/disable access.
4. **Rooms & equipment** — rooms, dental chairs and operational resources where supported.
5. **Services & prices** — branch availability and branch-specific price overrides where the domain model supports them.
6. **Inventory** — stock scope, responsible users, low-stock rules and future inter-branch transfer workflows.
7. **Finance** — branch revenue/expense visibility, cash/payment configuration and finance permissions.
8. **CRM & communication** — reminders, confirmations, waitlist, patient communication settings.
9. **Diagnostics & laboratory** — referral routing, deadlines, result visibility and operational contacts.
10. **Documents** — templates, consent/document configuration and responsible roles.
11. **AI & notifications** — branch-scoped AI context, alerts, approvals and notification rules.
12. **Security & audit** — access history, privileged changes and branch-level audit visibility according to role.

Only settings supported by the current domain should be implemented immediately; unsupported areas remain explicit backlog items rather than fake controls.

### Staff and branch scope
The branch lifecycle must support:

`Invite/Add → Assign → Change assignment → Disable/Revoke → Audit`

Branch assignment must use the existing `ClinicMember.branchId`/membership model where applicable. A user may have access to one or more branches only when the permission model allows it. The backend remains authoritative for scope enforcement.

### Data isolation
Branch-aware resources must respect branch scope wherever the existing domain model provides it, including at minimum:
- patients;
- appointments;
- inventory items;
- invoices;
- expenses;
- referrals/diagnostics.

Organization owners may aggregate across authorized branches. Branch-scoped users must not read or mutate another branch's data merely by changing a URL, ID or request payload.

### Archive / deactivate semantics
Branches must not be hard-deleted when doing so would destroy operational or audit history. Prefer inactive/archive semantics already represented by the domain model.

Before deactivation, the workflow must account for:
- active staff assignments;
- future appointments;
- unresolved cases;
- open lab/diagnostic orders;
- inventory/financial records;
- default-branch constraints.

Historical records remain readable according to permission policy. The only active/default branch must not be silently disabled.

### Branch-aware AI
AI context must include the active organization and branch scope. Example supported intents:
- “Покажи показатели филиала за месяц.”
- “Какие записи и лабораторные заказы требуют внимания в этом филиале?”
- “Кто из сотрудников закреплён за филиалом?”
- “Подготовь список низких остатков по филиалу.”

AI must never use branch context to bypass authorization. Any mutation follows `Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit`.

### Required release tests
The branch vertical slice is not complete until an isolated E2E workflow proves:
1. Owner opens the canonical organization/settings branch-management entry point.
2. Owner creates a branch.
3. Branch persists and survives refresh/re-login.
4. Owner edits branch configuration.
5. Owner opens/switches to the branch workspace.
6. Owner assigns an employee to the branch.
7. Assigned employee sees only permitted branch data.
8. Cross-branch read/write attempts are denied.
9. Owner can view organization-wide aggregates across branches.
10. Owner can archive/deactivate a branch under the domain constraints.
11. Historical branch-linked records remain intact and auditable.
12. Visible branch actions are real and produce expected success/error states.

### Implementation order
1. Verify existing branch model and existing branch routes/services before adding code.
2. Wire any missing backend route mounting into the existing application router.
3. Reuse existing organization/settings/team screens for discoverability.
4. Complete branch CRUD + assignment + authorization.
5. Complete branch workspace/switching.
6. Add settings domains only where backed by real data models.
7. Add E2E and negative cross-branch tests.
8. Verify CI/release gates.
9. Record evidence in `DENTVISION_EXECUTION_LOG.md` and update status here.

### Phase 3 — Automated operations
**Status:** QUEUED
- [ ] Trigger economics automatically when an eligible order/payment is created or completed.
- [x] Automate payout readiness and notifications.
- [x] Implement full and partial payment refunds where a durable Finance Core ledger transaction exists; unsupported payment domains fail closed rather than mutating money without a reversal.
- [ ] Handle cancellations, partial fulfillment, discounts, taxes/fees where supported by the domain model.
- [x] Add scheduled reconciliation and anomaly detection.

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
- [x] Receive/create diagnostic orders.
- [x] Process order through the actual status lifecycle.
- [x] Produce/attach result where supported.
- [ ] Verify clinic-side result visibility.
- [ ] Verify payment/settlement/economics and Finance Hub records.

### Medical laboratory owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state.
- [ ] Login as owner.
- [ ] Manage branches and staff.
- [ ] Configure analyses/services using existing domain screens.
- [x] Receive/process analysis workflow.
- [x] Publish/attach results using the existing workflow.
- [x] Verify referral and clinic visibility.
- [ ] Verify medical-analysis economics and settlement lifecycle.

### Dental laboratory owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state.
- [ ] Login as owner.
- [ ] Manage branches and technicians/staff.
- [x] Receive lab order.
- [x] Process order through existing statuses.
- [ ] Verify `delivered` economics recognition.
- [x] Verify remake/cancel/delay behavior does not create premature economics.
- [ ] Verify clinic-side visibility and financial records.

## Role and security matrix

- [ ] Owner: organization-wide management, branch management, staff management, finance visibility according to existing permissions.
- [ ] Admin/manager: only permitted operational/administrative scopes.
- [ ] Doctor/clinical user: only permitted clinical and assigned-organization/branch scopes.
- [ ] Assistant: only permitted assistant workflows.
- [ ] Partner operational roles: only their organization/branch data.
- [x] Cross-tenant reads/writes denied at the shared branch authorization gate.
- [x] Cross-branch reads/writes denied at the shared branch authorization gate.
- [x] Expired/revoked invitations denied; invitation revocation is atomic and audited.
- [x] Disabled organization-branch staff denied active branch scope without deleting audit history.
- [ ] Every privileged mutation remains auditable and idempotent where applicable.

## Definition of done
A phase is complete only when:
- implementation is committed to GitHub;
- relevant tests/checks exist and pass or documented blockers are recorded;
- user-facing behavior is connected to the real domain logic;
- no duplicate competing source of truth was introduced;
- `DENTVISION_EXECUTION_LOG.md` records what changed, commit, verification, and next action.

## Current execution priority
**Now:** run the business-owner lifecycle vertical slice in parallel with the remaining Economics Engine → Ledger work. Start at registration for each partner type, then organization, branches, staff, permissions, operational workflows and economics. The canonical branch contract above is part of this slice: locate the real owner entry point, implement the missing branch management path, verify scope boundaries, and convert every discovered real defect into an implementation fix plus regression test.

**Next:** complete partner transparency/Finance Hub, then automated operations, then product-wide UX/clinical/ecosystem hardening.

The work proceeds in vertical slices: implement → verify → commit → update the persistent log → move to the next slice.