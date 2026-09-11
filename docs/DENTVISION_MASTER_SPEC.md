# DentVision — Master Product & System Specification

**Status:** CANONICAL / ACTIVE  
**Version:** 2.0  
**Date:** 2026-09-11  
**Owner:** DentVision by Dr.Tamirlan

> This is the single normative source of truth for DentVision product/system intent **and execution direction**. Older product documents may be retained temporarily only for migration, but they do not override this document.

## 1. Product identity

DentVision is a **Dental Super App / ecosystem**: one product unifying clinical operations, AI, education, marketplace, diagnostics, laboratory workflows, professional community, jobs, finance and supporting services.

DentVision is not merely a CRM. CRM is a core clinical/business surface inside the wider ecosystem.

### North Star

**DentVision should not make users learn an application. DentVision should understand the user's intent and present the next correct action.**

The product must feel like one coherent ecosystem rather than a collection of independent modules.

---

## 2. Core model

DentVision follows:

1. **One identity** — one account may participate in multiple product surfaces and organizations according to permissions.
2. **One ecosystem** — Clinic/CRM, AI, Shop, Academy, Community, Jobs, Diagnostics, Laboratory and Finance share identity, navigation principles and platform infrastructure.
3. **One AI command layer** — AI is available throughout the product and uses only authorized context.
4. **One trust boundary** — authentication, RBAC, tenant isolation, auditability and secure defaults apply to every protected function.
5. **One source of truth** — UI layers may present different views, but they must not create shadow patients, appointments, inventory records, clinic identities or other competing canonical records.

---

## 3. Entry, Welcome and navigation

### 3.1 Welcome / first entry

The current product flow intentionally includes a **Welcome screen and service cards**. They are the ecosystem discovery/entry layer and remain part of the product.

Canonical flow:

`Public Welcome → intent/discovery → auth/registration when required → selected surface → AI Workspace when applicable`

The Welcome experience must be functional, understandable, fast and skippable. Animation must never block the product.

### 3.2 Welcome vs Home

**Welcome** answers: “What can I do here?”  
**Home / Command Center** answers: “What should I do now?”

Welcome is public and intent-first. Home is authenticated, contextual and role-aware.

Home exposes a small set of service cards. Cards are entry points, not a duplicate navigation menu.

### 3.3 AI Workspace

For authenticated operational users, **AI Workspace is the central working interface**. It combines conversation/command, authorized context, actions, suggested next steps, navigation and proactive event-driven assistance.

AI Workspace does not replace service cards or public discovery; it becomes the primary operational layer after entry.

### 3.4 Navigation rules

- One primary action per region.
- No duplicate canonical destinations.
- A user always understands current location, active organization and consequence of an action.
- Service cards may point to canonical destinations but must not create a second workflow.
- Mobile navigation uses progressive disclosure and keeps active context visible.
- Desktop and mobile use intentionally different shell mechanics where that improves usability.
- No permanent nested sidebar inside a major module.
- Contextual module navigation belongs in tabs, segmented controls, sheets or page-level actions.
- Route changes must not unnecessarily destroy useful AI context.
- The sidebar must not automatically expand merely because the application opened.
- A collapsed/pinned navigation preference should persist where supported.

### 3.5 Public discovery boundary

A new user must be able to discover legitimate ecosystem services before being forced into a private organization/clinic account.

Public discovery may include providers, clinics, diagnostics, services and marketplace information intentionally marked public. Personal medical, financial and protected organization data remains behind the appropriate authorization boundary.

---

## 4. Users and RBAC

DentVision uses **one unified RBAC model** combining primary personas and specialized roles.

Primary personas:

- Doctor / Врач
- Owner / Владелец
- Administrator / Администратор
- Buyer / Покупатель

Specialized roles may include Assistant, Cashier/Finance, Laboratory Staff, Diagnostic Center Staff, Manager, Student, Superadmin, Seller and Lecturer.

A persona is not permission. Capabilities come from RBAC + organization membership. A user may have different roles in different organizations.

---

## 5. Organizations and tenant model

DentVision supports **multiple organizations per identity**.

- There is an explicit active organization/tenant context.
- Switching organizations requires authorization.
- Protected requests derive/validate tenant scope server-side.
- Client-supplied `clinicId`/organization ID is never trusted as authorization.
- Organization membership is checked server-side.
- Object IDs are never authorization.
- Cross-tenant access must fail even with a valid foreign object ID.

Supported organization types include dental clinic, diagnostic center, dental laboratory, academy/school, marketplace partner/seller and future approved ecosystem organizations.

---

## 6. Medical-data boundary

Medical records are tenant-scoped. Approved global/shared-reference data such as standardized codes/catalogs may be shared.

Protected medical graph:

`Patient → Visit → Diagnosis → Treatment Plan → Procedure/Treatment → Lab Order → Diagnostic Referral → Files/Results → AI Context`

Every hop must enforce authorization and tenant ownership. Replacing any ID in a URL, query, body or nested object must not expose or mutate another tenant's data.

---

## 7. AI policy

AI is an operating layer, not decorative chat.

AI may understand authorized context, summarize, draft documentation, recommend actions, detect events, notify relevant users, assist diagnostics/treatment planning and connect users to ecosystem services.

### 7.1 AI Employee contract

The AI Employee is considered real only when it can:

1. provide a proactive role-aware greeting;
2. generate a useful daily briefing from real authorized data;
3. detect important events;
4. explain recommendations and why they matter;
5. present a small number of high-value suggested actions;
6. navigate or execute real platform actions through tools;
7. request confirmation before protected clinical/financial mutations;
8. preserve useful context and memory under RBAC;
9. fall back gracefully to manual workflows when AI is unavailable.

A chat box alone is not the AI Employee.

### 7.2 Risk-based autonomy

- Low-risk operational actions may be automated when explicitly allowed.
- Medium-risk actions require confirmation when policy/permissions demand it.
- Clinically meaningful or irreversible actions require appropriate human confirmation unless a separately approved policy explicitly authorizes otherwise.

AI never bypasses RBAC, tenant isolation, audit requirements or clinical responsibility.

AI output about patients, finance, inventory, appointments or diagnostics must be traceable to authorized platform data. If data is unavailable, the UI must state that instead of fabricating metrics, events or clinical facts.

Proactive events must be deduplicated and non-spammy.

---

## 8. Core ecosystem surfaces

### Clinic / CRM

P0 clinical/business surface: patients, appointments, medical records, visits, odontogram, diagnosis, treatment plans, documents, diagnostics, laboratory workflows, inventory, finance, reminders, communication and analytics as implementation maturity permits.

CRM must behave as a practice operating system, not disconnected CRUD pages.

### Diagnostics

Clinics can order authorized studies from diagnostic centers. Results return to authorized clinical workflows. AI may summarize/interpret inputs, but clinically meaningful conclusions require appropriate professional review.

**Target discovery/order journey:**

`Find diagnostics → location → study type → center → price/availability → order → confirmation → status → result → authorized doctor/patient delivery`

Diagnostics must be discoverable by a new user without requiring clinic membership merely to browse or initiate a legitimate public request.

### Laboratory

Laboratory is a **first-class organization type and ecosystem participant**.

Canonical flow:

`Clinic/Doctor → Lab Order → Laboratory → Production/Status → Result/Delivery → Clinical Record`

Laboratory has its own operational workspace while patient/clinic access remains explicitly permissioned and tenant-scoped.

### Shop / Marketplace

Marketplace is an ecosystem surface, not a detached storefront. Products/services may connect to authorized clinical context. AI recommendations must be transparent and never replace professional judgment.

**Target procurement journey:**

`Need → search → compare → verify stock/price → checkout → order tracking → reorder`

### Academy / School

Learning, practice, certification and professional development, sharing identity/infrastructure with the ecosystem without becoming a clinical-record surface.

### Community

Professional social surface, distinct from clinical records and clinic operations.

### Jobs

Professional marketplace surface, distinct from internal clinic staffing workflows.

### Finance

Operational clinic and ecosystem/business finance according to role and organization permissions. Sensitive financial data remains tenant-scoped.

---

## 9. Role-based daily loops

These loops define what “coherent product” means for major users.

### Doctor

`AI briefing → today's schedule → risks → lab/results → priority patient → chart → odontogram → diagnosis/draft plan → treatment plan → documentation → next appointment/lab/patient communication`

Success: the doctor can complete the clinical morning and visit loop without menu hunting.

### Owner

`AI briefing → revenue/utilization/debts → exceptions → staffing → inventory → recommended actions → approval`

Success: the owner sees what requires attention instead of opening reports one by one.

### Admin

`AI briefing → bookings → confirmations → cancellations → waiting list → payments → documents → follow-up`

Success: routine reception work can be handled in batches and from AI.

### Patient

`Welcome → find doctor/clinic → compare → choose service/slot → register when needed → book → reminders → results/history`

Success: no clinic account is required merely to discover care.

### Buyer

`Need → search → compare suppliers → verify stock/price → checkout → order tracking → reorder`

Success: procurement feels like one marketplace connected to clinic inventory.

### Diagnostic center

`Public profile → services → availability → incoming orders → study status → result upload → authorized delivery`

Success: a diagnostic center can receive legitimate public/provider orders without being forced into a clinic-only workflow.

### Laboratory

`Orders → specifications/files → production status → deadline → delivery → remake analytics`

Success: lab work remains connected to the authorized patient case and clinic workflow.

### Student / Lecturer

`Discover → course/case → enrollment → learning → assessment → certificate → professional profile`

Success: learning feeds professional identity and network.

### Recruiter / Job seeker

`Profile → search → match → apply → communication → hiring outcome`

Success: jobs connect to credentials and professional identity.

---

## 10. P0 execution program

These are completion contracts, not suggestions. Work should close real user journeys instead of producing isolated screens.

### P0-A — Shell and desktop

- sidebar never auto-opens on entry;
- collapsed/pinned preference persists where supported;
- desktop shell has correct content offsets and max-widths;
- no shell-caused horizontal overflow;
- no nested permanent sidebars;
- keyboard navigation and focus states work;
- mobile and desktop shell mechanics are intentionally designed;
- empty/loading/error/success states are coherent.

### P0-B — Welcome → Home

- public Welcome remains intent-first;
- service discovery works without unnecessary auth;
- authenticated user reaches Home / Command Center;
- Home is role-aware;
- service cards are useful without duplicating sidebar navigation;
- AI briefing is visible from Home;
- no fake dashboard metrics.

### P0-C — Patient acquisition and booking

- public doctor/clinic discovery exists;
- search/filter is backed by real data;
- doctor/clinic profile is usable;
- services are selectable;
- availability is real, not decorative;
- authentication occurs at the correct privacy/action boundary;
- appointment creation persists to the canonical appointment model;
- duplicate booking is prevented;
- confirmation is visible;
- booking appears to patient and clinic according to permissions;
- reminders/status changes have a defined path.

### P0-D — Diagnostics discovery and order

- public diagnostics discovery exists;
- center profiles/services are real;
- location/search filters work;
- order/request persists to canonical data;
- status lifecycle is visible;
- result delivery respects patient/doctor permissions;
- AI can summarize an authorized result without replacing professional review.

### P0-E — AI Employee

- role-aware greeting;
- daily briefing from real sources;
- “I noticed” / “I recommend” actions;
- action controls execute or navigate to real destinations;
- protected actions require confirmation;
- tool results are visible;
- conversation/context survives reload where intended;
- degraded/manual mode works;
- no fabricated metrics/events;
- proactive events are deduplicated and non-spammy.

### P0-F — Design quality

- one visual language across Welcome, Home, AI and modules;
- typography and spacing are consistent;
- premium dark/light surfaces are deliberate, not generic;
- primary action is obvious within two seconds;
- cards provide hierarchy rather than decoration;
- dense clinical tables remain scannable;
- hover/focus/pressed/disabled/loading/error states exist;
- critical flows meet accessibility basics.

---

## 11. Definition of done — workflow, not screen

A workflow is **DONE** only when all are true:

1. A new user can discover the entry point.
2. The happy path reaches a real backend/source of truth.
3. The action persists and is visible to the correct participants.
4. Authentication occurs only where necessary.
5. Permissions and tenant isolation are enforced.
6. Empty/loading/error/success states are implemented.
7. AI can assist the workflow where appropriate.
8. Manual fallback works when AI is unavailable.
9. Clinical/financial mutations use the required confirmation policy.
10. Desktop and mobile behavior are intentionally designed.
11. The workflow has acceptance tests or an executable verification path.
12. The experience does not require instructions to understand the next step.

A visually complete page with a fake, decorative or disconnected action is **INCOMPLETE**.

---

## 12. Architecture guardrails

### Single source of truth

One patient, one appointment, one inventory record, one clinic identity. UI layers may present different views but MUST NOT create shadow records.

### Public vs private boundary

Public discovery may expose only intentionally public provider/service information. Personal medical, financial and booking mutation data requires the appropriate authenticated context.

### Multi-role identity

A user may hold multiple capabilities. Do not force a permanent one-role identity when the underlying account can safely support multiple roles/scopes.

### Data provenance

AI claims about patients, finance, inventory, appointments or diagnostics must be traceable to authorized data. Unavailable data must be represented as unavailable.

### No navigation duplication

If a destination already exists in global navigation, do not create another permanent navigation rail for the same destination.

### Real workflow over mock completion

A button that only navigates to login, displays a toast, opens a placeholder modal or relies on mock data is not a completed workflow when the product contract promises a real action.

---

## 13. Security and privacy

Security is a product requirement.

Mandatory:

- authentication before protected operations;
- server-side RBAC;
- tenant isolation;
- object-level authorization;
- least privilege;
- auditability of sensitive actions;
- safe file access;
- no trust in client tenant identifiers;
- IDOR resistance across nested resources;
- secure defaults;
- privacy-by-design for medical data.

A release is not acceptable if changing an ID can expose or mutate another organization's data.

---

## 14. Architecture intent

Implementation may evolve, but the platform direction is:

- React/TypeScript frontend where applicable;
- Node/Express/TypeScript backend where applicable;
- PostgreSQL/Prisma data layer where applicable;
- authenticated APIs with server-side authorization;
- shared identity and organization context;
- event-driven AI capabilities;
- modular product surfaces over common platform primitives.

Technical architecture documents describe implementation. They cannot redefine product intent.

---

## 15. Release gate

Every release candidate must satisfy:

1. Authentication/session integrity.
2. Server + UI RBAC enforcement.
3. Tenant isolation and IDOR resistance.
4. Critical medical workflows.
5. Critical public discovery/service-entry flows.
6. Clear navigation and no duplicate canonical destinations.
7. Mobile/responsive usability.
8. No critical build/runtime errors.
9. Auditability of sensitive actions.
10. Regression tests for fixed security/UX defects.
11. No fake production metrics or disconnected promised actions.

CI/checklist files may implement this gate; this document defines it.

---

## 16. Product quality metrics

Optimize outcomes, not screen count.

### Activation

- time to first meaningful action;
- time to first successful booking;
- time to first successful clinic action;
- time to first useful AI response.

### Workflow efficiency

- steps/clicks for common jobs;
- time to complete booking;
- time to open patient context;
- time to confirm daily appointments;
- time to reorder a known product.

### AI Employee

- percentage of greetings backed by complete real data;
- recommendation acceptance rate;
- successful tool-action rate;
- proactive-noise/false-positive rate;
- percentage of morning loop completed through AI.

### Reliability

- error rate by critical flow;
- failed mutations;
- duplicate bookings;
- tenant-isolation incidents;
- degraded-mode recovery.

These metrics must never be improved by hiding failures or fabricating activity.

---

## 17. Competitive reference rule

Use competitors as **principle references**, not visual copies.

- ChatGPT → conversation, memory, tool use, streaming
- Linear → speed, focus, keyboard fluency, restrained motion
- Apple → hierarchy, accessibility, restraint
- Stripe → trust, progressive disclosure, precise workflows
- Kaspi → ecosystem coherence and low-friction commerce
- Doctolib / Zocdoc-class booking → public discovery before forced clinic membership
- Dental practice systems such as Dentrix/Dentally/Curve → deep dental operational context
- Figma → component/variant discipline and design-to-code consistency
- Shopify-class commerce → catalog, checkout and order-state clarity
- modern education platforms → learning continuity and credential identity

DentVision must adapt these principles to dental workflows, privacy, clinical safety and the AI ecosystem model.

---

## 18. Execution order

Do not build in random feature order.

```text
1. Shell + desktop correctness
        ↓
2. Welcome → Home / Command Center
        ↓
3. Patient discovery → booking
        ↓
4. Diagnostics discovery → order → result
        ↓
5. AI Employee briefing + proactive actions
        ↓
6. Doctor / Owner / Admin daily loops
        ↓
7. Clinic ↔ Lab ↔ Inventory connected workflows
        ↓
8. Marketplace / Academy / Jobs / Community depth
        ↓
9. Analytics + automation density
        ↓
10. Imaging / hardware readiness
```

Parallel implementation is allowed when it does not create competing sources of truth or conflicting UX patterns. Security, tenant isolation and critical reliability defects remain P0 regardless of feature order.

---

## 19. Evidence-based implementation register

Known gaps from historical repository audits are treated as a **verification queue**, not a mandate for another endless audit. Resolve an item when it blocks a real user journey, reliability, security or release quality.

Typical categories to verify against current code/runtime include:

- AI Workspace behavior, persistence and actions;
- shell/layout correctness;
- design-system primitives required by real workflows;
- CRM connected finance/inventory workflows;
- marketplace production data paths;
- Academy live learning paths;
- notification/event delivery;
- realtime architecture where required;
- analytics truthfulness;
- Jobs two-sided flows;
- Community activation;
- mobile safe-area/touch behavior;
- route-level error/recovery states;
- authentication/session lifecycle;
- backend AI tool execution;
- real file storage;
- request validation at API boundaries;
- canonical patient/clinic/appointment CRUD;
- versioned database migrations.

Historical status documents do not establish current truth. Code, tests and runtime evidence must be used when implementing these items.

---

## 20. Strategic priorities

Default priority:

1. Identity, trust, tenant isolation and security.
2. Core Clinic/CRM.
3. AI Workspace and orchestration.
4. Diagnostics + Laboratory.
5. Marketplace/Shop.
6. Academy/School.
7. Community + Jobs.
8. Advanced Finance/Analytics/ecosystem expansion.

Security/reliability issues remain P0 regardless of module order.

---

## 21. Documentation governance

### Canonical

`docs/DENTVISION_MASTER_SPEC.md` is the **single normative product/system source of truth**, including the current execution North Star and completion contract.

### Allowed non-normative technical artifacts

The repository may retain documents that serve engineering/history and do not redefine product intent, including:

- generated system maps;
- CI/QA artifacts;
- technical debt;
- compliance evidence;
- API/schema/generated documentation;
- changelog/history.

These describe implementation or history; they do not override the Master Spec.

### Deprecated product documents

Older missions, product DNA/constitution copies, blueprints, master plans, separate north stars, execution contracts, module specifications, AI strategies, role specifications, release plans and historical audits are superseded after migration and must be removed from the active documentation surface.

No separate North Star document should be created again. Its current product/execution content belongs here.

---

## 22. Conflict resolution

When sources disagree:

1. **This Master Spec wins for product/system intent and execution direction.**
2. Existing code/tests establish what currently exists; implementation must be aligned to this spec rather than silently changing the spec.
3. Figma governs visual implementation details within these product rules.
4. Changelog/history records what happened but never overrides the current specification.
5. Technical documents describe implementation and cannot create a competing product contract.

---

## 23. Explicit product-owner decisions — 2026-09-11

- Product identity: **Dental Super App / ecosystem**.
- AI Workspace: **central authenticated working interface**.
- Welcome screen + service cards: **remain in the current flow**.
- Roles: **one unified RBAC model combining primary + specialized roles**.
- Organizations: **multi-organization identity with explicit active tenant**.
- Medical data: **tenant-scoped; approved shared-reference data may be global**.
- AI autonomy: **risk-based**.
- Laboratory: **first-class organization type within the ecosystem**.
- Ecosystem surfaces: **distinct but unified**.
- Visual governance: **Figma + Master Spec**, with this document authoritative on product rules.
- Documentation: **one canonical product/system document; technical/history artifacts may remain**.
- Execution North Star: **retain its useful current execution logic, but incorporate it into this Master Spec rather than maintain a competing North Star file**.

---

## 24. Maintenance rule

When a product decision changes, update this document first. Do not create a second document to resolve the change.

Every implementation task must check this Master Spec plus the relevant code and tests before changing behavior.

The next task is always the highest-value unfinished product workflow, security/reliability defect or release blocker—not another documentation rewrite unless the product decision itself has changed.
