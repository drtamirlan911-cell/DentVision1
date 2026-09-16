# DentVision — Operating Directive

> Persistent execution contract for AI/engineering work on DentVision. This document stores the directive agreed during development so it survives chat/session changes.

## Mission

Build DentVision as one coherent Dental Operating System that is easier to operate, easier to adopt, easier to understand and able to demonstrate and sell its own value through the product itself.

Do not build a collection of disconnected modules. Reuse the existing CRM, Clinical/Treatment Case, Diagnostics, Medical Laboratory, Dental Laboratory, Shop, Academy, Finance Hub, AI, Network, IAM and notification foundations and connect them through shared domain context.

## Non-negotiable operating loop

`Inspect → implement → test → fix → verify → document → continue`

- Work from the real repository, not from assumptions or old audits.
- Preserve previous unfinished tasks; growth work never replaces security, economics, clinical, partner or release work.
- Fix blockers before adding breadth.
- Prefer small, reversible changes and existing domain services/models.
- Never create fake endpoints, permissions, models, fixtures or UI solely to satisfy tests.
- Never claim DONE from route/model/screen existence alone.
- Every material change must have implementation evidence and regression verification.
- Keep medical, financial and authorization decisions deterministic and auditable.

## Source-of-truth hierarchy

1. Current repository code and current CI/runtime evidence.
2. `DENTVISION_CONTEXT.md` — current bootstrap and verified state.
3. `DENTVISION_EXECUTION_PLAN.md` — execution order and definition of done.
4. `DENTVISION_EXECUTION_LOG.md` — durable history/evidence.
5. `DENTVISION_SUPERAPP_BLUEPRINT.md` + `DENTVISION_SUPERAPP_MASTER_PLAN.md` — product requirements and north star.
6. `docs/business/DENTVISION_PARTNER_ECONOMICS.md` — sole canonical economics policy.

Historical audits and stale state snapshots are not release evidence.

## Product model

Central object: **Clinical/Treatment Case**.

`Patient → Diagnosis → Imaging → AI Findings → Treatment Plan → Appointments → Procedures → Lab → Materials → Documents → Payments → Communication → Follow-up → Outcome`

AI action lifecycle:

`Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit`

## Canonical branch operating model

A branch is a first-class operating unit inside an Organization/Clinic. It is not only an address or display label. The owner/organization manager must be able to operate the full lifecycle through the product:

`Settings/Organization → Branches → Create → Configure → Staff/Access → Operations → Analytics → Archive/Suspend`

Branch requirements:

- organization-scoped unique code and human-readable name;
- city, address, phone, active/default state and branch settings;
- working hours/holidays and operational preferences;
- staff invitation/assignment and branch-scoped permissions;
- rooms/chairs/equipment where supported by the existing domain;
- shared services with explicit branch-specific price overrides, without duplicate service definitions;
- inventory/warehouse and inter-branch transfer controls where supported;
- diagnostics, medical/dental laboratory routing;
- branch finance/payment and operational analytics;
- documents/templates, notifications, reminders, patient communication and AI preferences;
- reversible archive/suspend semantics that preserve history and auditability.

Owner capabilities must be discoverable from normal navigation. The owner should see a branch list, open a branch workspace, edit configuration, assign staff, switch branch context and inspect branch-level operations without knowing internal APIs/models. Authorized owners may also see organization-level aggregates across branches.

Branch-aware resources must retain scope consistently where supported: patients, appointments, staff memberships, inventory, invoices/expenses, referrals/diagnostics and future branch-aware clinical/operational entities.

Security rule:

`Person → active context → Organization/Branch → Role → Permission → Scope → Ownership → Resource state → Audit`

No AI action, UI action or API action may bypass branch scope. Cross-tenant and unauthorized cross-branch access must fail closed. Archive/suspend must not silently orphan historical records, staff, appointments, patients, invoices, inventory or referrals.

Required branch release scenarios:

1. Owner discovers Branches from Settings/Organization.
2. Owner creates a branch and the branch persists after refresh.
3. Owner edits and reopens the branch; changes persist.
4. Owner assigns staff and effective branch scope is enforced.
5. Owner switches branches without losing organization context.
6. Organization-level owner reporting aggregates branch data only when authorized.
7. Unauthorized users cannot read/write another branch.
8. Archive/suspend preserves history and blocks inappropriate new operations.

This is a product/engineering requirement, not evidence that the workflow is already implemented.

## Product-led operating model

The product should continuously answer four questions for the current user:

1. What should I do now?
2. Why does it matter?
3. What can DentVision do for me automatically?
4. What is the next useful action?

### Activation funnel

`Visitor → Interactive Demo → Signup → Role/Goal → First Value → Trial → Payment → Upgrade → Expansion → Referral`

Target: first meaningful value in under 10 minutes for a new professional user, without requiring a training session.

### Role-first onboarding

Support the real role matrix already defined in the repository:

- Clinic: Owner, Administrator, Manager, Doctor, Assistant.
- Diagnostic center: Owner/Manager/Operator/Radiologist as applicable.
- Medical laboratory: Owner/Manager/Operator.
- Dental laboratory: Owner/Manager/Technician/Operator as applicable.
- Superadmin where applicable.

Onboarding must use real organization/branch/IAM state and must never create a parallel fake onboarding identity model.

### First Value Engine

After signup, identify role + organization/branch state + goal and guide the user to the first useful outcome using existing workflows. Examples:

- Doctor → create/open patient → clinical case → AI-assisted plan → appointment.
- Owner → create clinic/branch → invite staff → see operational/financial value.
- Diagnostic center → configure service → receive/process first referral → result → economics.
- Medical laboratory → configure analysis → process referral → result → settlement.
- Dental laboratory → receive order → process → delivered → economics recognition.

### Next Best Action

Provide one contextual next action based on role, permissions, current workspace, incomplete setup, workflow state, subscription/entitlement and recent activity. Do not show generic promotional CTAs when a real workflow action is available.

### AI as product operator

AI may explain, summarize, recommend, detect anomalies and prepare actions. For actions, enforce the canonical permission/risk/confirmation/audit lifecycle. AI must know the active user context without crossing tenant, branch, patient or audience boundaries.

### Self-selling product loop

Use product value, not aggressive advertising:

- Interactive demo uses real UI/components where possible.
- ROI/value explanations use transparent assumptions.
- Upsell appears when an actual entitlement or usage boundary is reached.
- Show what a higher plan unlocks and the expected operational value.
- Patient-facing treatment-plan sharing can create a privacy-safe referral/brand loop.
- Clinical workflows may recommend relevant Diagnostics, Dental Lab, Shop materials or Academy content from real case context.
- Referral rewards, if implemented, must use canonical billing/economics and be auditable.
- Never mix promotional content into clinical decision surfaces in a way that can influence care.

### Product analytics

Create one reusable growth/event vocabulary rather than scattered analytics calls. At minimum support events for signup, profile completion, organization/clinic creation, first patient/case/AI/treatment plan/appointment/diagnostic/lab/payment, staff invite, patient/treatment-plan share, trial/payment/subscription/upgrade, referral conversion, feature-limit reached, next-best-action shown/completed.

Events must be privacy-aware, tenant-aware, idempotent where needed and useful for funnel analysis.

### CEO Growth Dashboard

The management layer should eventually expose acquisition, activation, time-to-value, retention, conversion, expansion, referral, usage, partner economics and contribution margin using existing Finance/Analytics foundations. Do not duplicate financial truth in a growth table.

## Economics rules

Always use `docs/business/DENTVISION_PARTNER_ECONOMICS.md` as canonical policy.

Finance must distinguish GMV, gross platform revenue, processing costs, AI inference, storage/data, support/operations, refunds/chargebacks, tax/VAT, contribution margin and net platform revenue.

Pricing changes require version, effective date, migration/impact handling and auditability. Historical transactions must remain reproducible.

## Security and tenancy

Every role/workflow must be checked against:

`Person → active context → Organization/Branch → Role → Permission → Scope → Ownership → Resource state → Audit`

Release verification must cover tenant isolation, branch isolation, invitations, disabled users, revoked/expired sessions, partner role boundaries and privileged mutations. Fail closed.

## UX rules

DentVision should feel premium, clinical and purpose-built.

Avoid generic AI-template appearance, purple/blue gradients, neon/glow-heavy AI, excessive glassmorphism, giant decorative cards and decorative complexity that slows clinical work.

Prefer clear hierarchy, fast actions, meaningful empty/error/success states, keyboard accessibility, responsive layouts and contextual information. Every visible action must work or clearly explain why it is unavailable.

True natural 32-tooth interactive WebGL/3D odontogram remains a separate explicit engineering requirement; do not call the current SVG dental chart true 3D.

## Release gate

A feature is DONE only when implementation, domain behavior, authorization, UI, error/empty/success states, relevant tests, E2E evidence and documentation agree.

For every release:

1. Verify current `main`/target commit.
2. Run relevant unit/type/lint/build checks.
3. Run critical E2E and negative security matrix.
4. Verify partner/economics/ledger boundaries where affected.
5. Verify browser UX and runtime/network errors for affected workflows.
6. Verify mobile when mobile behavior is affected.
7. Record evidence and update current state.

Never use an old green run to declare a newer commit releasable.

## Execution priority

### P0 — Release correctness
- Diagnostics confirmation service/route contract.
- Auth session issuance must fail closed; never issue protected JWTs without an active session.
- Full CI/E2E/browser gates.
- IAM negative matrix.

### P1 — Economics and partner operations
- Accepted → paid → settled durable lifecycle.
- Medical-analysis economics/settlement.
- Dental-lab delivered recognition until real paid/settled callback exists.
- Ledger/reconciliation and Finance Hub transparency.
- Partner owner/branch/staff operational lifecycles, including the canonical branch lifecycle above.

### P2 — Clinical vertical slice
- Patient → Case → Diagnosis/Imaging → AI Findings → Plan → Appointment → Lab/Materials → Payment → Follow-up.
- Preserve real existing models and services.

### P3 — Product-led growth
- Central event layer.
- Role/goal onboarding.
- First Value Engine.
- Interactive Demo.
- Next Best Action.
- Contextual trial/upsell.
- Patient/treatment-plan sharing loop.
- Clinical-context Shop/Diagnostics/Dental Lab/Academy recommendations.
- CEO Growth Dashboard.

### P4 — Product-wide hardening
- Accessibility/responsive/performance/error states.
- Browser console/network audit.
- Security and audit.
- Android build/install/runtime verification.
- Real 3D odontogram.

## Anti-confusion rule

Do not create another roadmap, release gate, current-state snapshot or audit document unless it has a clearly different purpose. If a document becomes historical, mark it historical or remove it after checking repository references.

When the repository contains conflicting state, update `DENTVISION_CONTEXT.md` from verified evidence rather than creating another competing status file.
