# DentVision Super App Blueprint

**Version:** 1.0  
**Status:** Proposed Product North Star  
**Date:** 2026-09-08  

> This document is a fresh product synthesis based on BLUEPRINT.md, UX_BLUEPRINT.md, the canonical Platform Specification, and a current competitor benchmark. It is not an audit report and must not be treated as evidence of implementation completeness.

---

## 1. Executive Decision

DentVision should not become a large CRM with Shop, School, Community and AI attached to it.

DentVision should become a **Dental Operating System** with one shared identity, one clinical/business graph, one command layer, one event system and one AI orchestration layer.

The correct mental model is:

```text
                    DENTVISION
                         │
              ┌──────────┴──────────┐
              │   INTELLIGENCE      │
              │ intent/context/AI   │
              └──────────┬──────────┘
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
   PRACTICE          DIAGNOSTICS       BUSINESS
       │                 │                 │
 patient/visit       X-ray/CBCT       finance/shop
 schedule/clinical   3D/TMJ           inventory/analytics
 lab/documents       AI findings      suppliers
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
              NETWORK & KNOWLEDGE
             Academy / Jobs / Community
```

The platform wins when one action creates value across several domains without making the user manually move between them.

Example:

```text
"Подготовь Иванова к имплантации"

→ identify patient
→ review history
→ review imaging
→ detect missing diagnostics
→ draft treatment plan
→ estimate cost
→ check doctor/lab availability
→ prepare consent/documents
→ suggest required materials
→ create tasks
→ ask for approval
→ execute approved actions
→ record events
→ update analytics
```

That is the Super App behavior. A collection of routes is not.

---

## 2. What the Existing Blueprints Get Right

### BLUEPRINT.md strengths

- Correctly defines DentVision as an AI ecosystem rather than a CRM.
- Correctly separates user identity from organization membership.
- Correctly makes organization/workspace context fundamental.
- Correctly proposes Intent → Context → Permissions → Planning → Action execution.
- Correctly proposes an event-driven platform core.
- Correctly makes search global.
- Correctly connects Marketplace and Academy to AI recommendations.
- Correctly recognizes that every service must share platform primitives.

### UX_BLUEPRINT.md strengths

- Strong role-based flows.
- Good use of contextual right-side information.
- Good AI execution state machine.
- Good mobile-first direction.
- Good separation of profile and settings.
- Good recognition that the central AI surface should not be a generic chat clone.
- Good inspiration set: Kaspi, Notion, Linear, Vercel and Arc.

These are the foundations to keep.

---

## 3. Critical Problems in the Existing Blueprints

### 3.1 AI is over-positioned as the navigation system

"AI is always the main interface" is directionally correct, but making every workflow begin with a chat creates friction for repetitive work.

A dentist should not have to tell AI "open today's schedule" every morning.

**New rule:**

> AI is the universal control layer, not the mandatory entry point for every task.

The user may act through:

- direct navigation;
- search;
- command bar;
- structured UI;
- voice;
- AI suggestion;
- automation.

All six operate on the same command/action system.

### 3.2 The Service Orbit is visually interesting but operationally weak

Seven floating cards around AI are a launch animation, not a scalable information architecture.

As services grow, orbit cards become cluttered and force the product to preserve a visual metaphor instead of optimizing discoverability.

**New rule:**

Use the orbit only as an optional first-run brand moment. The persistent home should be a **Today + Command Center**, not an orbit.

### 3.3 "Context Panel is never empty" is too rigid

A permanently populated panel can become visual noise.

**New rule:**

The right panel is **Focus Panel**. It appears when useful, can collapse, and changes according to the current entity/task.

### 3.4 The current information architecture is too module-centric

CRM, Shop, School, Jobs and Community are good domains but not the user's actual mental model.

The user's mental model is:

```text
Patient
Case
Appointment
Treatment
Money
Lab
Material
Learning
Team
```

Services should organize these entities and workflows, not compete with them.

### 3.5 The product needs a canonical object graph

The existing documents describe services and events but do not make the cross-domain object graph explicit enough.

DentVision needs one graph:

```text
User
 ├─ Membership → Organization
 ├─ Role / Permissions
 └─ Professional Profile

Organization
 ├─ Clinics / Branches
 ├─ Team
 ├─ Patients
 ├─ Suppliers
 ├─ Labs
 └─ Finance

Patient
 ├─ Appointments
 ├─ Visits
 ├─ Clinical Findings
 ├─ Odontogram
 ├─ Imaging
 ├─ Treatment Cases
 ├─ Treatment Plans
 ├─ Documents
 ├─ Invoices / Payments
 └─ Communication

Treatment Case
 ├─ Diagnostics
 ├─ Plan
 ├─ Procedures
 ├─ Lab Orders
 ├─ Materials
 ├─ Payments
 └─ Outcomes
```

This graph is the moat.

---

## 4. Competitor Benchmark

### 4.1 Kaspi — benchmark for ecosystem behavior

Kaspi's strength is not the number of services. It is the integration between services, common identity, payments, marketplace, messaging and a consistent transaction experience. Its public reporting describes the Super App as the gateway to its products and emphasizes integration and network effects. citeturn0search0turn0search2

**Take from Kaspi:**

- one identity;
- one home;
- services feel like one product;
- transactions cross service boundaries;
- contextual shortcuts;
- strong search/discovery;
- network effects.

**Do not copy:** consumer-finance navigation literally. DentVision needs a clinical operating model.

### 4.2 Dentrix / Eaglesoft / Open Dental / Curve

The dental PMS market still has strong incumbents, open-source flexibility and cloud-native challengers. Current comparisons emphasize reliability, usability, clinical/practice management depth and integrations. citeturn0search5turn0search6turn0search8

**Take from PMS competitors:**

- clinical depth;
- scheduling reliability;
- patient records;
- billing;
- insurance/financial workflows;
- operational completeness;
- data ownership and integrations.

**DentVision opportunity:** deliver this depth without forcing users into legacy navigation.

### 4.3 Pearl / Overjet — benchmark for clinical AI

Pearl emphasizes imaging detection, annotation, enhancement and practice intelligence; Overjet combines imaging intelligence with broader practice/enterprise intelligence. citeturn0search1turn0search14

**Take from them:**

- clinically useful AI must produce concrete findings;
- imaging must be deeply integrated into workflow;
- AI should create measurable clinical and business value;
- explainability and trust matter.

**DentVision opportunity:** make imaging AI one part of a larger clinical execution loop instead of a standalone AI product.

### 4.4 Notion — benchmark for workspace thinking

**Take:** flexible entities, relationships, views, documents and contextual work.

**DentVision adaptation:** a Patient/Case workspace that can surface timeline, clinical data, imaging, documents, finance and AI actions without forcing users through unrelated modules.

### 4.5 Linear — benchmark for operational clarity

**Take:** fast navigation, keyboard-first commands, status-driven workflows, minimal visual noise, excellent interaction quality.

**DentVision adaptation:** command center, shortcuts, predictable states, fast transitions and explicit action status.

---

## 5. DentVision's Differentiation

DentVision should not compete feature-for-feature with every PMS or every AI imaging vendor.

Its unique position should be:

> **The intelligence layer connecting the complete lifecycle of a dental case.**

### The Dental Case Loop

```text
DISCOVER
  ↓
PATIENT
  ↓
DIAGNOSE
  ↓
PLAN
  ↓
SCHEDULE
  ↓
TREAT
  ↓
LAB / MATERIALS
  ↓
PAY
  ↓
FOLLOW-UP
  ↓
OUTCOME
  ↓
LEARN
```

Every stage produces structured data and events.

AI observes the loop and helps operate it.

Marketplace supplies the loop.

Academy teaches the loop.

Community shares knowledge around the loop.

Jobs supplies talent for the loop.

Analytics measures the loop.

That is the Super App flywheel.

---

## 6. The New Home: DentVision Command Center

The home screen should not be a generic dashboard and should not be a giant chatbot.

### Desktop

```text
┌─────────────────────────────────────────────────────────────┐
│ DentVision   Search / Command       Notifications  Profile  │
├────────────┬────────────────────────────────┬───────────────┤
│            │                                │               │
│ HOME       │  Good morning, Dr. ...         │ FOCUS         │
│ PRACTICE   │                                │               │
│ DIAGNOSTIC │  TODAY                         │ selected item │
│ AI         │  18 patients · 2 labs         │ context       │
│ SHOP       │                                │               │
│ ACADEMY    │  [Next patient] [Open case]   │               │
│ ANALYTICS  │                                │               │
│ NETWORK    │  PRIORITIES                    │               │
│            │  • 3 cases need attention     │               │
│            │  • 2 lab orders delayed       │               │
│            │                                │               │
│            │  ASK / COMMAND                 │               │
│            │  "Что важно сегодня?"         │               │
│            │                                │               │
│            │  RECENT / CONTINUE             │               │
└────────────┴────────────────────────────────┴───────────────┘
```

### Home principles

1. Show what matters now.
2. Show the next action.
3. Show unresolved problems.
4. Make the most common actions one tap/click away.
5. Keep AI available without forcing a chat session.
6. Personalize by role.

---

## 7. Navigation Model

### Desktop

**Primary:**

- Home
- Practice
- Diagnostics
- AI
- Shop
- Academy
- Analytics
- Network

**Secondary:**

- Jobs
- Community
- Profile
- Settings
- Help

**Admin:** isolated and permission-gated.

### Mobile

```text
Home | AI | Practice | Diagnostics | More
```

The More sheet contains Shop, Academy, Analytics, Jobs, Community, Profile and Settings.

### Global command

`Ctrl/Cmd + K` opens:

```text
Search patients, cases, products, courses, people...

Commands
Recent
AI actions
```

Voice should invoke the same command system.

---

## 8. Core Workspaces

### 8.1 Practice

Practice is the clinical/operational workspace, not simply "CRM".

```text
Today
Schedule
Patients
Cases
Clinical
Odontogram
Treatment Plans
Lab
Documents
Finance
Inventory
Team
```

### 8.2 Diagnostics

A dedicated clinical workspace for:

- X-ray;
- panoramic imaging;
- CBCT;
- 3D;
- TMJ;
- photos;
- AI findings;
- measurements;
- referrals;
- diagnostic center workflows.

### 8.3 AI

AI Team is not another chat page.

It is the control plane for specialized agents:

- Clinical Copilot
- Diagnostic Copilot
- Treatment Planner
- Scheduling Agent
- Finance Agent
- Procurement Agent
- Patient Communication Agent
- Education Agent
- Operations Agent

Each agent uses the same permission and action framework.

### 8.4 Shop

Marketplace should be task-aware.

Instead of:

> Browse 10,000 products.

DentVision should offer:

> "Для этого плана лечения нужно 4 позиции."

Then show verified alternatives, prices, availability and supplier information.

### 8.5 Academy

Academy should connect learning to actual work:

```text
Case → Skill gap → Recommended lesson → Practice → Certificate
```

### 8.6 Analytics

Analytics should answer questions, not just display charts:

- Why is revenue down?
- Which doctors are underloaded?
- Which treatments have low case acceptance?
- Which lab orders are late?
- Where is inventory leaking?
- Which patients need follow-up?

AI generates the explanation and links every insight to underlying data.

### 8.7 Network

Community + Jobs should share professional identity, verification, reputation and skills.

---

## 9. Patient Workspace: The Most Important Entity

The patient is the primary clinical object.

```text
Patient Header
├── identity / contacts
├── risk / alerts
├── next appointment
└── AI summary

Tabs
├── Overview
├── Timeline
├── Odontogram
├── Diagnostics
├── Treatment
├── Visits
├── Documents
├── Finance
├── Lab
└── Communication
```

### AI summary

The AI summary should answer:

- What is known?
- What changed?
- What is pending?
- What is risky?
- What should happen next?

It must cite the source record inside the application and never silently invent clinical facts.

---

## 10. Treatment Case as the Super App Connector

A **Treatment Case** should connect the entire platform.

```text
Case
├── Patient
├── Diagnosis
├── Imaging
├── Findings
├── Treatment Plan
├── Appointments
├── Procedures
├── Materials
├── Lab Orders
├── Documents / Consent
├── Invoice / Payments
├── Communication
├── Follow-up
└── Outcome
```

This object should be the bridge between Practice, Diagnostics, Shop, Finance and AI.

---

## 11. AI Operating Model

AI must have three layers.

### Layer 1 — Copilot

Explains, summarizes, searches and recommends.

### Layer 2 — Operator

Executes approved actions.

```text
Intent
→ Context
→ Permission
→ Plan
→ Preview
→ Confirmation if required
→ Execute
→ Verify
→ Audit
```

### Layer 3 — Agent

Runs bounded recurring workflows with explicit permissions.

Examples:

- daily schedule optimization;
- overdue follow-up detection;
- lab delay monitoring;
- inventory reorder suggestions;
- unpaid invoice reminders;
- learning recommendations.

Agents never bypass permissions or audit logging.

---

## 12. Trust Model

Clinical and financial actions need a stricter model than normal UI actions.

### Risk levels

**LOW:** search, summarize, navigate.  
**MEDIUM:** draft message, draft treatment plan, create non-financial task.  
**HIGH:** modify clinical record, issue financial document, send patient communication.  
**CRITICAL:** payment, refund, deletion, irreversible clinical/administrative change.

The UI must clearly show:

```text
What will happen
Why
Which data is used
Who authorized it
What will change
Undo / rollback when possible
```

---

## 13. Event-Driven Super App

Every meaningful domain action produces an event.

```text
AppointmentCreated
PatientUpdated
VisitCompleted
FindingCreated
TreatmentPlanCreated
LabOrderCreated
LabOrderDelayed
PaymentReceived
InventoryLow
CourseCompleted
JobApplicationCreated
```

Subscribers can include:

- notifications;
- analytics;
- AI;
- activity feed;
- automation;
- audit;
- billing;
- search indexing.

The UI should never implement hidden cross-module side effects independently.

---

## 14. Shared Platform Primitives

Every service must use the same:

- identity;
- organizations;
- memberships;
- permissions;
- navigation shell;
- search;
- notifications;
- command bus;
- action registry;
- event bus;
- audit log;
- file/media system;
- billing;
- feature flags;
- analytics events;
- AI context;
- error/loading/empty states.

This is what makes the product one platform.

---

## 15. Mobile Strategy

Mobile is not a compressed desktop.

### Primary mobile jobs

- check schedule;
- open patient;
- review case;
- capture/view photos;
- review diagnostics;
- dictate notes;
- approve AI actions;
- communicate with patients/team;
- monitor business alerts.

### Mobile AI

The main interaction can be voice-first:

> "Покажи сегодняшних пациентов с неподтвержденной записью."

The same intent engine must work from text, voice and UI actions.

---

## 16. What DentVision Should NOT Do

1. Do not create a separate mini-dashboard for every module.
2. Do not create separate AI chats for every service.
3. Do not make users memorize which service owns an action.
4. Do not use giant decorative cards where a compact list is better.
5. Do not hide important workflows behind animation.
6. Do not let Marketplace recommendations influence clinical decisions without transparent reasoning.
7. Do not allow AI to perform high-risk actions without appropriate authorization.
8. Do not duplicate patient data across services.
9. Do not make mobile a secondary afterthought.
10. Do not add services just to increase the number of sidebar items.

---

## 17. Super App Flywheel

```text
More clinics
    ↓
More clinical/workflow data
    ↓
Better contextual AI
    ↓
Better outcomes + less admin work
    ↓
Higher clinic retention
    ↓
More doctors / labs / suppliers
    ↓
More Marketplace + Academy activity
    ↓
More network value
    ↓
More clinics
```

The defensibility is the connected workflow graph, not the number of screens.

---

## 18. Product Quality Bar

Every new feature must pass these gates:

### Gate A — User value
Does it remove work, improve care, increase revenue, reduce risk or improve learning?

### Gate B — Integration
Does it use the shared identity, permissions, search, events and AI context?

### Gate C — Discoverability
Can a user find it through navigation, search or command?

### Gate D — Actionability
Does the feature produce a clear next action?

### Gate E — Trust
Are permissions, provenance, audit and confirmation appropriate?

### Gate F — Mobile
Does the core workflow work on a phone?

### Gate G — Performance
Does the workflow remain fast with realistic clinic data?

### Gate H — Accessibility
Keyboard, focus, contrast, semantics and reduced-motion behavior must be valid.

---

## 19. Strategic Priority Order

Do not build every marketplace/network feature before the clinical core is excellent.

### Phase 1 — Core operating system

1. Identity / IAM
2. Organization / workspace
3. App shell
4. Patient
5. Appointment / schedule
6. Visit / clinical record
7. Treatment case
8. Odontogram
9. Documents
10. Finance basics
11. Search
12. Notifications
13. Event bus
14. AI command layer

### Phase 2 — Clinical intelligence

15. Diagnostics
16. Imaging / CBCT / 3D
17. AI findings
18. Treatment planner
19. AI clinical summary
20. Lab workflow

### Phase 3 — Business ecosystem

21. Inventory
22. Shop
23. Suppliers
24. Analytics
25. Finance expansion

### Phase 4 — Knowledge/network

26. Academy
27. Community
28. Jobs
29. Professional reputation

### Phase 5 — Autonomous operations

30. Specialized agents
31. Workflow automation
32. Predictive analytics
33. Multi-clinic optimization
34. External integrations / hardware

---

## 20. Final Product Definition

DentVision should be understood as:

> **The operating system of a dental professional and dental organization.**

Not:

> CRM + Shop + School + AI + Community.

The difference is architectural.

In a collection of modules, the user moves between systems.

In DentVision, the **case, patient, organization and workflow stay continuous while the service changes around them**.

That is the Super App.

---

## 21. Immediate Implementation Consequence

The current repository should be evolved toward this model in the following order:

1. Treat the canonical spec as product intent, not proof of implementation.
2. Keep the current Super App shell but remove dead routes and duplicate navigation concepts.
3. Make Home a Command Center rather than a decorative service-card dashboard.
4. Make Practice the primary clinical workspace.
5. Introduce Patient and Treatment Case as cross-domain entities wherever the current schema allows.
6. Make Diagnostics deeply linkable from Patient/Case.
7. Route AI actions through one command/action contract.
8. Connect Shop, Academy, Finance and Analytics to real events from clinical workflows.
9. Use one global search/command surface.
10. Make mobile navigation task-first.
11. Validate every step with typecheck, lint, build, tests and real route coverage.
12. Only then expand autonomous agents and network effects.

This blueprint is the target architecture for making DentVision a real Super App rather than a visually unified collection of applications.
