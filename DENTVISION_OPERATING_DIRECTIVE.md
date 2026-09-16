# DentVision — Operating Directive

> Persistent execution contract for AI/engineering work on DentVision. This document stores the directive agreed during development so it survives chat/session changes.

## Mission

Build DentVision as one coherent Dental Operating System and ecosystem that is easier to operate, easier to adopt, easier to understand and able to demonstrate and sell its own value through the product itself.

Do not build a collection of disconnected modules. Reuse the existing CRM/Clinical Case, Diagnostics, Medical Laboratory, Dental Laboratory, Shop, Academy, Finance Hub, AI, Network, IAM and notification foundations and connect them through shared domain context.

Clinics are one first-class participant type, not the default center of the platform. Partner organizations and other supported participants must receive equivalent product consideration when their domain provides a distinct workspace, workflow, economics or role model.

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
5. `docs/00_CONSTITUTION/02_PRODUCT_DNA.md` — constitutional product/design quality law.
6. `docs/DENTVISION_MASTER_SPEC.md` — single normative Product/System source of truth.
7. `DENTVISION_SUPERAPP_BLUEPRINT.md` — retained reference blueprint; it must not compete with the Master Spec.
8. `docs/business/DENTVISION_PARTNER_ECONOMICS.md` — sole canonical economics policy.

Historical audits and stale state snapshots are not release evidence.

## Product model

Central clinical object: **Clinical/Treatment Case**.

`Patient → Diagnosis → Imaging → AI Findings → Treatment Plan → Appointments → Procedures → Lab → Materials → Documents → Payments → Communication → Follow-up → Outcome`

The overall product is broader than the clinical graph. Professional, partner, commerce, education, network and business contexts remain first-class and connect through authorized shared context.

AI action lifecycle:

`Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit`

## Product-led operating model

The product should continuously answer four questions for the current user:

1. What should I do now?
2. Why does it matter?
3. What can DentVision do for me automatically?
4. What is the next useful action?

### Activation funnel

`Visitor → Interactive Demo/Discovery → Signup → Role/Goal → First Value → Trial → Payment → Upgrade → Expansion → Referral`

Target: first meaningful value in under 10 minutes for a new professional user, without requiring a training session.

### Role-first onboarding

Support the real role matrix already defined in the repository, including clinic roles and partner roles for diagnostic centers, medical laboratories, dental laboratories, suppliers, academies and platform governance.

Onboarding must use real organization/branch/IAM state and must never create a parallel fake onboarding identity model.

### First Value Engine

After signup, identify role + organization/workspace/branch state + goal and guide the user to the first useful outcome using existing workflows.

Examples include:

- Doctor → patient/case → AI-assisted plan → appointment.
- Clinic owner → organization/branch → staff → operational/financial value.
- Diagnostic center → service → first referral → result → economics.
- Medical laboratory → analysis → referral → result → settlement.
- Dental laboratory → order → production → delivered → economics recognition.
- Supplier → catalog → legitimate order → fulfillment.
- Academy/lecturer → course → enrollment → learning/certificate/revenue.
- Student → course/case → first completed learning action.
- Job seeker → profile → relevant vacancy → application.

### Progressive disclosure

The platform may contain many modules, but the first screen must not expose the entire architecture at once. Show a small, role/context-aware set of meaningful actions and reveal deeper controls only when needed.

Do not remove a real capability merely because it makes the underlying product complex.

### Next Best Action

Provide one contextual next action based on role, permissions, current workspace, incomplete setup, workflow state, subscription/entitlement and recent activity. Do not show generic promotional CTAs when a real workflow action is available.

### AI as product operator

AI may explain, summarize, recommend, detect anomalies and prepare actions. For actions, enforce the canonical permission/risk/confirmation/audit lifecycle. AI must know the active user context without crossing tenant, branch, patient or audience boundaries.

### Self-selling product loop

Use product value, not aggressive advertising:

- Interactive discovery/demo uses real UI/components where possible.
- ROI/value explanations use transparent assumptions.
- Upsell appears when an actual entitlement or usage boundary is reached.
- Show what a higher plan unlocks and the operational value.
- Patient-facing treatment-plan sharing may create a privacy-safe referral/brand loop.
- Clinical workflows may recommend relevant Diagnostics, Dental Lab, Shop materials or Academy content from real case context.
- Never mix promotional content into clinical decision surfaces in a way that can influence care.

## Partner parity

Partner organizations are product participants, not back-office extensions of clinics.

At minimum, design and execution must preserve first-class workflows for:

- diagnostic centers and radiologists;
- medical-analysis laboratories;
- dental laboratories and technicians;
- suppliers/manufacturers/distributors;
- academies and lecturers;
- employers and job seekers;
- other organization types actually supported by the repository.

Each partner workspace uses the same Identity, IAM, audit, AI, events, design system and Finance foundations while exposing only its own authorized operational context.

## Product analytics

Create one reusable growth/event vocabulary rather than scattered analytics calls. Events must be privacy-aware, tenant-aware and idempotent where needed. Do not duplicate financial truth in growth tables.

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

Avoid generic AI-template appearance, purple/blue gradients, neon/glow-heavy AI, excessive glassmorphism, giant decorative cards and decorative complexity that slows professional work.

Prefer clear hierarchy, fast actions, meaningful empty/error/success states, keyboard accessibility, responsive layouts and contextual information.

The UI must use progressive disclosure: do not force users to understand the full ecosystem before they can perform their current task.

Every visible action must work or clearly explain why it is unavailable.

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
- Partner owner/branch/staff operational lifecycles.

### P2 — Clinical vertical slice
- Patient → Case → Diagnosis/Imaging → AI Findings → Plan → Appointment → Lab/Materials → Payment → Follow-up.
- Preserve real existing models and services.

### P3 — Product-led growth
- Central event layer.
- Role/goal onboarding.
- First Value Engine.
- Interactive Demo/Discovery.
- Next Best Action.
- Contextual trial/upsell.
- Patient/treatment-plan sharing loop.
- Clinical-context Shop/Diagnostics/Dental Lab/Academy recommendations.
- Growth dashboard using existing Analytics/Finance truth.

### P4 — Product-wide hardening
- Accessibility/responsive/performance/error states.
- Browser console/network audit.
- Security and audit.
- Android build/install/runtime verification.
- Real 3D odontogram.

## Anti-confusion rule

Do not create another roadmap, product specification, release gate, current-state snapshot or audit document unless it has a clearly different bounded purpose.

The Master Spec is the sole normative Product/System source. Product DNA is the constitutional quality law. Specialized documents are retained only for bounded technical/legal/security/economic requirements or durable evidence.

If a document becomes historical or redundant, mark/remove it after checking repository references. When sources conflict, resolve the contradiction in the canonical layer rather than creating another competing document.
