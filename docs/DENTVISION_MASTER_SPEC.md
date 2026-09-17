# DentVision — Master Product & System Specification

**Status:** CANONICAL / ACTIVE  
**Version:** 5.0  
**Date:** 2026-09-17  
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
- dental clinics and clinic groups;
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

Experience:

`Welcome / Discovery → Intent → Authentication only when required → Context selection → Contextual Home/Workspace → Real workflow + AI assistance`

- Welcome answers **“What can I do here?”**
- Home / Command Center answers **“What should I do now?”**
- AI answers **“How can DentVision help me do it?”**
- A workspace exposes only controls relevant to the current role, organization, branch, entity and task.
- Advanced controls appear when needed.
- Global navigation never becomes a feature catalog.
- No user is forced to create or join a clinic merely to use unrelated DentVision capabilities.
- Every business cabinet must explain its operational model, not merely display CRUD pages.

## 3. Canonical identity, organization and context architecture

### 3.1 One identity, many memberships

A person has one DentVision identity and may have many authorized memberships:

`User → Membership → Organization → Branch/Workspace → Role(s) → Permissions`

A user may simultaneously be:

- OWNER + DOCTOR in Dental Organization A;
- RADIOLOGIST in Diagnostic Organization B;
- OWNER in Dental Laboratory C;
- DOCTOR in Medical Organization D;
- SELLER in Supplier Organization E;
- LECTURER in Academy F.

The role is **scoped to the membership/context**, never treated as a single global label when organization-scoped access is required.

### 3.2 Organization is a first-class security boundary

Supported organization types are:

1. `DENTAL_CLINIC`
2. `DIAGNOSTIC_CENTER`
3. `MEDICAL_LABORATORY`
4. `DENTAL_LABORATORY`
5. `MEDICAL_ORGANIZATION`
6. `SUPPLIER`
7. `MANUFACTURER`
8. `ACADEMY`
9. `EDUCATION_CENTER`
10. `EMPLOYER`
11. `PROFESSIONAL_GROUP`
12. other governed types added through the same Organization model.

Organization type controls the default workspace template and onboarding flow. It does **not** create a separate authorization system.

### 3.3 Active context

The active context must be explicit and visible:

`Active Organization → Branch → Workspace → Role/Capability → current entity`

Switching organization must atomically change all relevant:

- permissions;
- navigation;
- data queries;
- AI context;
- notifications;
- finance scope;
- staff/team view;
- branch scope;
- operational queues.

A client-supplied `organizationId`, `clinicId`, `branchId` or resource ID is never authorization proof.

### 3.4 Multi-organization invariants

The following must be tested as mandatory security journeys:

- same person belongs to two organizations;
- different role in each organization;
- OWNER + DOCTOR in one organization;
- OWNER in one organization and ordinary member in another;
- organization A cannot read organization B patients, cases, orders, finance or staff;
- switching A → B changes sidebar and Command Center;
- switching B → A restores A context;
- deep links cannot escape the active authorized organization;
- AI cannot use context from another organization;
- branch restrictions remain inside the organization;
- organization deactivation removes operational access without destroying identity.

## 4. Organization onboarding and entry model

The first question after authentication is not “Which clinic?” It is **“What are you here to do?”**

### 4.1 Entry paths

A new user may enter through:

- patient/buyer intent;
- doctor/professional intent;
- clinic/business intent;
- diagnostic center intent;
- medical laboratory intent;
- dental laboratory intent;
- supplier/manufacturer intent;
- academy/lecturer intent;
- student intent;
- employer/jobs intent.

### 4.2 Create or join

Every organization-aware onboarding must support:

`Create organization | Join by invitation | Join existing organization | Continue as professional/patient without organization`

For a new organization, collect only what is necessary to start, then progressively request:

- legal/business identity;
- organization type;
- public profile;
- branches;
- services/catalog;
- staff;
- pricing;
- payment/settlement settings;
- documents/verification;
- compliance settings.

The onboarding engine must show a clear completion checklist and first operational milestone.

### 4.3 Organization switcher

The global header contains a compact context control:

`[Organization logo/name] [Branch] [Workspace/role]`

Opening it shows:

- recent organizations;
- organization type;
- branch;
- current role(s);
- pending invitations;
- create organization;
- join organization;
- organization settings when authorized.

The switcher must not look like a generic account dropdown. It is a security/context control.

## 5. Global shell and interface architecture

### 5.1 Desktop shell

```text
┌──────────────────────────────────────────────────────────────┐
│ Organization / Branch │ Search / AI │ Alerts │ Profile      │
├──────────────┬──────────────────────────────┬───────────────┤
│ Global       │ Contextual Workspace         │ AI / Context  │
│ navigation   │                              │ panel         │
│              │ Home / queue / entity /      │               │
│              │ workflow                     │               │
├──────────────┴──────────────────────────────┴───────────────┤
│ contextual actions / status / optional bottom utility bar   │
└──────────────────────────────────────────────────────────────┘
```

The left navigation is global and context-aware. Workspace tabs belong to the current domain. The right panel is contextual and may contain AI, related entities, tasks, events or workflow information.

### 5.2 Mobile shell

Mobile uses:

`Today | Work | AI | Network/Market | More`

The active organization remains visible above the workspace. Dense professional workflows use full-screen work areas, bottom sheets and task-oriented actions instead of shrinking desktop tables.

### 5.3 Cabinet rule

A **cabinet** is a complete operating environment for a user/org context, not merely a page collection.

Every cabinet has:

1. Context header.
2. Today/Command Center.
3. Primary operational queue.
4. Entity search.
5. Core workflow.
6. Team/staff controls where applicable.
7. Finance/economics where applicable.
8. Reports/analytics where applicable.
9. Organization/settings.
10. AI assistant aware of the cabinet's domain.
11. Notifications/tasks.
12. Audit/history.
13. Empty/loading/error/success states.
14. Role-based action visibility.
15. Mobile equivalent.

## 6. Canonical route architecture

These are **target canonical routes**. Before implementation, reconcile them against the actual repository route inventory; do not create duplicate routes when an existing canonical route already provides the same function.

### 6.1 Public/discovery

- `/` — Welcome
- `/discover` — ecosystem discovery
- `/organizations` — organization discovery
- `/organizations/:organizationId` — public organization profile
- `/professionals/:professionalId` — professional profile
- `/services/:serviceId` — service discovery
- `/book/:providerId` — public booking
- `/jobs` — jobs discovery
- `/academy` — learning discovery
- `/shop` — marketplace discovery
- `/diagnostics` — diagnostics discovery
- `/laboratories` — laboratory discovery

### 6.2 Identity/context

- `/login`
- `/register`
- `/onboarding`
- `/organizations/new`
- `/organizations/join`
- `/context` — choose/switch active context
- `/invitations`
- `/profile`
- `/settings`

### 6.3 Universal operating routes

- `/home` — contextual Command Center
- `/ai` — global AI workspace
- `/tasks`
- `/notifications`
- `/search`
- `/activity`

### 6.4 Dental clinic / practice

- `/practice`
- `/practice/today`
- `/practice/calendar`
- `/practice/patients`
- `/practice/patients/:patientId`
- `/practice/cases/:caseId`
- `/practice/odontogram`
- `/practice/treatment-plans`
- `/practice/appointments`
- `/practice/diagnostics`
- `/practice/lab-orders`
- `/practice/inventory`
- `/practice/documents`
- `/practice/communications`
- `/practice/finance`
- `/practice/analytics`
- `/practice/team`
- `/practice/branches`

### 6.5 Diagnostic center

- `/diagnostics/workspace`
- `/diagnostics/today`
- `/diagnostics/referrals`
- `/diagnostics/orders`
- `/diagnostics/worklist`
- `/diagnostics/studies/:studyId`
- `/diagnostics/patients`
- `/diagnostics/reports`
- `/diagnostics/viewer/:studyId`
- `/diagnostics/ai`
- `/diagnostics/services`
- `/diagnostics/schedule`
- `/diagnostics/rooms`
- `/diagnostics/modalities`
- `/diagnostics/staff`
- `/diagnostics/branches`
- `/diagnostics/finance`
- `/diagnostics/analytics`
- `/diagnostics/settings`

The workflow is:

`Referral → acceptance → scheduling → modality/worklist → acquisition → interpretation → report → authorization → delivery → settlement`.

### 6.6 Medical laboratory

- `/medical-lab`
- `/medical-lab/today`
- `/medical-lab/orders`
- `/medical-lab/specimens`
- `/medical-lab/worklist`
- `/medical-lab/processing`
- `/medical-lab/results`
- `/medical-lab/results/:resultId`
- `/medical-lab/clients`
- `/medical-lab/tests`
- `/medical-lab/panels`
- `/medical-lab/quality`
- `/medical-lab/equipment`
- `/medical-lab/staff`
- `/medical-lab/branches`
- `/medical-lab/finance`
- `/medical-lab/analytics`
- `/medical-lab/settings`

Workflow:

`Order → acceptance → specimen collection/receipt → accession → routing → analysis → QC/validation → result → authorized release → settlement`.

### 6.7 Dental laboratory

- `/dental-lab`
- `/dental-lab/today`
- `/dental-lab/inbox`
- `/dental-lab/cases`
- `/dental-lab/cases/:caseId`
- `/dental-lab/production`
- `/dental-lab/workstations`
- `/dental-lab/design`
- `/dental-lab/cadcam`
- `/dental-lab/qc`
- `/dental-lab/remakes`
- `/dental-lab/shipping`
- `/dental-lab/clients`
- `/dental-lab/catalog`
- `/dental-lab/materials`
- `/dental-lab/inventory`
- `/dental-lab/invoices`
- `/dental-lab/finance`
- `/dental-lab/analytics`
- `/dental-lab/staff`
- `/dental-lab/settings`

Workflow:

`Incoming order → completeness check → acceptance/clarification → scheduling → department routing → production → QC → ready → dispatch/delivery → invoice/settlement → remake/feedback when needed`.

### 6.8 Medical organization

- `/medical`
- `/medical/today`
- `/medical/patients`
- `/medical/appointments`
- `/medical/cases`
- `/medical/diagnostics`
- `/medical/laboratory`
- `/medical/documents`
- `/medical/team`
- `/medical/branches`
- `/medical/finance`
- `/medical/analytics`
- `/medical/settings`

Medical organizations use the same organization/IAM foundation but their clinical modules are configured by specialty and permissions.

### 6.9 Supplier / manufacturer

- `/business`
- `/business/today`
- `/business/catalog`
- `/business/products`
- `/business/inventory`
- `/business/orders`
- `/business/fulfillment`
- `/business/customers`
- `/business/pricing`
- `/business/promotions`
- `/business/finance`
- `/business/analytics`
- `/business/team`
- `/business/settings`

### 6.10 Academy

- `/academy/workspace`
- `/academy/courses`
- `/academy/courses/:courseId`
- `/academy/students`
- `/academy/content`
- `/academy/assessments`
- `/academy/certificates`
- `/academy/schedule`
- `/academy/finance`
- `/academy/analytics`
- `/academy/team`
- `/academy/settings`

### 6.11 Professional / Jobs

- `/professional`
- `/professional/profile`
- `/professional/credentials`
- `/professional/portfolio`
- `/jobs`
- `/jobs/matches`
- `/jobs/applications`
- `/jobs/messages`
- `/employer`
- `/employer/vacancies`
- `/employer/candidates`
- `/employer/hiring`

### 6.12 Administration

- `/admin`
- `/admin/organization`
- `/admin/branches`
- `/admin/members`
- `/admin/roles`
- `/admin/permissions`
- `/admin/services`
- `/admin/integrations`
- `/admin/billing`
- `/admin/audit`
- `/admin/security`
- `/admin/data`

## 7. Cabinet specifications by participant

### 7.1 Clinic owner / director

**Primary job:** run the organization, team, branches, money and growth.

Home must show:

- today's operational exceptions;
- production/revenue/collections;
- appointment utilization;
- unpaid balances;
- staff/doctor workload;
- branch comparison;
- diagnostic/lab bottlenecks;
- inventory warnings;
- patient acquisition/retention indicators;
- tasks requiring owner approval.

Core areas:

`Today · Operations · Patients · Team · Branches · Services · Inventory · Finance · Analytics · Marketing/Communications · Partners · Settings`

Owner may also be a Doctor. In that case the same context exposes both management and clinical capabilities without creating a second identity.

### 7.2 Doctor

**Primary job:** safely diagnose, plan, treat, document and coordinate care.

Home:

`Today → appointments → urgent results → pending treatment plans → lab cases → diagnostics → follow-up → AI suggestions`

Core areas:

`Schedule · Patients · Cases · Odontogram · Diagnostics · Treatment Plans · Procedures · Lab · Documents · Finance relevant to care · AI`

Treatment-plan approval must use the union of authorized scoped roles, so OWNER+DOCTOR can perform clinical actions when the organization policy grants them.

### 7.3 Reception / administrator

**Primary job:** keep patient flow and front desk operations moving.

`Today · Calendar · Check-in · Patients · Calls/messages · Waiting room · Payments · Documents · Tasks`

No access to clinical actions merely because the user can open a patient profile.

### 7.4 Diagnostic center owner

**Primary job:** operate a diagnostic business and control referral, modality, reporting, staff and economics.

Home:

`Incoming referrals · today's schedule · modality utilization · waiting studies · reporting queue · overdue reports · revenue/settlement · exceptions`

Core areas:

`Worklist · Referrals · Schedule · Patients · Studies · Viewer · Reporting · AI · Modalities/Rooms · Services/Pricing · Partners · Staff · Finance · Analytics · Settings`

### 7.5 Radiologist / diagnostician

**Primary job:** interpret authorized studies and produce validated reports.

Home:

`My worklist · priority studies · pending reports · corrections · peer review`

Core screen must be worklist-first, with direct transition into viewer/reporting. The radiologist should not have to navigate through business pages to reach a study.

Study workspace:

`Patient context → study metadata → images/viewer → measurements/annotations → AI findings → report draft → review → sign/validate → release`

### 7.6 Medical laboratory owner

**Primary job:** control orders, specimens, processing, quality, staff and financial performance.

Home:

`Orders awaiting acceptance · specimens · work queues · TAT exceptions · QC alerts · results awaiting validation · settlements`

Core areas:

`Orders · Specimens · Worklist · Processing · Results · Quality · Tests/Panels · Equipment · Clients · Staff · Finance · Analytics · Settings`

### 7.7 Medical laboratory technician

**Primary job:** process assigned specimens correctly and record traceable work.

Home is task-first:

`Assigned specimens → procedure → result entry → QC → handoff`

The technician should not see unrelated organization finance or full patient history.

### 7.8 Dental laboratory owner

**Primary job:** control case intake, production capacity, quality, clients, delivery and profitability.

Home:

`Incoming cases · today's production · deadline risks · QC/remakes · dispatch · receivables · production capacity`

Core areas:

`Inbox · Cases · Production · Design · CAD/CAM · QC · Remakes · Shipping · Clients · Catalog · Materials · Inventory · Invoices · Finance · Analytics · Staff · Settings`

### 7.9 Dental technician

**Primary job:** complete assigned manufacturing steps.

Workbench:

`My queue → case specification → files/photos/scans → previous notes → required procedure → materials → status/progress → QC handoff`

No unnecessary access to patient financial or unrelated medical data.

### 7.10 Supplier / manufacturer

**Primary job:** sell and fulfill products.

Home:

`Orders · fulfillment exceptions · stock · low inventory · customer messages · revenue/payouts`

Core areas:

`Catalog · Offers · Inventory · Orders · Fulfillment · Customers · Pricing · Promotions · Finance · Analytics · Team · Settings`

### 7.11 Academy owner / lecturer

**Primary job:** create education, manage learners, deliver assessments and monetize knowledge.

Home:

`Courses · enrollments · learner progress · assessments · certificates · revenue`

### 7.12 Student / professional learner

**Primary job:** complete learning and convert credentials into professional value.

Home:

`Continue learning · deadlines · progress · cases · assessments · certificates · professional profile`

### 7.13 Employer

**Primary job:** recruit and manage professional hiring.

Home:

`Open roles · matched professionals · applications · interviews · offers · hiring pipeline`

### 7.14 Patient / buyer

**Primary job:** find, book, buy, learn and manage personal interactions.

Home:

`Upcoming appointment/order · results shared with me · payments · messages · saved providers · learning/orders`

Patient experience must never expose internal organization operations.

## 8. Organization management: what an owner needs to run a business

Every business organization has an **Organization Control Center** available according to permission:

### Identity and profile

- legal/public name;
- logo/branding;
- contacts;
- addresses;
- organization type;
- verification status;
- public profile;
- documents.

### Structure

- branches;
- departments;
- rooms/workstations;
- modalities/equipment where applicable;
- services;
- operating hours;
- holidays;
- capacity.

### People

- invitations;
- members;
- roles;
- role combinations;
- branch assignment;
- schedules;
- credentials;
- employment status;
- permission exceptions with audit.

### Commercial

- price books;
- partner prices;
- discounts;
- commissions;
- payment methods;
- invoices;
- receivables/payables;
- settlements;
- refunds;
- payout accounts.

### Operations

- queues;
- workflow templates;
- SLA/TAT rules;
- notifications;
- templates;
- document requirements;
- escalation rules;
- task assignment.

### Integrations

- DICOM/PACS/RIS for diagnostic workflows where implemented;
- scanner/CAD-CAM/lab integrations where implemented;
- accounting/payment providers;
- messaging;
- file storage;
- APIs/webhooks.

### Governance

- audit log;
- consent;
- data access;
- security;
- sessions/devices;
- export/retention policies;
- organization deactivation.

## 9. Workflow-first interface rule

Every operational cabinet must be built around a queue and a lifecycle, not a list of database tables.

### Universal workflow UI

1. **Inbox/Queue** — what needs attention now.
2. **Filters** — status, deadline, branch, assignee, priority.
3. **Work item** — one clear entity/workflow.
4. **Context drawer** — related information without losing queue position.
5. **Action bar** — next allowed action.
6. **History/timeline** — what happened and by whom.
7. **Audit** — authoritative mutation history.
8. **AI assist** — summarize, detect, recommend, draft or execute where permitted.

### Avoid

- dashboard-only cabinets;
- dozens of static KPI cards;
- CRUD-first navigation;
- hidden status transitions;
- unrelated patient data in partner workspaces;
- requiring users to remember internal entity names.

## 10. Domain-specific benchmark principles

DentVision should learn from mature products without copying their UI or creating parallel domain models.

### Dental practice benchmarks

Dentrix demonstrates the value of multi-location scheduling, centralized billing, single patient/provider records, continuing care, clinical charting, treatment planning, imaging, patient communication and analytics. citeturn0search0turn0search5

**DentVision implication:** clinic owner and doctor cabinets must combine operational queues with clinical continuity, while preserving organization/branch scope.

### Dental laboratory benchmarks

Labtrac emphasizes a unified incoming case inbox, digital/analog order intake, configurable production flows, technician workbenches, traceability, quality checkpoints and analytics. 3Shape LMS similarly emphasizes case management, client history, configurable production lines, scheduling, billing, barcode traceability and clinic collaboration. Dandy emphasizes connected scan/order workflows, live case status, design approval and clinic-lab collaboration. citeturn0search3turn0search6turn0search2

**DentVision implication:** the dental lab must be a real manufacturing operating system: inbox → production planning → technician workbench → QC → delivery → financial recognition, with digital files and communication attached to the case.

### Diagnostic/radiology benchmarks

GE HealthCare's radiology workflow combines scheduling, acquisition, viewing, reporting, coding, sharing and archiving, with multi-organization role-based workflows, security, worklists and rules-based scheduling. Siemens/medavis materials describe a workflow around orders, scheduling, waiting/worklists, rooms, examination, performance capture, reporting and billing; RIS/PACS workflows also distinguish technologist and radiologist tasks. citeturn1search0turn1search1turn1search14

**DentVision implication:** diagnostic center UX must be worklist-first and modality/reporting aware. It cannot be a generic CRM page called “Diagnostics”.

### Medical laboratory benchmarks

Large laboratory workflows emphasize order/sample management, tracking, processing, result reporting, quality/operational visibility and integration with external clinical systems. Labcorp describes ordering/result search, status tracking, result delivery, sample management and operational analytics. citeturn1search3turn1search12turn1search15

**DentVision implication:** medical laboratory UX must distinguish order, specimen, accession, work step, validation and result release; each must have traceability and controlled visibility.

## 11. Cross-organization ecosystem workflows

### Clinic → Diagnostic Center

`Doctor/clinic → choose authorized center → service → referral/order → scheduling → payment/authorization → study → report → authorized delivery → doctor confirmation → patient record`

The diagnostic organization sees only what the referral and consent/policy permit.

### Clinic → Medical Laboratory

`Clinic → test/panel → order → specimen workflow → processing → validation → result → authorized delivery → clinical context → settlement`

### Clinic → Dental Laboratory

`Clinic/doctor → case/order → prescription/specification → scan/files → lab acceptance → production → QC → design approval when required → ready → delivery → payment`

### Diagnostic Center → Clinic

A result can be returned only through an authorized relationship and must retain provenance, timestamps, author/validator and document/file integrity.

### Laboratory → Clinic

Results must carry specimen/order identity, status, timestamps, validator and release permissions.

### Shop → Organization

`Discovery → offer → order → payment → fulfillment → receipt → inventory → accounting/economics`

### Academy → Professional

`Discovery → enrollment → learning → assessment → certificate → professional profile`

## 12. Clinical graph and diagnostics

Clinical graph:

`Patient → Visit → Diagnosis → Imaging → AI Findings → Treatment Plan → Appointments → Procedures → Lab → Materials → Documents → Payments → Communication → Follow-up → Outcome`

Diagnostics:

`Discovery → center → study → availability → order → payment/confirmation → performed → result → authorized AI summary → professional confirmation → patient record`

AI diagnostic output is assistive until the required professional confirmation step is completed.

Treatment plans:

- draft;
- review;
- approval;
- patient presentation;
- accepted/rejected/partially accepted;
- scheduled;
- performed;
- closed.

Clinical approval uses the effective permission union of all authorized roles held in the active organization context. OWNER+DOCTOR is a valid compound role when the organization grants both capabilities.

## 13. Laboratory domain contracts

### Dental laboratory

Canonical lifecycle:

`DRAFT → SUBMITTED → ACCEPTED → IN_PRODUCTION → QC → READY → DELIVERED | CANCELLED`

Additional operational states may include `REMAKE` and `DELAYED` as governed domain events rather than ad-hoc UI flags.

Every case should support:

- clinic/client;
- patient/case reference with minimized data;
- prescription/specification;
- tooth/arch/work details;
- material;
- shade;
- implant/prosthetic information where applicable;
- scans/files/photos;
- due date;
- try-in date where applicable;
- assigned department/technician;
- production events;
- QC;
- design approvals;
- delivery;
- invoice/payment;
- remake reason.

### Medical laboratory

The canonical specimen lifecycle is:

`ORDERED → ACCEPTED → COLLECTED/RECEIVED → ACCESSIONED → IN_PROCESS → QC/VALIDATION → RELEASED | REJECTED | CANCELLED`

A result is not equivalent to an order. Specimen identity and chain-of-custody information must remain traceable.

## 14. Finance and economics by organization type

Every commercial organization receives a finance view appropriate to its business.

### Clinic

Revenue, collections, receivables, doctor production, service profitability, expenses, branch economics, lab/diagnostic spend.

### Diagnostic center

Study volume, modality utilization, referral sources, revenue, unpaid orders, turnaround time, report productivity, partner settlements.

### Medical laboratory

Test volume, reagent/material cost, turnaround time, rejected specimens, revenue, receivables, partner settlements, productivity.

### Dental laboratory

Case volume, production capacity, revenue by client/service, remake rate, material cost, technician utilization, turnaround time, receivables, margins.

### Supplier/manufacturer

GMV, orders, inventory turnover, fulfillment rate, returns, payouts, margin, customer concentration.

### Academy

Enrollment, completion, assessment, certificates, revenue, instructor economics.

Finance is ecosystem-wide but every metric is organization-scoped. Historical calculations remain reproducible.

## 15. AI operating layer

AI is a platform capability, not a decorative chatbot and not a replacement for dedicated UIs.

Canonical architecture:

`AI Router → Active Context → Role/Workspace Context → Permission Engine → Tool Registry → Model/Reasoning → Action Validator → Preview → Confirmation when required → Execute → Verify → Audit`

AI must understand the current organization type and cabinet. Examples:

- Dental clinic: “Какие пациенты требуют внимания сегодня?”
- Diagnostic center: “Какие исследования просрочены по SLA?”
- Medical lab: “Какие образцы ожидают валидации?”
- Dental lab: “Какие кейсы рискуют опоздать завтра?”
- Supplier: “Какие SKU заканчиваются?”
- Academy: “Какие студенты отстают от курса?”

AI cannot silently switch organization context or use another organization's data.

## 16. Global navigation rules

1. No duplicate destinations.
2. No dead sidebar links.
3. Every visible route must resolve to a real page or explicit gated state.
4. Every visible mutation action must have a real handler.
5. Route access must derive from the canonical IAM resolver.
6. Empty server page policy must not accidentally deny all role-based pages when a valid canonical role policy exists.
7. Organization-scoped permissions must be recalculated after context switch.
8. Financial and clinical routes must enforce organization and branch scope server-side.
9. A page must not infer access from URL visibility alone.
10. A disabled action must explain the missing permission/context when appropriate.
11. Deep links must preserve active organization context and fail closed if unauthorized.
12. Sidebar labels must use user-facing concepts, not database entity names.
13. Mobile and desktop must expose the same business capability through appropriate interaction patterns.

## 17. Security, privacy and minimum necessary access

A partner organization receives the minimum information necessary for its authorized workflow.

Examples:

- Dental lab does not need unrelated patient finance or full medical history.
- Diagnostic center does not automatically receive unrelated laboratory records.
- Medical laboratory does not automatically receive dental treatment details.
- Technician sees assigned manufacturing data, not organization-wide finance.
- Reception sees scheduling/front-desk data, not unrestricted clinical notes.
- Patient sees only their own authorized data.

All cross-organization data sharing must have a source organization, destination organization, purpose/workflow, authorization basis, timestamps and audit trail.

## 18. Quality law

Every new feature must:

1. identify primary user and job-to-be-done;
2. identify organization type;
3. identify active organization/branch/workspace;
4. map to existing domain objects;
5. reuse existing domain truth;
6. use canonical IAM;
7. define AI assistance where appropriate;
8. define manual fallback;
9. implement loading/empty/error/success states;
10. define confirmation rules;
11. be reachable without unnecessary menu hunting;
12. have executable acceptance criteria;
13. include negative authorization tests;
14. include organization-switch tests where relevant;
15. include mobile behavior;
16. include auditability for consequential actions.

A beautiful disconnected screen is incomplete.

## 19. Release gates for the organization/cabinet model

Before calling this architecture complete, automated tests must cover at minimum:

### Identity/context

- one user / multiple organizations;
- organization creation;
- invitation/join;
- active organization switching;
- branch switching;
- role switching where supported;
- session persistence;
- unauthorized deep link denial.

### Dental clinic

- owner dashboard;
- owner+doctor treatment approval;
- patient isolation;
- appointment workflow;
- diagnostic referral;
- dental lab order;
- finance visibility.

### Diagnostic center

- referral acceptance;
- scheduling;
- worklist;
- study status;
- report draft/finalization;
- authorized result delivery;
- economics.

### Medical laboratory

- order acceptance;
- specimen lifecycle;
- processing;
- validation;
- result release;
- settlement.

### Dental laboratory

- case inbox;
- case acceptance;
- production routing;
- technician workbench;
- QC;
- remake/delay;
- delivery;
- invoice/settlement.

### Cross-organization security

For each organization type:

`A can read/write A; A cannot read/write B unless an explicit authorized cross-organization workflow grants it.`

### Browser UX

- every sidebar item;
- every primary action;
- organization switcher;
- branch switcher;
- mobile navigation;
- loading/empty/error states;
- no console errors;
- no dead routes;
- no accidental redirects to clinic dashboard.

## 20. P0/P1/P2 execution plan

### P0 — Context and IAM foundation

1. Verify actual Prisma organization/membership model.
2. Verify `/me` and active organization contract.
3. Verify organization switcher and persistence.
4. Replace global-role assumptions with scoped role union.
5. Verify `OWNER + DOCTOR` clinical permissions.
6. Verify organization and branch isolation.
7. Generate canonical route inventory from source code.
8. Reconcile sidebar paths against route inventory.

### P1 — Cabinet vertical slices

Build and verify one complete operating slice for each:

1. Dental clinic.
2. Diagnostic center.
3. Medical laboratory.
4. Dental laboratory.
5. Supplier.
6. Academy.
7. Professional/jobs.
8. Patient/buyer.

A slice is complete only when onboarding → home → queue → workflow → persistence → permissions → audit → mobile behavior work together.

### P2 — Cross-organization workflows

Implement/verify:

- clinic ↔ diagnostic center;
- clinic ↔ medical laboratory;
- clinic ↔ dental laboratory;
- professional ↔ organizations;
- organization ↔ supplier;
- academy ↔ professional;
- organization ↔ finance/settlement.

### P3 — AI operating layer

AI must become context-aware for every first-class cabinet and must recommend or execute real actions through the same permission engine.

### P4 — UX hardening

- full route/IA verification from actual code;
- design-system convergence;
- responsive/accessibility/performance;
- browser console/network/runtime audit;
- Android parity/build/runtime;
- real 32-tooth WebGL/3D odontogram.

## 21. Definition of Done for a cabinet

A cabinet is **not done** because its route renders.

It is done only when:

`Entry → Context → Permission → Home → Queue → Entity → Workflow → Persistence → Notification → Finance/Outcome → Audit → Mobile → E2E`

all agree.

The owner must be able to answer from the cabinet:

- What is happening?
- What needs my attention?
- Who is responsible?
- What is late or at risk?
- What does it cost/make?
- What is the next action?
- What did DentVision already do?
- What requires my approval?

## 22. Documentation and implementation control

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

The repository must follow:

`Inspect → implement → test → fix → verify → document → continue`.

Generated files such as `docs/SYSTEM_MAP.md` are facts from code generation and must be regenerated rather than manually treated as product truth.

## 23. Competitive benchmark principle

DentVision may benchmark established products across domains for workflow maturity, but it must not copy their information architecture blindly.

The comparison axes are:

- time-to-first-value;
- workflow completeness;
- queue/worklist quality;
- entity history;
- collaboration;
- traceability;
- multi-location operation;
- role separation;
- financial visibility;
- integration;
- reporting;
- AI assistance;
- mobile usability;
- onboarding/support.

The goal is not “more screens”. The goal is that a clinic, diagnostic center, medical laboratory, dental laboratory, supplier or academy can run its real business from DentVision while participating safely in the larger ecosystem.

## 24. Final product invariant

**DentVision is one ecosystem with many legitimate centers of work.**

A clinic is not the parent of a diagnostic center. A diagnostic center is not an attachment to a clinic. A medical laboratory is not a hidden tab. A dental laboratory is not a status field inside CRM. A supplier is not only a Shop seller. An academy is not only a course list.

Each is an organization with its own:

`Identity → Team → Roles → Workspace → Queue → Workflow → Data → Economics → AI → Audit`

and each can connect to the others through governed ecosystem relationships.

This is the canonical direction for all future DentVision interface, route, IAM, database, API, AI and release decisions.