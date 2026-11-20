# DentVision — Cabinet UX & End-to-End Workflow Standard

**Status:** ACTIVE PRODUCT EXECUTION CONTRACT  
**Created:** 2026-11-20  
**Parent:** `docs/DENTVISION_MASTER_SPEC.md` v5.0  
**Execution sequencing:** `DENTVISION_EXECUTION_PLAN.md`  
**Evidence / gaps:** `docs/SYSTEM_AUDIT.md`  
**Related domain contract:** `docs/DENTVISION_LAB_PLATFORM_EXECUTION.md`  
**Applies to:** every existing and future DentVision cabinet, desktop, mobile and PWA.

This document records a standing product requirement: **every DentVision cabinet must be easy to understand and operate end-to-end, not merely contain the required pages.** It expands the cabinet law in Master Spec 5.0; it does not replace the Master Spec, create duplicate domain models, or certify current implementation.

## 1. Product rule — one ecosystem, many clear workspaces

A user should not have to understand DentVision's internal module structure. The system must understand the user's identity, active organization, branch, role, current work item and intent, then expose the next correct action.

The platform remains one ecosystem with:

- one person identity;
- multiple independent organization memberships and scoped roles;
- one explicit active organization / branch / workspace context;
- canonical records shared across the relevant cabinets;
- separate operational views for owners, operators, clinicians, technicians, candidates, students, buyers and platform staff;
- shared notifications, tasks, audit, files, finance and AI assistance, each scoped by authorization.

**A cabinet is an operating environment, not a collection of CRUD pages.** It must take a user from an incoming need through execution, handoff, result, communication and financial close-out where applicable.

## 2. Universal cabinet experience contract

Every cabinet, without exception, must follow the same underlying interaction model. The visible content and actions vary by role and domain.

### 2.1 Persistent context header

The header always makes clear:

- current organization and organization type;
- current branch when branch-scoped;
- active role/capability;
- current workspace;
- context switch action;
- notifications and help/AI access.

The context must remain visible on mobile. Switching context must refresh data, actions, AI context, notifications and finance scope together. Never silently choose the first membership when more than one valid context exists.

### 2.2 Today / Command Center

The home screen answers these questions in this order:

1. What requires my attention now?
2. What is overdue, at risk or blocked?
3. What is the next action I am allowed to take?
4. What is scheduled next?
5. What changed since I last visited?
6. What is the operational / financial result?

Prioritize **actionable work queues and exceptions**, not decorative KPI walls. KPIs support decisions; they do not replace the workflow.

Examples:
- diagnostic center: referrals to accept, studies to acquire/read, reports awaiting signature, equipment downtime;
- medical laboratory: specimens to receive, samples at risk, work awaiting QC, results awaiting authorized release;
- dental laboratory: new cases, due-soon production, work at QC, remakes, dispatch waiting;
- supplier: orders to accept/pick/pack, low stock, delivery exceptions, returns, settlement discrepancies;
- academy: cohort starts, learners at risk, attendance gaps, grading queue, certificates to issue;
- employer: new applications, unread candidate responses, interviews today, offers expiring.

### 2.3 Primary work queue

A cabinet must have a primary task list or board with:

- useful default sort (urgency, SLA, next action);
- clear status and responsible person;
- due date / time remaining where relevant;
- meaningful filters and saved views;
- search within the authorized organization/domain;
- bulk actions only where safe and permitted;
- direct open into the work-item detail;
- visible empty, loading, error and stale-data states.

Avoid making users click through several dashboard cards to find the queue they use all day.

### 2.4 Work-item detail workspace

Every important business object (study, specimen, lab case, order, product, course, application, offer) has a stable detail view containing:

- identity and current status;
- critical fields and originating party;
- assigned owner / next responsible role;
- due date, SLA and blocking reasons;
- complete ordered event timeline;
- attachments and version history;
- comments / communication appropriate to the role;
- next valid actions;
- linked entities (patient, referral, clinic, lab, product, payment, student, vacancy);
- audit-safe actor and timestamp evidence.

The detail view must be the place where the user finishes the work, not a read-only summary that sends them to unrelated pages for each action.

### 2.5 Actions and workflow language

- Each screen has one visually primary next action; secondary actions are grouped.
- Use domain verbs: “Принять биоматериал”, “Отправить на QC”, “Подписать заключение”, “Подтвердить доставку”, “Выдать сертификат”, not a generic “Изменить”.
- Explain why an action is unavailable and what prerequisite is missing.
- Destructive, financial, clinical, legal, release and externally visible actions require the correct confirmation and authorization.
- Do not ask the user to re-enter information already known in a canonical record.
- Preserve drafts and form state safely when moving between detail, tabs or temporary network failure.
- Use explicit cancellation, rejection, correction and retry paths. Do not silently overwrite an earlier event.
- The UI must never allow a transition that the backend state machine would reject.

### 2.6 Role-first, progressive disclosure

The default navigation is short and role-specific. Advanced operational areas appear only when needed or permitted.

- Owner/director: workload, exceptions, team, economics and controls.
- Operator/coordinator: intake, queue, assignment, communication and handoff.
- Specialist/technician: assigned work and the next production/clinical step.
- Reviewer/approver: QC, validation, sign-off and release.
- Cashier/finance: payment, invoice, settlement, refund and reconciliation.
- Student/candidate/buyer/patient: personal items and their own history, never organization administration.

A user who combines roles sees the union of authorized capabilities inside the same active context; the UI must not create duplicate accounts or force account switching.

### 2.7 Mobile and accessibility

Mobile is a designed workflow, not a compressed desktop table:

- show the active organization and role persistently;
- prioritize today's tasks, urgent exceptions and the next action;
- use full-screen work-item views, bottom sheets and sticky action bars;
- keep scanning, camera capture, file upload, barcode and signature flows practical;
- make tables transform into cards or focused lists;
- never hide a critical status or confirmation below an inaccessible hover;
- use readable touch targets, keyboard support, visible focus, labels and meaningful errors;
- support interrupted work and safe resumption.

The exact desktop and mobile layouts may differ; the domain state and permissions must not.

### 2.8 Shared system behavior

All cabinets use the shared platform capabilities instead of re-implementing them:

- scoped search and organization context;
- tasks, durable notifications and reminders;
- file access and immutable/audited document versions where needed;
- role/branch/organization authorization on every endpoint;
- shared finance ledger, refund and payout primitives where appropriate;
- idempotent event publication and retry;
- audit trail for every protected transition;
- AI that can explain, summarize, navigate and draft within the active scope;
- confirmation gates for clinical, legal and financial mutations.

## 3. Domain-specific operating contracts

## 3.1 Diagnostic Center OS — RIS/PACS, not just referrals

**Primary users:** owner/director, registration/front desk, modality technician, radiologist/diagnostician, cashier/finance, administrator.

### Owner / command center
- new referrals and bookings awaiting confirmation;
- today's schedule by modality, room and staff;
- equipment uptime / downtime and capacity;
- patients waiting, studies not acquired and reports not completed;
- reports awaiting signature/review;
- turnaround-time exceptions;
- services/pricing utilization;
- payments, receivables, settlement and profitability;
- staff workload and branch comparison.

### Main navigation
`Today · Referrals · Schedule · Worklist · Studies · PACS Viewer · Reports · Services & Prices · Equipment/Rooms · Staff · Finance · Analytics · Settings`

### Canonical diagnostic workflow
`Referral received → clinical/identity completeness check → accepted / clarification / rejected → appointment and modality slot → patient arrival / identity verification → modality worklist → acquisition → DICOM transfer and validation → radiologist worklist → interpretation → structured/free-text report → review/sign-off → authorized release → referring clinic/patient delivery → payment/settlement/reconciliation`.

### RIS requirements
- unique referral/order and accession identifiers;
- patient identity matching and duplicate detection;
- indication, modality, requested protocol, priority and referring professional;
- scheduling, preparation instructions and consent;
- queue position, assignment, SLA and cancellation/rebook reasons;
- traceable study-to-referral link;
- report status and correction/addendum history.

### PACS / DICOM requirements
- DICOM study/series/instance metadata and stable identifiers;
- secure DICOM receive/store/query/retrieve and modality worklist integration where supported;
- transfer validation, retry queue, duplicate handling and failed-transfer alerts;
- image viewer with series navigation, window/level, zoom/pan, measurements, annotations and comparison where clinically appropriate;
- role-scoped study access, audit of viewing/export and retention controls;
- report-to-study linkage and controlled release;
- interoperability and conformance testing against actual modalities and DICOM endpoints.

A generic image upload, referral attachment or report form is **not** a full PACS. Do not label RIS/PACS complete until real DICOM storage, query/retrieve, modality worklist, viewer, transfer reliability and modality acceptance tests exist.

### Equipment and employees
- equipment inventory, modality, serial/asset identifier, room, service status, maintenance/calibration dates and downtime reason;
- utilization and reservation;
- staff credential/role, shift, modality authorization and availability;
- work reassignment with audit history.

### Finance
- service price snapshots and payer/source;
- invoice/payment status, commissions/platform fees if applicable;
- settlement and payout reconciliation;
- refunds/adjustments with reason and original transaction link;
- revenue by modality, service, branch and period.

## 3.2 Medical Laboratory OS — specimen traceability and controlled result release

**Primary users:** laboratory owner/director, reception/accession staff, phlebotomist/sample collector, laboratory technician, quality controller, validating specialist, cashier/finance.

### Owner / command center
- orders awaiting acceptance;
- patients/samples expected today;
- specimens awaiting collection, receipt or routing;
- rejected / insufficient / mislabeled samples;
- processing queues and analyzer downtime;
- turnaround-time breaches;
- results awaiting QC, validation or release;
- critical values awaiting communication;
- QC/calibration alerts;
- outstanding invoices and settlements.

### Main navigation
`Today · Orders · Patients/Clients · Collection · Specimens & Barcodes · Worklist · Processing · Results · Validation/Release · Quality Control · Tests & Panels · Equipment · Staff · Finance · Analytics · Settings`

### Canonical specimen workflow
`Test order → identity/clinical validation → patient preparation → collection appointment / walk-in → specimen collection → barcode/accession → receipt scan → acceptance/rejection with reason → aliquot / container routing → processing → analyzer/manual result entry → QC and plausibility checks → technical validation → authorized clinical verification → result release → secure delivery to authorized requester/patient → invoice/payment/settlement`.

### Barcode and traceability requirements
- unique accession number and specimen/container barcode;
- label generated from canonical order and patient identity, never from free-form text;
- scan at collection, receipt, aliquot, department handoff, processing, QC, verification and release as applicable;
- chain-of-custody event with actor, timestamp, workstation/location and state;
- rejection, recollection, insufficient volume, hemolysis, contamination, transport excursion and relabeling reasons;
- specimen parent/child and aliquot relationships;
- no status change without the necessary scan/evidence when the policy requires it;
- complete reconstruction of “who handled this sample, when, where and why”.

### Processing and result requirements
- test catalog, panels, method, sample type, reference ranges and units;
- age/sex/patient-context-aware reference rules only where clinically validated;
- analyzer/manual result provenance;
- abnormal / critical flags, delta checks and validation notes;
- internal QC, external quality assessment, calibration and instrument maintenance;
- controlled corrected/amended results: preserve the prior released result, author, reason and recipient notification;
- dual verification / authorized release rules based on test and role;
- critical result escalation with recipient, time and acknowledgement;
- TAT monitoring and exception reason.

### Security and integration
Only authorized staff see the minimum patient information required for their task. HL7/FHIR and analyzer interfaces must be versioned, validated, retriable and audited; they must not silently create duplicate orders or overwrite released results.

A stage list ending in `verified` is not by itself a complete LIS. Barcode evidence, chain of custody, QC/calibration, validation, result amendments and release audit are mandatory proof.

## 3.3 Dental Laboratory OS — production, quality and delivery

**Primary users:** lab owner/director, coordinator/intake, designer/CAD technician, production technician, QC manager, courier/logistics and finance.

### Owner / command center
- incoming and incomplete cases;
- accepted cases with deadlines and capacity;
- production by department / workstation / technician;
- cases at risk of missing the clinic appointment;
- work awaiting QC;
- remakes by reason/cost/owner;
- dispatch/pickup due today and delivery exceptions;
- outstanding invoices, costs and margin by case/client.

### Main navigation
`Today · Inbox · Cases · Production Board · Design/CAD-CAM · Workstations · QC · Remakes · Shipping/Delivery · Clients · Services & Pricing · Materials/Inventory · Invoices · Finance · Analytics · Staff · Settings`

### Canonical case workflow
`Clinic order → identity/file/specification completeness → clarification if incomplete → lab acceptance / reject with reason → due date and capacity planning → department/technician assignment → design → manufacturing → interim checks → final QC → ready for dispatch → delivery/pickup tracking → proof of delivery → invoice → payment/settlement/reconciliation → clinic feedback`.

### Work order content
- requesting clinic, branch and authorized clinician;
- minimal patient identifier required by the work;
- teeth / units / restoration type and construction;
- material, shade, margin, occlusion, contacts and clinical notes;
- required scan/photo/impression files with version and provenance;
- expected delivery date, appointment dependency and priority;
- linked design/manufacturing files and remake lineage.

### CAD/CAM and production
- controlled upload and validation of STL/PLY/OBJ and other supported formats;
- scan/design version history and source linkage;
- milling/printing/manufacturing queue and workstation state;
- material/lot consumption where traceability is required;
- technician assignment, operation timestamps and rework state;
- capacity and deadline forecasting.

### QC, remake and delivery
- checklist by product/case type;
- QC result, responsible approver, measurements/photos and note;
- failed check creates a remake/repair request with reason, authorization, responsibility and cost treatment;
- preserve original case and all remake versions; do not overwrite the first failed attempt;
- clinic approval/rejection feedback where required;
- shipping method, carrier, tracking ID, dispatch timestamp, proof of delivery and recipient;
- pickup handoff evidence;
- delivery notification to clinic and durable timeline.

### Finance
- service price snapshot and case-level cost;
- invoice, tax/document status where required;
- payment allocation, settlement, payout and reconciliation;
- remake charge / warranty / responsibility treatment;
- gross margin by case, technician, service and clinic.

A production board plus QC checklist is a strong foundation, but it is not a complete dental-lab business until remake authorization, dispatch/proof-of-delivery, independent pricing/invoicing and settlement/payout close-out are proven.

## 3.4 Marketplace / Supplier OS — commerce and fulfillment

Separate experiences are required for:
- public buyer / clinic purchasing;
- supplier owner/manager;
- warehouse/picker/packer;
- delivery/fulfillment operator;
- finance and platform operations.

### Supplier command center
- orders awaiting acceptance;
- pick/pack queue and dispatch due;
- stockouts, low-stock and reservation conflicts;
- orders blocked by address/payment/verification;
- delivery tracking exceptions;
- return/refund requests;
- promotions ending and price anomalies;
- payout readiness and reconciliation discrepancies.

### Main navigation
`Today · Catalog · Products & Variants · Prices · Inventory/Warehouses · Orders · Picking & Packing · Delivery/Fulfillment · Customers · Promotions · Returns & Refunds · Finance/Payouts · Analytics · Team · Company Profile/Verification · Settings`.

### Product and stock
- canonical product/SKU, manufacturer, category and clinical/product attributes;
- variants, units, packaging, images/documents and compatibility;
- price/currency, price history, minimum order and offer rules;
- stock by warehouse/location, reservations, movements, receipts, write-offs and cycle counts;
- catalog moderation, company verification and public listing state;
- stock and availability must be sourced from inventory records, not a client-side count.

### Order and delivery workflow
`Cart → checkout validation → order/payment pending → accepted by seller → stock reserved → picking → packing → handoff to carrier/courier → in transit → delivered with proof → completed`.

Exception paths: partial fulfillment, seller rejection, stockout, delivery failure, customer cancellation, return, refund, chargeback and dispute. A multi-seller order must preserve seller-level allocations and fulfillment rather than pretending all items belong to one seller.

### Returns / refunds
- request reason, evidence/media, items/quantities and order linkage;
- eligibility and time policy;
- return merchandise authorization (RMA), pickup/return shipment;
- inspection and disposition (restock, damaged, warranty, reject);
- partial/full refund state and payment-provider evidence;
- stock, seller payable, platform fee and buyer balance adjustments;
- customer notifications and full event history.

### Finance and payouts
- gross sales, discounts, delivery, fees, tax and seller net amounts;
- supplier/platform split, order-level and item-level allocation;
- refunds/chargebacks and reversals linked to original sale;
- settlement only from verified financial events;
- payout request, approval, transfer evidence and reconciliation;
- daily/period closing and exception handling.

### Buyer UX
Search by clinical need/category/brand, compare trusted products/sellers, see stock and delivery promise, checkout without clinic SaaS onboarding, track orders, download receipts, raise a return and contact the seller. Never require a user to create a clinic just to browse or buy.

## 3.5 Academy OS — owner, lecturer, group and student

The academy operator and learner are two separate workspaces backed by the same account and canonical course/enrollment records.

### Academy owner command center
- active courses and publication readiness;
- cohorts/groups starting soon;
- enrollments and capacity;
- learner inactivity / at-risk progress;
- sessions awaiting attendance close-out;
- assignments/exams awaiting grading;
- certificate issuance queue;
- revenue, refunds, lecturer shares and payouts;
- instructor workload and schedule clashes.

### Main navigation
`Today · Courses & Versions · Cohorts/Groups · Students · Lecturers · Schedule · Attendance · Lessons & Materials · Assignments · Exams/Assessment · Certificates · Sales & Purchases · Finance/Payouts · Analytics · Team · Settings`.

### Course lifecycle
`Draft → content/learning outcomes configured → price/access policy configured → reviewed → published → versioned → enrolled learners → delivered → assessment → completed → credential issued`.

### Groups/cohorts
- cohort, intake, start/end, capacity and prerequisites;
- assigned lecturers/assistants and substitute coverage;
- timetable, live/onsite sessions and attendance;
- enrollment source and payment status;
- assignments, grading, feedback and due dates;
- progress and at-risk student alerts;
- cohort-level analytics without exposing students to one another.

### Assessment and credentials
- exam version, attempt limits, time window, pass mark and rubric;
- durable attempt, score, grader, feedback and appeal/correction history;
- attendance/completion prerequisites;
- certificate issuer, immutable number, verification code, issue date, expiry/revocation policy;
- public verification returns only credential-safe facts;
- payment does not automatically mean completion; exam pass alone must not imply state accreditation.

### Economics
Course sales, discounts, refunds, platform fee, academy revenue, lecturer share, payout readiness, payment references and reconciliation must map to the shared ledger. Changing a course price must never rewrite a learner's historical purchase price.

### Student and lecturer personal spaces
A student sees only their own purchased/granted courses, learning player, tasks, schedule, progress, exam attempts, certificates and purchase history. A lecturer sees only assigned courses/cohorts and learners they are authorized to manage, plus their own earnings. Neither role is forced into the academy owner dashboard.

## 3.6 Employer / Career OS — recruitment through employment

The employer workspace and candidate's personal career space must remain distinct but linked through durable, attributable events.

### Employer command center
- published, draft and expiring vacancies;
- incoming applications and source;
- candidates waiting for review;
- interviews today and candidate responses;
- offers awaiting response / expiring;
- employment documents awaiting signing;
- onboarding tasks and recruitment funnel metrics.

### Main navigation
`Today · Vacancies · Candidate Search · Applications/Pipeline · Invitations · Interviews · Offers · Contracts/Signing · Hired Staff · Onboarding · Analytics · Team · Legal/Settings`.

### Canonical hiring workflow
`Vacancy draft → legal/organization approval → publication → candidate discovery/application → screening → interview scheduling → interview feedback → versioned offer → candidate response → contract preparation → EDS/signature verification → employer authorization → hired record → onboarding`.

### Candidate-origin and employer-origin are different
- application submitted by the candidate;
- invitation sent by an employer;
- accepted invitation;
- scheduled interview and candidate response;
- formal job offer and response;
- employment contract with signature evidence;
- actual hire and onboarding.

Each event shows who initiated it, which organization/vacancy it refers to, when it happened and the candidate-visible explanation. The candidate sees closed vacancies and historical events without losing their history. Resume discovery requires active publication/consent; a recruiter cannot bypass it using a guessed ID.

### Contract and onboarding
A job offer is not an employment contract. Contract version, employer/legal identity, candidate, terms, signatories, EDS/provider verification, signed timestamp, document hash, revocation/correction and archive are separate. A UI checkbox or uploaded PDF without verified signature evidence is not EDS signing. Hiring and employee onboarding occur only after the required authorization and document process.

## 4. All other DentVision cabinets are in scope

The standard is not limited to the six areas above. Apply the same experience law to:

| Existing cabinet / experience | Required operating focus |
|---|---|
| Clinic owner / director | Today, staffing, chair utilization, revenue, branches, exceptions, approvals |
| Doctor / clinician | Schedule, patient, case, odontogram, treatment plan, diagnostics, lab, documentation |
| Reception / administrator | Check-in, waiting room, calendar, reminders, payments, handoff |
| Assistant / nurse | Assigned room, patient preparation, procedure support, stock and task checklist |
| Cashier / finance | Receipts, invoices, payment methods, refunds, cash close and reconciliation |
| Patient / buyer | Appointments, treatment explanations, results shared with them, payments, messages, purchases |
| Professional profile | Credentials, portfolio, consent, availability, learning and career |
| Lecturer / student | Course delivery vs personal learning, assignment and credential views |
| Community | Feed, professional connections, discussions, reporting, moderation and privacy |
| Platform superadmin / support | Organization verification, support queues, risk, abuse, audit, service health and governed controls |
| BI / Finance Hub | Role-appropriate measures, definitions, drill-down, ledger traceability and reconciliation |
| AI Workspace | Intent, active-context awareness, task execution, approval queue, citations/source links, undo/history and audit |

The same person may hold multiple roles, but the app must never mix another organization's patient data, another candidate's resume, another student's learning, or another seller's finance into the current workspace.

## 5. Cross-cabinet handoff contracts

A workflow that crosses organizations must produce explicit handoff evidence.

| From → To | Required handoff |
|---|---|
| Clinic → Diagnostic center | Authorized referral, patient/branch context, indication, service, priority, attachments, requested date |
| Diagnostic center → Clinic | Study reference, verified report, signer, status, delivery event and settlement reference |
| Clinic → Medical laboratory | Lab order, tests/panels, specimen instructions, responsible clinician and consent |
| Medical laboratory → Clinic | Accession/specimen status, verified result, critical alerts, release actor and audit |
| Clinic → Dental laboratory | Authorized case, tooth/specification, shade/material, scans/files and due date |
| Dental laboratory → Clinic | QC result, remake/delay events, delivery proof, invoice and settlement reference |
| Supplier → Buyer | Seller acceptance, stock reservation, tracking, proof of delivery, invoice and return channel |
| Academy → Student | Purchase/grant entitlement, course version, schedule, progress and issued credentials |
| Employer → Candidate | Invitation/interview/offer/contract as distinct, attributable events and candidate response |
| AI → Any cabinet | Draft/proposed action, policy check, user approval when required, execution result and audit |

The handoff must be idempotent, scoped, durable and visible to the next authorized participant. A shared notification cannot grant data access by itself.

## 6. Required audit method for every cabinet

For every existing workspace, audit the complete loop rather than evaluating a screenshot in isolation:

1. Discover entry route and correct audience.
2. Authenticate or allow public discovery where appropriate.
3. Select/create/join organization only when required.
4. Select branch and scoped role.
5. Verify contextual home and permitted navigation.
6. Open the primary queue and find a real item.
7. Open detail and confirm linked entities and history.
8. Execute the main happy path.
9. Execute rejection/cancel/redo/exception path.
10. Refresh, log out/in and switch organization; verify persistence.
11. Verify notification, assignment and cross-cabinet handoff.
12. Verify payment, invoice, refund, settlement or payout where relevant.
13. Verify audit and actor identity.
14. Verify unauthorized role, other-tenant ID, branch mismatch and expired/revoked access are denied.
15. Verify desktop, narrow mobile, touch targets, loading/empty/error/offline/resume states.
16. Verify AI uses only the active scope and does not bypass protected actions.

### Evidence levels

- **E0 — Listed:** route, tab or model exists.
- **E1 — Screened:** UI is usable and has meaningful states.
- **E2 — Persisted:** backend state and refresh/re-entry are correct.
- **E3 — Secure:** positive and negative role/context/tenant tests pass.
- **E4 — Operational:** external integration/provider/device and real operator workflow are verified.
- **E5 — Released:** exact-head CI/E2E/visual/mobile gates pass and production/legal/data operations are separately approved.

A cabinet cannot be declared complete from E0/E1. Source-level implementation, test evidence and external readiness must be reported separately.

## 7. Priority and release gates

### P0 — Trust and safety
- organization/branch/role isolation;
- minimum necessary data access and patient/candidate/student privacy;
- correct state machines and audit;
- verified payments/signatures/results;
- backup/recovery/retention and safe migration gates.

### P1 — Daily usability
- context header and clear navigation;
- Today/Command Center and primary work queue;
- complete item detail and next action;
- search, filter, assignment, due date and notification;
- loading/empty/error/offline/resume behavior;
- mobile daily workflow.

### P2 — Domain completeness
- modality/analyzer/CAD-CAM/carrier/calendar/provider integrations;
- QC, validation, remake, refund, delivery and settlement loops;
- team scheduling, productivity and analytics;
- exports and interoperability.

### P3 — Optimization
- advanced automation and AI-assisted prediction;
- workload balancing and smart recommendations;
- personalization, shortcuts and saved views;
- deeper cross-organization analytics.

Do not use P3 work to conceal missing P0/P1 guarantees.

## 8. Current source snapshot — 2026-11-20

This is a read-only classification of existing source evidence. It is not a production readiness statement.

| Cabinet | Confirmed in source | Still required / not release-certified | Current classification |
|---|---|---|---|
| Diagnostic center | Organization-scoped referral model, diagnostic workspace views for referrals, schedule/services/team/finance, sign-off/settlement-related services and access tests | Full DICOM store/query/retrieve, modality worklist, PACS viewer/transfer conformance, equipment lifecycle and complete RIS end-to-end evidence | PARTIAL |
| Medical laboratory | Separate workspace/routes; scoped technician/QC/validator/doctor capabilities; complete order-bound result entry; independent QC and validator release; failed-QC rework with archived prior results; separate doctor interpretation; candidate happy/exception-path E2E | Barcode/accession and scan evidence, full chain of custody and aliquots, QC/calibration programme, analyzer/equipment integration, critical-result acknowledgement, controlled amendment notification, settlement, mobile and exact-head production evidence | PARTIAL |
| Dental laboratory | Independent partner workspace, canonical LabOrder ownership, production stages, technician assignment and manager-controlled six-point QC with remake state | Closed-loop remake authorization/clinic feedback, dispatch/tracking/proof-of-delivery, independent pricing/invoices and payment/settlement/payout/refund reconciliation | PARTIAL |
| Marketplace / supplier | Public Shop, catalog, product/order primitives, supplier workspace tabs for sales/stock/returns/promotions/analytics/catalog/profile, checkout and refund-related server logic | Full verified-company onboarding, multi-seller allocation/fulfillment, real carrier delivery evidence, complete returns/RMA and seller/platform settlement/payout reconciliation | PARTIAL |
| Academy / lecturer | Course catalogue, course and enrollment records, lecturer workspace for courses/analytics/profile, payment settlement foundation | Academy owner operations for cohorts/groups, rosters, timetable, attendance, assignments/grading, durable assessments/certificates, refunds and lecturer payout reconciliation | PARTIAL |
| Student | Personal My Learning page and learning entitlement / assessment / certificate work on the current candidate branch | Exact-head CI, runtime and E2E verification; complete cohort calendar, homework, purchase/refund history and access-policy lifecycle | CANDIDATE IMPLEMENTATION |
| Employer / candidate | Employer organization/context, vacancies and application pipeline on main; separate invitations/interviews/offers and Career OS are being added on the current candidate branch | Formal contract/document/signature/EDS verification, hire and employee onboarding, vacancy lifecycle and final role/consent/mobile E2E | PARTIAL / CANDIDATE EXTENSION |
| Clinic / doctor / patient / reception / finance / admin / BI / community / AI | Existing route, module and model foundations | Each cabinet must pass the same full-loop audit; route existence is not acceptance evidence | AUDIT REQUIRED PER ROLE |

The generated System Map is an inventory, not a product-completeness score. Its 2026-11-20 main snapshot lists 69 mounted routers, 703 unique route handlers, 665 registered routes, 97 routes without a detected web/mobile consumer and 150 Prisma models. These counts do not demonstrate the end-to-end behavior or usability of the corresponding cabinets.

## 9. Acceptance gate: “Convenient and complete”

A cabinet passes only when a representative user can complete the main task without assistance and without leaving the active workspace unnecessarily.

For every core workflow, tests must cover:

- correct user/context entry;
- primary happy path;
- invalid or incomplete input;
- rejection/cancellation/redo;
- duplicate/retry/idempotency;
- stale/offline/reload recovery;
- other organization/branch/user access denial;
- notifications and linked workspace handoff;
- finance/document/result correctness;
- audit history;
- keyboard/accessibility and mobile use;
- AI suggestion versus authorized execution boundaries.

The acceptance report must identify role, organization type, branch, scenario, data fixture, expected state, actual state, evidence link and unresolved defect. “Looks good” is not an acceptance result.

## 10. Standing implementation instruction

For future DentVision work:

1. Read Master Spec v5.0 and the current Execution Plan first.
2. Identify the target role, active context and existing canonical entities.
3. Inspect the current route, page, API, schema, tests and related domain contracts.
4. Write the complete user journey before changing UI.
5. Reuse shared shell, design tokens, primitives, event/finance/audit infrastructure.
6. Do not add duplicate records or fake integrations to imitate completeness.
7. Implement the main flow and exception path together.
8. Add authorization, persistence, notification and negative tests at the same time.
9. Update this document / Execution Plan / System Audit with verified evidence and status.
10. Keep incomplete cabinets marked PARTIAL until their exact-head release and external readiness gates pass.

**Persistent product priority:** every cabinet that exists in DentVision must be intuitive for its intended role, operationally complete for its domain, safe across organization boundaries and genuinely usable on mobile. This requirement remains active across future sessions and must be re-read before new cabinet work.
