# DentVision — Master Product & System Specification

**Status:** CANONICAL / ACTIVE  
**Version:** 4.0  
**Date:** 2026-09-16  
**Owner:** DentVision by Dr.Tamirlan

> This is the single normative Product/System source of truth. Product DNA remains the constitutional quality law. The Execution Plan controls sequencing. Context records verified state. Execution Log records evidence/history. Domain documents add bounded technical/legal/economic constraints and must not redefine product direction.

## 1. North Star

DentVision is a **Dental Operating System and ecosystem for the whole dental industry**, not a clinic CRM with extra modules.

It unifies professional work, patient access, business operations, diagnostics, laboratories, marketplace, education, jobs, community, analytics, finance and AI through one identity, one context model, shared domain state and a common AI/action layer.

**North Star:** understand the user's intent and present the next correct action instead of making the user learn the application.

### Ecosystem parity invariant

Clinics are one participant type. They are not the default center of the product.

The platform must treat supported participants as first-class according to the implemented identity, organization, workspace and permission model:

- patients / buyers;
- doctors and other professionals;
- clinic owners, administrators and managers;
- diagnostic centers and radiologists;
- medical-analysis laboratories;
- dental laboratories and technicians;
- suppliers, manufacturers and distributors;
- academies, lecturers and students;
- employers and job seekers;
- community participants;
- platform administrators and governed internal roles.

A UX decision is invalid if it makes a partner feel like a secondary extension of a clinic when the underlying domain gives that partner its own organization, workflow, economics, roles or workspace.

## 2. Product experience law

The underlying product may be large; the visible experience must remain understandable.

**Do not reduce product capability to reduce visual complexity. Use progressive disclosure.**

The experience should follow:

`Welcome / Discovery → Intent → Authentication only when required → Contextual Home/Workspace → Real workflow + AI assistance`

- Welcome answers **“What can I do here?”**
- Home / Command Center answers **“What should I do now?”**
- AI answers **“How can DentVision help me do it?”**
- A workspace exposes only the controls relevant to the current role, organization, entity and task.
- Advanced controls appear when needed.
- Global navigation never becomes a feature catalog.
- No user is forced to create or join a clinic merely to use unrelated DentVision capabilities.

The first screen must not dump CRM, diagnostics, laboratory, Shop, Academy, Jobs, Community, Analytics, Finance and every AI function onto the user at once.

## 3. Canonical architecture

One identity, one ecosystem, one AI command layer, one trust boundary and one source of truth.

`User → Identity → active context → Workspace → Role/Permissions → Data → Domain Event → AI Context → Action → Verification → Audit`

A user may safely hold multiple roles and multiple organization/workspace memberships. Active context is explicit and switchable only within authorized scope.

### Clinical graph

`Patient → Visit → Diagnosis → Imaging → AI Findings → Treatment Plan → Appointments → Procedures → Lab → Materials → Documents → Payments → Communication → Follow-up → Outcome`

The Clinical/Treatment Case is the central longitudinal clinical object, but it is **not** the center of every DentVision experience. Non-clinical participants have their own first-class workflows while remaining connected to authorized clinical context where appropriate.

### Cross-ecosystem graph

`Professional / Organization ↔ Network ↔ Clinic ↔ Diagnostics ↔ Laboratory ↔ Shop/Suppliers ↔ Academy ↔ Jobs ↔ Finance ↔ AI`

Shared context must travel across these boundaries without leaking unauthorized data.

## 4. Trust and authorization contract

Protected flow:

`authenticate → current consent where required → active organization/workspace → RBAC → tenant/object authorization → business authorization → action → audit`

No client-supplied organization, clinic, patient, branch or resource ID is authorization proof.

Reuse existing consent and authorization primitives rather than creating parallel checks.

Authorization outcomes:

`ALLOW | DENY | CONSENT_REQUIRED | ROLE_REQUIRED | ORGANIZATION_REQUIRED | CLINIC_REQUIRED | PATIENT_ACCESS_REQUIRED`

AI never bypasses consent, RBAC, tenant isolation, branch isolation or audit. Clinical and irreversible financial actions require the prescribed human confirmation policy.

## 5. AI Operating Layer

AI is a platform capability, not a decorative chatbot and not a replacement for dedicated UIs.

Canonical AI architecture:

`AI Router → Role/Workspace Context → Permission Engine → Tool Registry → Model/Reasoning → Action Validator → Preview → Confirmation when required → Execute → Verify → Audit`

AI may:

- understand intent;
- search and navigate;
- summarize authorized data;
- detect relevant events/anomalies;
- recommend next actions;
- draft documents/messages/plans;
- execute authorized actions;
- connect related ecosystem services.

Examples:

- “Найди курс по микроскопной эндодонтии” → Academy.
- “Найди микроскоп до 2 млн” → Shop.
- “Найди зуботехническую лабораторию в Астане” → Network/Laboratory.
- “Покажи мои записи завтра” → Practice.
- “Покажи задолженность организации” → Finance.
- “Найди работу ортодонта” → Jobs.
- “Проанализируй этот CBCT” → Diagnostics / clinical AI, subject to authorization and clinical confirmation rules.

If AI cannot act, it explains the boundary and offers the next safe path. Manual workflows remain available when AI is unavailable.

## 6. Public Welcome and first entry

Authentication is not the first screen for a new user.

### Anonymous

`/` → public DentVision Welcome.

Welcome must communicate the ecosystem without becoming a catalog. Primary labels describe user outcomes rather than internal module names.

Public intent examples:

- Записаться к врачу
- Найти диагностику
- Учиться
- Купить
- Найти работу
- Найти специалиста / организацию
- Спросить DentVision AI

Professional/business discovery must visibly include more than clinics. Where a partner workflow is actually available, users must be able to discover diagnostics, laboratories, suppliers, academies and other supported organizations.

### Authenticated

After intent/context selection, the user enters the appropriate contextual Home/Workspace. Do not blindly force every authenticated user into a clinic dashboard.

Deep links must preserve the requested public route and request authentication only when the action requires it.

## 7. Global UX and information architecture

There is one global navigation system. It must expose the ecosystem without forcing every user to understand its entire architecture.

Conceptual global services:

- Home / Today
- AI
- Work / Practice when relevant
- Diagnostics
- Laboratory
- Shop / Market
- Academy
- Network
- Jobs
- Community
- Finance / Analytics when relevant
- Profile / Settings
- Administration according to role

The exact visible set is role/context-aware and must be derived from real routes and permissions. Do not invent destinations merely because a blueprint names them.

### Navigation rules

1. No duplicate destinations.
2. No permanent nested sidebar that repeats global navigation.
3. Module navigation belongs in contextual tabs, filters, page actions or sheets.
4. Sidebar collapsed/pinned state may persist; no automatic decorative expansion on entry.
5. Desktop and mobile use intentionally different shell mechanics.
6. Search/command is a consistent global entry point.
7. Active organization/branch/workspace is always understandable.
8. Useful AI context must survive navigation unless the user intentionally starts a new context.
9. Visible actions must work or clearly explain why unavailable.
10. Empty/loading/error/success states are real product states, not placeholders.

## 8. Contextual Home / Command Center

Home is an orientation and action surface, not a wall of dashboards.

It should answer:

1. What matters now?
2. What can DentVision do automatically?
3. What is my next useful action?

Show a small number of high-value items based on role, context, workflow state, recent activity and permissions.

Examples:

### Doctor
Today → schedule → priority patient/case → results/labs → AI recommendations.

### Clinic owner
Business status → exceptions → branches → team → finance → operational actions.

### Diagnostic center
Incoming studies → queue → deadlines → results → partner/economics status.

### Medical laboratory
Incoming analyses → production → result delivery → settlement status.

### Dental laboratory
Orders → production queue → deadlines → QC/remakes → delivery → economics.

### Supplier
Orders → inventory → catalog → customers → fulfillment → finance.

### Academy / lecturer
Courses → students → content → assessments → certificates → revenue.

### Student
Continue learning → progress → cases → assessment → certificate → professional profile.

### Job seeker
Matches → applications → communication → profile/credentials.

The interface must never require all of these users to see clinic KPIs.

## 9. First Value and product-led adoption

Canonical funnel:

`Visitor → Interactive Demo/Discovery → Signup → Role/Goal → First Value → Trial → Payment → Upgrade → Expansion → Referral`

Target first meaningful value: under 10 minutes for a new professional user without requiring a training session.

The First Value Engine uses real role, organization, workspace, permissions and goal state.

Examples:

- Doctor → patient/case → AI-assisted plan → appointment.
- Clinic owner → organization/branch → team → operational/financial value.
- Diagnostic center → service → first referral → result → economics.
- Medical laboratory → analysis → referral → result → settlement.
- Dental laboratory → order → production → delivered → economics recognition.
- Supplier → product/catalog → first legitimate order → fulfillment.
- Lecturer/Academy → course → enrollment → learning → certificate/revenue.
- Student → course/case → first completed learning action.
- Job seeker → professional profile → relevant vacancy → application.

Next Best Action must prefer a real workflow action over generic promotional CTAs.

## 10. First-class partner workspaces

Partner organizations are not subordinate clinic screens.

### Diagnostic center

`Public profile → services → availability → referral/order → study → result → authorized delivery → economics`

Workspace capabilities, according to actual implementation:

- incoming referrals;
- study queue;
- radiology workflow;
- files/results;
- deadlines;
- staff/branch management;
- pricing/service configuration;
- finance/economics;
- AI assistance;
- audit.

### Medical laboratory

`Public/partner discovery → analysis service → referral → acceptance → processing → result → delivery → settlement`

### Dental laboratory

`Clinic/doctor order → specification/files → acceptance → production → QC → ready → delivery → remake/delay handling → economics`

The lab receives only the patient/case information necessary for authorized work. The existence of a Lab Order is not permission to expose unrelated medical, financial or clinic information.

### Supplier / marketplace partner

`Organization → verification → catalog → product/offers → inventory → order → fulfillment → payout → analytics`

Partner economics, commission, payout and historical calculations use the canonical economics policy.

### Academy / lecturer

`Identity → academy/lecturer context → course → enrollment → learning → assessment → certificate → professional network`

### Jobs / professional network

`Professional profile → discovery/match → application/contact → hiring outcome`

## 11. Clinical workflows

Clinical users receive deep clinical tooling only when their role/context requires it.

### Patient 360

Profile, appointments, visits, treatment plans, clinical documents, diagnostics, laboratory, invoices and authorized communication remain connected to the patient identity and tenant/object permissions.

### Treatment Case

`Case → diagnosis → imaging → findings → plan → procedures → lab/materials → documentation → payment → follow-up`

### Diagnostics

`Discovery → center → study → availability → order → payment/confirmation → performed → result → authorized AI summary → doctor confirmation → patient record`

AI diagnostic output is assistive until the required professional confirmation step is completed.

### Laboratory

Canonical status vocabulary:

`DRAFT → SUBMITTED → ACCEPTED → IN_PRODUCTION → QC → READY → DELIVERED | CANCELLED`

Use the existing Lab Order domain. Do not create a second laboratory order model.

### Booking

`Welcome → find provider → clinic/service → date/time → authentication when required → consent → booking request → clinic confirmation → notification → appointment → visit`

Use the existing public booking, Booking model and appointment service. Do not create a parallel booking system.

## 12. Business, branches and Finance

Organizations can contain multiple operational branches using the existing Organization/Workspace model.

Canonical branch management:

`Owner → Settings / Organization → Branches`

Branch lifecycle:

`Create → Persist → Edit → Assign staff → Switch → Operate → Archive/Deactivate`

Branch-aware resources include, where supported by the domain:

- patients;
- appointments;
- inventory;
- invoices;
- expenses;
- referrals/diagnostics.

Cross-branch access is denied unless the actor has an authorized organization-wide scope.

Finance is ecosystem-wide and must distinguish:

`GMV → platform revenue → processing → AI inference → storage/data → support/operations → refunds/chargebacks → tax/VAT → contribution margin → net platform revenue`

All pricing/commission rules come only from `docs/business/DENTVISION_PARTNER_ECONOMICS.md`. Historical calculations remain reproducible.

## 13. Design system and visual direction

DentVision must feel premium, clinical, calm and purpose-built.

Required:

- strong typography hierarchy;
- clinical-neutral surfaces;
- restrained gold accent;
- consistent light/dark themes;
- deliberate spacing and density;
- restrained borders/radii/shadows;
- excellent desktop density for professional workflows;
- touch-safe mobile interaction;
- coherent charts and data visualization;
- accessible contrast/focus/hit targets;
- motion only when it clarifies state or hierarchy.

Prohibited:

- generic AI-incubator styling;
- purple/blue gradient-heavy SaaS appearance;
- neon/glow-heavy AI;
- excessive glassmorphism;
- giant decorative cards;
- decorative navigation theatre;
- emoji as primary product icons;
- inconsistent service-specific visual identities.

The design system is one system across Welcome, Home, AI, Practice, Diagnostics, Laboratory, Shop, Academy, Network, Jobs, Community, Finance and administration.

## 14. Product quality law

Every new feature must:

1. identify its primary user and job-to-be-done;
2. map to the existing ecosystem/object graph;
3. reuse existing domain truth;
4. work through the authorization model;
5. define AI assistance where appropriate;
6. define manual fallback where appropriate;
7. implement loading/empty/error/success states;
8. define confirmation rules for consequential mutations;
9. be reachable without unnecessary menu hunting;
10. have executable acceptance criteria.

A beautiful disconnected screen is incomplete.

## 15. P0/P1 execution priority

### P0 — release correctness

- Consent and authorization.
- Tenant and branch isolation.
- Auth/session fail-closed behavior.
- Diagnostics confirmation contract.
- Critical CI/E2E/browser gates.
- Negative IAM matrix.

### P1 — partner operations and economics

- Partner owner onboarding.
- Organization/branch/staff lifecycle.
- Diagnostic center operations.
- Medical laboratory operations.
- Dental laboratory operations.
- Supplier/marketplace operations.
- Accepted → paid → settled lifecycle.
- Ledger/reconciliation.
- Finance Hub transparency.

### P2 — clinical vertical slice

Complete and verify:

`Patient → Case → Diagnosis/Imaging → AI Findings → Plan → Appointment → Lab/Materials → Payment → Follow-up`

### P3 — self-selling product

- Role/goal onboarding.
- First Value Engine.
- Interactive discovery/demo.
- Next Best Action.
- Contextual trial/upsell.
- Transparent ROI/value explanation.
- Patient/treatment-plan sharing loop with privacy safeguards.
- Cross-module recommendations.
- Growth analytics using existing Finance/Analytics truth.

### P4 — product-wide UX hardening

- Full route/IA verification from actual code.
- Design-system convergence.
- Responsive/accessibility/performance.
- Browser console/network/runtime audit.
- Android parity/build/runtime.
- Real 32-tooth WebGL/3D odontogram.

## 16. Documentation and implementation control

Source-of-truth hierarchy:

1. Current repository code + current CI/runtime evidence.
2. Product DNA for constitutional quality rules.
3. This Master Spec for product/system intent.
4. Execution Plan for sequencing and Definition of Done.
5. Context for verified current state.
6. Execution Log for durable evidence/history.
7. Canonical economics for pricing/commission/settlement.
8. Specialized domain documents for bounded technical/legal/security constraints.
9. Generated system inventories for facts derived from code.

Historical or superseded planning documents must not compete with this specification. Keep a document only when it provides unique evidence or a bounded technical contract. Otherwise remove it after checking repository references.

Generated files such as `docs/SYSTEM_MAP.md` are facts from the code generator and must be regenerated rather than manually edited.

## 17. Definition of Done

A product workflow is DONE only when:

- implementation is real;
- backend/domain source of truth is connected;
- authorization is enforced;
- the correct participant(s) can see the resulting state;
- mutations persist across refresh/re-login;
- loading/empty/error/success states work;
- AI assistance works where specified;
- manual fallback works where required;
- consequential actions follow confirmation policy;
- desktop/mobile behavior is intentionally designed;
- relevant E2E/security tests pass;
- browser runtime/network errors are addressed;
- documentation and execution evidence are updated.

Do not mark a route, model, page, mock, or isolated test as proof that a workflow is complete.

## 18. Operating loop

`Inspect → implement → test → fix → verify → document → continue`

Do not repeat broad audits when a targeted implementation can resolve the blocker. Do not weaken tests to obtain green status. Do not create parallel architectures to compensate for incomplete existing workflows.
