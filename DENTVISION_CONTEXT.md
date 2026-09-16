# DentVision — Session Bootstrap / Current Context

**First-read file for every future DentVision AI/engineering session.**

## 1. Repository identity
- Product: DentVision — Dental Operating System / ecosystem.
- Repository: `drtamirlan911-cell/DentVision1`.
- Persistent execution directive: `DENTVISION_OPERATING_DIRECTIVE.md`.
- Execution plan: `DENTVISION_EXECUTION_PLAN.md`.
- Execution evidence/history: `DENTVISION_EXECUTION_LOG.md`.
- Product north star/requirements: `DENTVISION_SUPERAPP_BLUEPRINT.md` and `DENTVISION_SUPERAPP_MASTER_PLAN.md`.
- Canonical economics: `docs/business/DENTVISION_PARTNER_ECONOMICS.md`.

## 2. Authority and anti-confusion rules
1. Current repository code and current CI/runtime evidence are authoritative for implementation status.
2. This file is the current bootstrap; it must be updated when verified state changes.
3. The Operating Directive is the persistent implementation/growth contract and must survive chat/session changes.
4. The Execution Plan controls sequencing and Definition of Done.
5. The Execution Log records material changes and evidence.
6. Blueprint/master plan define requirements, not proof of implementation.
7. Economics policy is the only canonical pricing/commission/accounting source.
8. Never mark DONE because a route, screen, model, or document exists.
9. Never create a competing roadmap, current-state file, release gate or economics policy without a clearly different purpose.
10. Preserve all unfinished previous work while adding new priorities.

## 3. Status vocabulary
- DONE = implementation + workflow + verification evidence agree.
- PARTIAL = meaningful implementation exists but full workflow is incomplete.
- BROKEN = intended path exists but verification exposes a defect.
- UNVERIFIED = implementation may exist but evidence is insufficient.
- NOT IMPLEMENTED = capability absent or only scaffolding/UI exists.
- CONFLICT = sources disagree; resolve from current evidence.

## 4. Product north star
DentVision is one Dental Operating System, not separate CRM/Shop/Academy/AI products. The central connector is the Clinical/Treatment Case.

Canonical graph:
`Patient → Diagnosis → Imaging → AI Findings → Treatment Plan → Appointments → Procedures → Lab → Materials → Documents → Payments → Communication → Follow-up → Outcome`

AI action lifecycle:
`Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit`

Core workspaces: Home/Today, Practice/CRM, Diagnostics, AI, Shop, Academy, Analytics and Network, with role-based administration and mobile navigation.

## 5. Verified repository state — 2026-09-14
- PR #275 was merged into `main` as `b1daa27c0e0b4c446a9350186107b438ac8ba342`; older branch documents describing it as open are stale.
- `main` has since advanced to `83259a9a8424f6c4796ebaa64850b6d218ae1489` with the latest auth/release-gate hardening changes.
- GitHub workflow lookup currently returns no workflow run for `83259a9a...`; combined status currently exposes only Vercel, which is **PENDING**. Therefore post-change CI/release status is **UNVERIFIED**, not green by assumption.
- Vercel availability/status is an external deployment signal and is not proof of code correctness.

### Product status
- Clinical RBAC boundary: **IMPLEMENTED + unit coverage** for clinical writes/signing; fresh CI evidence still required.
- IAM / role matrix / tenant and branch isolation: **PARTIAL**; negative-path matrix still required.
- Active-session enforcement: **IMPLEMENTED + E2E regression added**; revoked session must return 401.
- Partner onboarding: PARTIAL.
- Economics engine/ledger: PARTIAL; deterministic engine and rule snapshots exist, durable paid→settled medical-analysis and full reconciliation remain open.
- Clinical OS / Treatment Case: PARTIAL.
- Diagnostics: PARTIAL; confirmation action exists, full clinic→partner→result→confirmation→payment lifecycle is not release-proven.
- Medical analysis laboratories: PARTIAL.
- Dental laboratories: PARTIAL.
- AI control plane: PARTIAL.
- Marketplace / Academy / Jobs / Community: PARTIAL.
- Finance Hub: PARTIAL.
- UX/design system: PARTIAL.
- Web release: NOT READY until fresh gates prove the target commit.
- True natural interactive 32-tooth WebGL/3D odontogram: NOT IMPLEMENTED; current dental chart is not evidence of a WebGL renderer.
- Android release: UNVERIFIED until fresh build/install/runtime evidence exists.

## 6. Known recent implementation facts
- `TreatmentCaseWorkspace` exists; full case lifecycle remains unverified/partial.
- Root `/` currently maps to Dashboard; older audits claiming AI workspace at `/` are historical.
- Diagnostics has real referrals, center/lab access checks, studies, files and AI-result flows.
- Auth middleware requires an active `UserSession` for protected users; the new E2E regression explicitly revokes the session row and verifies `/api/auth/me` returns 401.
- Branch-scoped IAM foundations exist across clinic, finance, diagnostics and inventory domains.
- `quality-gate.yml` is now blocking: the release-gate script is no longer `continue-on-error`, so a failed release gate cannot silently produce a green workflow.

## 7. Canonical branch management model
A branch is a first-class operating unit inside an Organization/Clinic. It is not merely an address field.

The owner/organization manager must have one canonical management flow:
`Owner → Settings/Organization → Branches → Create → Configure → Staff/Access → Operations → Analytics → Archive`

### Branch lifecycle requirements
- Create branch with unique organization-scoped code and human-readable name.
- Configure city, address, phone, active/default state and branch settings.
- Set working hours/holidays and operational preferences.
- Assign/invite staff and define branch-scoped roles/access.
- Configure rooms/chairs/equipment where the existing domain supports them.
- Configure services and branch-specific price overrides without duplicating global service definitions.
- Configure inventory/warehouse behavior and inter-branch transfer rules where supported.
- Connect diagnostics, medical/dental laboratory workflows and branch routing.
- Expose branch-level finance, cash/payment and operational analytics while preserving organization-level aggregation for authorized owners.
- Configure branch documents/templates, notifications, reminders, patient communication and AI notification preferences.
- Allow safe edit and archive/suspend; do not hard-delete historical operational data.
- Archiving must preserve audit history and must not silently orphan staff, appointments, patients, invoices, inventory or referrals.

### Branch permissions and isolation
- Owner: organization-wide branch create/edit/archive, staff assignment, branch configuration and aggregate visibility according to canonical IAM permissions.
- Admin/manager: only explicitly granted operational branch actions.
- Doctor/assistant/partner operator: only assigned/permitted branch data.
- Cross-tenant and unauthorized cross-branch reads/writes must fail closed.
- Organization-wide reporting may aggregate branch data only for roles with organization scope.
- AI actions must use the same organization/branch scope and permission model as direct UI actions.

### Branch-aware data
Branch scope must be preserved consistently for applicable resources, including patients, appointments, staff memberships, inventory, invoices/expenses, referrals/diagnostics and future branch-aware clinical/operational entities.

### Required owner UX
The owner must be able to discover branch management without knowing an API or internal model name. The branch list should show status and operational summary, and opening a branch should expose a branch workspace with Overview, Staff, Schedule/Rooms, Patients/Cases, Services & Prices, Inventory, Finance, Diagnostics/Lab, Analytics and Settings according to available permissions.

### Required release scenarios
- Owner creates branch → saves → refreshes → branch persists and appears in organization context.
- Owner edits branch → changes persist after reload.
- Owner assigns staff → staff can access only permitted branch scope.
- Unauthorized user cannot read/write another branch.
- Archiving/suspension preserves historical records and blocks inappropriate new operations.
- Organization owner can switch between branches and view organization-level aggregate data where authorized.
- Branch-scoped patients/appointments/invoices/inventory/referrals remain correctly isolated.

This model is a product requirement. It is **not evidence that the complete branch workflow is already implemented**.

## 8. Canonical economics
Use `docs/business/DENTVISION_PARTNER_ECONOMICS.md` only:
- Clinic SaaS: START ₸19,900; PRO ₸39,900; BUSINESS ₸79,900; NETWORK from ₸149,900/branch.
- Diagnostic/3D center: ₸49,900/branch/month; 7% DentVision-originated orders; min ₸500/study; max ₸3,000/study.
- Medical analysis lab: ₸19,900/branch/month; 6%; min ₸150/analysis; max ₸2,500/analysis.
- Dental lab: ₸29,900/month; preserve canonical 8% default + volume tiers/min/max policy until explicitly revised.
- Marketplace: 8% standard, 6% high-volume, 4–5% strategic.
- Academy: lecturer-originated 10/90; DentVision-originated 25/75; full marketing+sales 30/70.
- Finance must distinguish GMV, platform revenue, processing, AI inference, storage/data, support/ops, refunds/chargebacks, tax/VAT, contribution margin and net platform revenue.
- Pricing changes require version/effective date/migration/impact/audit; historical records remain reproducible.

## 9. Required role/security matrix
Clinic: Owner, Administrator, Manager, Doctor, Assistant.
Partners: Diagnostic Center Owner/Manager/Operator/Radiologist as applicable; Medical Laboratory Owner/Manager/Operator; Dental Laboratory Owner/Manager/Technician/Operator as applicable; Superadmin where applicable.

For every role verify: allowed/denied actions, tenant isolation, branch isolation, invitations, disabled/revoked access, active-session enforcement, audit trail and privileged mutation safety.

## 10. Product-led growth directive
The product must reduce explanation and increase self-demonstration/value:
`Visitor → Interactive Demo → Signup → Role/Goal → First Value → Trial → Payment → Upgrade → Expansion → Referral`

Implement growth by extending existing systems, not by creating a parallel product. Priority capabilities:
- central privacy-aware growth event vocabulary;
- role/goal onboarding using real IAM/org/branch state;
- First Value Engine targeting meaningful value in <10 minutes;
- contextual Next Best Action;
- AI product-operator behavior within the existing permission/risk/audit model;
- contextual trial/upsell based on real entitlement and usage;
- transparent ROI/value explanations;
- patient/treatment-plan sharing loop with privacy safeguards;
- clinical-context links to Shop, Diagnostics, Dental Lab and Academy;
- CEO Growth Dashboard using existing Analytics/Finance truth.

The product should continuously answer: **What should I do now? Why does it matter? What can DentVision do for me? What is the next useful action?**

## 11. Immediate execution queue
### P0 — Release correctness
1. Verify current `main` CI from the newest relevant commit/run; do not infer green status.
2. Verify diagnostics route/service contract around `confirmAiResult`.
3. Verify auth session creation/issuance fails closed.
4. Run full CI/E2E/browser gates.
5. Complete IAM negative matrix: clinic roles, partner operational roles, cross-tenant, cross-branch, invitation revocation/expiry, revoked sessions, and privileged mutation denial.

### P1 — Economics / partner operations
6. Complete accepted→paid→settled durable lifecycle and immutable rule/version verification.
7. Complete medical-analysis operational economics/settlement.
8. Preserve dental-lab recognition at `delivered` until a real paid/settled callback exists.
9. Complete ledger/reconciliation and Finance Hub transparency.
10. Complete partner owner/branch/staff operational lifecycle, including the canonical branch management flow above.

### P2 — Clinical vertical slice
11. Verify Patient→Case→Diagnosis/Imaging→AI Findings→Plan→Appointment→Lab/Materials→Payment→Follow-up.

### P3 — Self-selling product
12. Implement central growth events.
13. Implement role/goal onboarding + First Value.
14. Implement Demo + Next Best Action.
15. Implement contextual trial/upsell + ROI.
16. Implement patient/treatment-plan referral loop.
17. Implement cross-module clinical recommendations.
18. Implement CEO Growth Dashboard.

### P4 — Final hardening
19. Accessibility/responsive/performance/error-state/browser runtime audit.
20. Security/audit/release hardening.
21. Android build/install/runtime verification.
22. Real 32-tooth WebGL/3D odontogram.

## 12. Working rule
For each slice: **inspect → implement → test → fix → verify → document → continue**. Do not repeat an audit when implementation can resolve the issue. If a document becomes stale, update/remove it rather than creating another competing source of truth.
