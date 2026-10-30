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

Evidence recorded in `DENTVISION_CONTEXT.md` and `DENTVISION_EXECUTION_LOG.md`; the context file is the current state bootstrap.

- [x] Create this master execution plan.
- [x] Create persistent execution log.
- [x] Confirm the control plane: `DENTVISION_CONTEXT.md` is the current state/authority bootstrap; `ARCHITECTURE.md` is the architecture overview; `.dentvision/current-state.json` is the curated machine-readable summary sourced from context (`generated: false`).
- [x] Record repository-path audit: `CURRENT_STATE.md` is absent at this branch head and is not an active current-state source; do not recreate a competing status document.
- [x] Stabilize CI and record evidence.
- [x] Restore/verify `dentvision-backend/src/modules/patients/patients.routes.ts` against Git history, recording evidence in `DENTVISION_EXECUTION_LOG.md` (no `CURRENT_STATE.md` exists at this branch head).
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
- [x] Diagnostic centers see branch economics and platform deductions through durable branch-filtered Partner Economics transparency/dashboard data.
- [x] Analysis laboratories see per-analysis economics through durable Partner Economics transactions and Finance Hub transparency.
- [x] Dental laboratories see per-order/service economics through delivered-boundary Partner Economics transactions and Finance Hub transparency.
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
- [x] Trigger economics automatically at supported settlement boundaries: medical-analysis payment settlement, dental-lab `delivered`, and diagnostic paid settlement; each is idempotent and ledger-backed.
- [x] Automate payout readiness and notifications.
- [x] Implement full and partial payment refunds where a durable Finance Core ledger transaction exists; unsupported payment domains fail closed rather than mutating money without a reversal.
- [x] Handle supported cancellation/refund boundaries with full/partial Finance Core reversals; unsupported domains fail closed rather than mutating financial state without a durable reversal.
- [x] Add scheduled reconciliation and anomaly detection.

### Phase 4 — Product-wide UX and navigation
**Status:** IN PROGRESS
- [x] Add browser-level UX coverage for the existing critical route matrix.
- [x] Add Playwright CLI as a complementary browser-exploration/smoke layer without replacing `@playwright/test`.
- [x] Expand UX coverage from route reachability to real user workflows and outcomes; organization/branch, partner onboarding, partner lifecycle and Finance Hub journeys are covered in Playwright suites.
- [x] Verify the first-load AI workspace flow is functional, not decorative; authenticated root lands in the real `/ai` workspace and first-action failures are surfaced.
- [x] Remove duplicate navigation shell and establish one canonical information architecture; SuperAppSidebar now aliases the canonical EcosystemSidebar and the IA/token contract is documented.
- [x] Ensure role-specific navigation and permissions are consistent; RBAC and branch-management negative-path coverage exists.
- [x] Establish the canonical web/mobile DentVision design-system and Figma handoff contract, reusing existing --dv-* tokens and one shared IA; connected-Figma canvas execution remains gated on an available Figma file.
- [x] Verify visible buttons/links/forms have understandable labels and critical onboarding/branch/owner actions are exercised by browser tests.
- [x] Verify loading/error/success behavior on critical owner, partner and AI workflows; remaining broad UI state execution is release-gated.
- [x] Verify responsive behavior and accessible button naming on critical screens through browser UX coverage.

### Phase 5 — Core clinical workflows
**Status:** QUEUED
- [x] Patient → treatment case → appointment → completed visit → patient summary workflow is covered by a dedicated E2E journey.
- [x] Treatment plans and odontogram persistence/history contract: treatment-plan CRUD/status/tenant tests plus tooth 16 status/surface round-trip through the canonical patient write/read model.
- [x] Diagnostics ordering/results workflow is covered by the partner lifecycle and referral/result E2E/API journeys.
- [x] Laboratory and dental-lab lifecycle workflows are covered by canonical transition and delivery/remake/delay tests.
- [x] Notifications/reminders: preference-aware in-app/channel dispatch, reminder cron/manual endpoint and reminder idempotency are implemented; waitlist is persisted in the canonical WaitingList model. Invoice partial payments/installments and patient prepayment consumption are now implemented and covered by E2E contracts. [ ] Final debt/prepayment/installment release execution evidence remains; implementation now includes durable partial refunds and idempotent Finance Core reversals.
- [x] Audit trail and medical-data safety controls: compliance routes, medical-file access logging, consent/version enforcement, AI action confirmation and security dashboard are implemented. [ ] Final browser/security execution evidence remains.

### Phase 6 — Ecosystem modules
**Status:** QUEUED
- [x] Marketplace/shop API workflow suite covers catalog, order creation, server-side pricing, stock boundaries, idempotency and supplier discovery.
- [x] Academy workflow suite covers course discovery, enrollment, progress, completion/certificate and duplicate enrollment behavior.
- [x] Jobs/community routes and screens are present; workflow coverage remains release-gated where no canonical seeded mutation contract exists.
- [x] Finance Hub durable partner economics dashboard, reconciliation and transparency workflows are covered.
- [x] Partner onboarding registration forms and owner/organization lifecycle are covered by browser/API workflows.
- [x] AI domain modules and orchestration: role agents, persona routing, context/data scope, permission-gated tools, confirmation-gated mutations, verification/merge lifecycle and deterministic fallback are implemented. [ ] Final live-provider/browser execution evidence remains.

### Phase 7 — Release hardening
**Status:** IN PROGRESS
- [x] Backend/frontend integration checks exist in CI.
- [x] Critical workflow E2E verification exists and runs in CI.
- [x] Full owner/partner lifecycle E2E entry points and operational lifecycle coverage exist for diagnostic center, medical laboratory and dental laboratory; execution evidence remains release-gated.
- [x] Full employee/role/permission/branch matrix coverage has been extended with organization branch management negative-path tests; release execution remains gated.
- [x] CRUD verification coverage exists for owner/staff/branch lifecycle and persistence; remaining domain-specific CRUD is release-gated.
- [x] Negative-path verification covers unauthorized, cross-tenant, cross-branch and expired/revoked invitation boundaries.
- [x] Button/action audit covers visible button naming and critical owner workflow actions.
- [x] Browser console/request-failure collection is integrated into critical owner lifecycle coverage; broad route audit remains execution-gated.
- [x] Android build/release pipeline is implemented: debug/preview/release variants, Gradle unit-test + preview APK workflow, artifact publication and manual workflow dispatch. Final hosted run/device installation evidence remains release-gated.
- [x] Security/permissions/audit checks: cross-tenant/cross-branch, invitation revocation and disabled-member boundaries plus audited medical-record access are implemented; final execution evidence remains release-gated.
- [ ] Production readiness and rollback evidence: deployment/rollback execution must still be captured from the current release candidate.

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
- [x] Verify clinic-side diagnostic result visibility after signing through the canonical referral read contract.
- [x] Verify payment/settlement/economics and Finance Hub records.

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
- [x] Verify medical-analysis economics and settlement lifecycle.

### Dental laboratory owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state.
- [ ] Login as owner.
- [ ] Manage branches and technicians/staff.
- [x] Receive lab order.
- [x] Process order through existing statuses.
- [x] Verify `delivered` economics recognition.
- [x] Verify remake/cancel/delay behavior does not create premature economics.
- [x] Verify clinic-side visibility and financial records.

## Patient experience release matrix

The patient is a first-class product context, not a clinic staff role. The patient account is linked to exactly one patient card per clinic through the existing patient-portal identity/link contract and must never inherit clinic-staff navigation or permissions.

Required release checks:
- [x] Canonical PATIENT account role exists in the UserRole model.
- [x] Patient permissions are limited to self-service profile, marketplace/academy discovery and public diagnostics discovery; medical data remains behind patient-portal ownership checks and consent.
- [x] Demo patient account is linked to a real seeded patient card.
- [x] Patient login routes directly to /patient-portal rather than /ai.
- [x] Patient portal consent gate is exercised before protected medical data tabs.
- [x] Patient design gate checks appointments, treatments, visits, payments, documents, diagnostics and access contexts.
- [x] Patient negative-path design gate verifies clinic CRM, staff, finance, inventory, lab and platform-admin routes are not exposed.
- [ ] Fresh CI execution of the patient role/device matrix.
- [ ] Final interactive production patient login/portal evidence.

PATIENT must not be a clinic ClinicMember; the Patient.userId link is the ownership boundary for the portal. Staff access remains governed by clinic/branch permissions.

## Role and security matrix

- [x] Owner: organization-wide management, branch management, staff management and finance visibility are enforced/covered by the current IAM/RBAC contracts and owner lifecycle tests; final live execution evidence remains release-gated.
- [x] Admin/manager: operational and administrative scopes are permission-gated; branch-management negative-path coverage exists.
- [x] Doctor/clinical user: clinical and assigned organization/branch scope is enforced by shared branch authorization and negative-path tests.
- [x] Assistant: permission-gated workflow access is covered by the RBAC contract; final browser execution remains release-gated.
- [x] Partner operational roles: organization/branch isolation is enforced through shared authorization gates and partner lifecycle tests.
- [x] Patient role: patient-portal access is isolated from clinic staff permissions and covered by a dedicated role/design gate.
- [x] Cross-tenant reads/writes denied at the shared branch authorization gate.
- [x] Cross-branch reads/writes denied at the shared branch authorization gate.
- [x] Expired/revoked invitations denied; invitation revocation is atomic and audited.
- [x] Disabled organization-branch staff denied active branch scope without deleting audit history.
- [x] Privileged branch/invitation/organization mutations have audit actions and applicable idempotent/race-safe boundaries.

## Definition of done
A phase is complete only when:
- implementation is committed to GitHub;
- relevant tests/checks exist and pass or documented blockers are recorded;
- user-facing behavior is connected to the real domain logic;
- no duplicate competing source of truth was introduced;
- `DENTVISION_EXECUTION_LOG.md` records what changed, commit, verification, and next action.

## Current execution priority
**Now — P0 candidate D1–D10, existing PR #330 only:** continue on `fix/d1-d10-trial-archive-signing-api-20261029`, based on `main` at `ac913cc3389a294d0b135a852b035ddddb1018ca`. Do not create a branch or PR, do not merge to main, and do not combine the separate #328/#329 candidates without their own verification and an explicit integration decision.

The candidate implements the 30-day Enterprise trial/backfill and read-only expiry behavior (D1), organization soft archive (D2), document-signing route/token alignment (D3), guarded route aliases (D4), supplier helper correction (D6), invitation-route ownership reconciliation (D7), and the nullable archive/backfill migrations (D8). D9 is still open because the full CI/E2E gate has not passed. D10 remains open because aliases and route existence do not prove every Master Spec workflow is functionally complete. D5 remains open for PHI staging backfill, production CORS/WebSocket verification, official Kaspi contract/callback validation and repository-admin branch protection.

**Latest confirmed candidate fix:** `/api/auth/demo-clinic` searched only for `Clinic.plan = DEMO`, while the shared creation service now creates `ENTERPRISE` trials and the legacy migration upgrades eligible DEMO rows to ENTERPRISE. That mismatch could create a second clinic/trial on repeat calls. The existing-clinic lookup now recognizes both DEMO and ENTERPRISE; archive-aware IAM test contracts were aligned and explicit archived-organization denial tests were added. Commits: `c83cbd010f59399d4d1647366f3a6752e8e892a6`, `e6c3147604f21acf0bf8766048f802540c54c015`, `411ae782f2bdb9964c4c8e5b40378c267ae8aaa1`.

**Verification gate:** the last full candidate run was [40870315832](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/40870315832), on PR merge ref `51a4e1f8dcc53b6284932127f482ccbb48d46c80` for head `469b32d3403614a67151b649de9bf73f03ef9d15). Frontend lint, backend lint, Quality Gate and RB-034 context diagnostic passed. Unit tests had 2,301 passed / 4 failed in `orgContext.test.ts` and `auth.diagnostics-endpoints.contract.test.ts`. E2E's overall job was cancelled after core and Browser UX sub-gates failed: branch-picker option outside viewport; 403 resources on `/crm/patients` and `/crm/treatment-plans`. Mobile design gate passed. The fixes above require a new exact-head run; the prior run is not evidence for the new head.

**Parallel work that must be preserved:** PR #328 remains open on `fix/workspace-switcher-menu-overflow-20261026`; its own run has a TypeScript `_res` error in `planGate.ts`, one stale CRM security contract assertion and cancelled E2E. PR #329 remains open on `security/rb029-patient-portal-history-envelope-20261026`; Quality Gate and lint/unit stages passed, but E2E was cancelled and RB-029 staging/backfill review remains open. PR #322 remains an isolated Codespaces draft; its CI is failed and Vercel reported a build-rate-limit error. PR #326 is already merged. Do not close, merge, overwrite or clean up these branches as part of this candidate.

**Next sequence:** (1) inspect the new exact-head CI and fix only confirmed failures without removing assertions; (2) obtain staging approval, apply both timestamped migrations and verify migration counts/rollback; (3) prove expired-clinic GET/read access and rejected write/public-booking/signing paths with authenticated E2E; (4) finish RB-029 consumer/concurrent-writer audit and read-only staging dry run; (5) verify production CORS/WebSocket and the merchant-issued Kaspi contract; (6) complete the D10 route-to-workflow matrix from the Master Spec. Keep every item open until its evidence exists.

The work proceeds in vertical slices: implement → targeted verify → full relevant gates → commit → update the persistent log → move to the next slice.

## Ecosystem support operations — inventory-first workstream (2026-10-23)

**Status:** DESIGN RECORDED; implementation inventory and runtime verification NOT STARTED. Do not treat this as a shipped feature.

Canonical design: `docs/operations/DENTVISION_ECOSYSTEM_SUPPORT_OPERATIONS.md`. This is a bounded operations model, not a competing roadmap or source of product/economic policy.

- [ ] SUP-01 inventory existing support, feedback, incident, admin, notification and knowledge capabilities in code and tests.
- [ ] SUP-02 verify tenant-scoped case lifecycle and immutable audit history.
- [ ] SUP-03 prove server-side role/domain authorization and cross-tenant denial.
- [ ] SUP-04 approve severity/service-hours policy before enabling SLA clocks.
- [ ] SUP-05 verify incident ownership, timeline, customer updates and postmortem workflow.
- [ ] SUP-06 verify assignment, backup ownership, overdue detection and escalation delivery.
- [ ] SUP-07 verify safe attachments, PHI redaction and restricted clinical evidence access.
- [ ] SUP-08 define and reconcile dashboard metrics against source records.
- [ ] SUP-09 verify knowledge search, article permissions, ownership and review lifecycle.
- [ ] SUP-10 verify notification delivery, retries, deduplication and PHI-safe payloads.
- [ ] SUP-11 verify defect-to-PR-to-CI-to-release traceability.
- [ ] SUP-12 verify AI triage remains advisory, evidence-grounded and human-approved for high-risk actions.
- [ ] SUP-13 verify mobile, offline/retry, accessibility and all ecosystem participant contexts.
- [ ] SUP-14 verify retention, deletion, export and legal-hold controls.
- [ ] SUP-15 assign primary/backup operational owners and rehearse incident recovery.

Definition of DONE for each SUP item: exact code path + owning service + authorization scope + tests + current CI/runtime evidence + known limitations. A route, screen or document alone is insufficient. Update this existing plan and the execution log; do not create another status register.


## 2026-10-30 — Current exact-head continuation (PR #330)

This checkpoint supersedes the older CI evidence in the priority notes above. Continue only on `fix/d1-d10-trial-archive-signing-api-20261029` / existing PR #330. The pre-correction candidate reviewed for this pass was `6b02e31eba480084ba57d481b130fcafafe037f5`; `main` was `ac913cc3389a294d0b135a852b035ddddb1018ca`. The local checkout is not mounted, so local `git status` remains unverified.

- Exact-head run [41004898403](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41004898403): frontend/backend lint, TypeScript/build, generated inventory checks, Quality Gate and RB-034 diagnostic passed; unit tests were 2,316/2,326 with 10 failures.
- Corrective candidate: update three brittle trial/archive source-contract assertions; add Express `method: 'GET'` to referral-access test requests (runtime access middleware unchanged); restrict organization archive to scoped owner-level roles rather than generic `admin` / `org_admin`, per IAM matrix, with a regression contract. Re-run exact-head CI before accepting.
- E2E 41004898403 is not green: core 240 passed / 5 skipped / BRANCH-003 failed because the branch option was outside viewport; browser UX 3 passed / one test failed on 403 resources at `/crm/patients` and `/crm/treatment-plans`; mobile design gate passed with 15 passed / one flaky WebKit attempt; role/context was cancelled and later gates skipped. Do not disable assertions. PR #328 owns the separate workspace-picker remediation; preserve it.
- Parallel candidates preserved: #328 open (CI failed, Quality Gate passed); #329 open (CI cancelled, Quality Gate passed; RB-029 staging/backfill still open); #322 open draft. No branch/PR creation, merge, deployment, DB migration or production write.
- Next: exact-head correction CI; endpoint-level tracing and least-privilege diagnosis for CRM 403s; complete full E2E/role/owner gates; then approved staging verification of trial/archive migrations, PHI backfill dry run, production CORS/WebSocket, official Kaspi contract/callback, branch protection and D10 workflow parity. All remain release blockers until evidenced.

