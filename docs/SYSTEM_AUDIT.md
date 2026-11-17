# DentVision System Audit

## Current source reconciliation — 2026-11-15

**Audited repository:** `drtamirlan911-cell/DentVision1`  
**Main source snapshot:** `4bbd61a339d5f3c4d40d1d5990f633a7b9a87864`  
**Normative product target:** `docs/DENTVISION_MASTER_SPEC.md` v5.0  
**Method:** read-only source comparison across the canonical product/AI/CRM/Marketplace/School/Community/Jobs specs, IAM and branch contracts, legal/economics/security documents, route tree, representative frontend workspaces, backend routers/services, Prisma-linked model usage, E2E suites, Android source inventory, generated System Map and exact-main GitHub CI/Quality Gate.

This checkpoint supersedes the September 28 baseline and the October/November historical matrices below where they conflict with the current source. It does not certify production deployment, staging data migration, live payment-provider behavior, or Android device runtime.

### 1. Current technical inventory and verification boundary

| Evidence | Current source result | What it proves / does not prove |
|---|---:|---|
| Backend routers mounted | 69 | Server module breadth; not completeness of workflows |
| Unique route handlers | 695 | Backend API inventory |
| Registered HTTP routes | 655 | Mounted endpoint inventory |
| Routes without a detected web/mobile consumer | 98 | Potential integration/consumer gap; requires per-route triage |
| Prisma models | 150 | Persistence model count; not data integrity or runtime evidence |
| Background jobs | 12 | Scheduled/worker inventory |
| Frontend route declarations in `src/index.tsx` | 248 | Static route declarations |
| Route declarations using `<Navigate>` | 162 | Redirect/alias declarations; not all are defects |
| Markdown documents in repository tree | 102 | Documentation inventory as of the audited source tree |

**Exact-main release evidence:** CI [43496476996](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/43496476996) and Quality Gate [43496477034](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/43496477034) both completed successfully on the audited main SHA. This is strong automated source/CI evidence. It does not mean all product requirements are complete or that production/staging/device/provider operations were performed.

### 2. Cabinet-by-cabinet implementation classification

Status vocabulary: **Implemented slice** means a real workflow with source and test evidence exists; **Partial** means the cabinet has working components but misses one or more Master Spec Definition-of-Done stages; **Not verified** means available evidence is insufficient. No cabinet is marked complete merely because its route renders.

| Participant / cabinet | Confirmed implementation in current source | Current classification | Remaining material gaps |
|---|---|---|---|
| Clinic owner / director | CRM pages for schedule, patients, cases, staff, inventory, billing/cashier, documents, treatment plans, marketing and settings; clinic owner E2E journeys | **Partial** | One owner Command Center across operations, approvals, branches and partner bottlenecks; full branch-level visibility for every clinical/financial record; end-to-end growth and reconciliation |
| Doctor | Patient/clinical case, visit, treatment-plan, dental-chart and diagnostic referral surfaces; clinical AI tools; doctor-scoped diagnostic sign-off | **Partial** | Full clinical graph continuity, confirmed specialist AI workflows, full imaging/3D and offline/mobile parity; not all treatment stages are proven by one E2E journey |
| Reception / administrator | Schedule, patient inbox, reminders, patient creation and appointment APIs; Reception persona and appointment tools | **Partial** | Durable communications/WhatsApp status and exception queue, waitlist/no-show automation, fully demonstrated role-specific scope across web/mobile |
| Diagnostic center / radiologist | Diagnostics workspace with referrals, calendar, results, services, payments/cashier, finance/team tabs; AI result draft and doctor/partner signing contracts | **Partial** | Complete modality/equipment/room worklists, acquisition and viewer, RIS/PACS/DICOM interoperability, complete radiology SLA/report/economics lifecycle |
| Medical laboratory | Separate workspace; order/result detail, sample collection/receipt, processing, result, verification and interpretation endpoints | **Partial** | Canonical accession and chain-of-custody, explicit QC/reject/recollect/release gates, equipment/reagent inventory and validated settlement; current lifecycle does not yet prove the full Master Spec specimen state machine |
| Dental laboratory / technician | Independent partner workspace, assigned work orders, technician assignment, production states, event history, QC checklist/sign-off, remake/delay states; PARTNER-003 E2E | **Partial — QC implemented** | Remake authorization/feedback closure, dispatch/shipping/pickup tracking and proof of delivery, independent services/pricing, invoice/payment/settlement/payout/refund, complete owner/manager/technician/designer/QC/finance matrix and mobile acceptance |
| Supplier / manufacturer | Supplier workspace with product/catalog CRUD, stock, orders/status, promotions, analytics, wallet/payout request, delivery zones and insights | **Partial** | Full seller onboarding/KYB to verified catalog publication, complete fulfillment/returns/refunds, provider-backed settlement and partner-margin/ledger reconciliation; manufacturer is currently grouped into supplier UX |
| Academy owner / lecturer | Learner School catalogue, courses, webinars, office courses, textbooks, enrolments, exams, certificates, tutor/homework review; lecturer workspace for offers/profile/payouts | **Partial** | Distinct academy-owner operating centre, cohort/student/assessment/content pipeline, complete live/practical/certificate verification, finance settlement and organization-wide progress evidence |
| Student / professional learner | School course discovery, enrolment, lesson/exam/certificate surfaces and professional profile connections | **Partial** | A complete learning-to-credential-to-profile-to-job loop, independently verified certificate trust and progress lifecycle |
| Patient / buyer | Patient portal, treatment presentation, booking, Shop orders/favorites, profile and notifications; consumer context policy for Academy/Shop | **Partial** | One personal command center for appointments/results/payments/messages/orders, patient access/export/consent/deletion lifecycle and complete consumer audience-negative tests |
| Employer / recruiter | Employer self-service registration API and basic Jobs listing/application APIs; Employer is an onboarding intent | **Incomplete / Partial** | The frontend employer intent currently routes to `/jobs`; vacancy creation is not demonstrably gated by an employer/recruiter workspace. Backend Jobs router has only list, own applications, employer register, generic create and apply handlers. Missing employer inbox, application status pipeline, interviews, offers, hired/rejected, vacancy edit/close, recruiter permissions and hiring E2E |
| Job seeker / candidate | Jobs listing/search/city filter, resume-style post, application and own-application listing | **Partial** | Candidate profile/preferences, saved jobs, matching/alerts, messages and complete application-state lifecycle |
| Community participant | Feed, thread/media-kind posts, likes, saves, comments, DM unread/conversations/messages | **Partial** | Follow graph, nested thread/reply model, stories, media upload/moderation/consent and professional-discovery controls are not proven as a coherent social network |
| Marketplace buyer | Catalog/product, checkout, orders, favorites, supplier directory and buyer cancellation | **Partial** | Cancellation is intentionally restricted to pending COD/no-payment-intent orders; provider-confirmed void/refund for paid/processing online orders, multi-seller fulfillment/returns and full CRM procurement reconciliation remain incomplete |
| Finance / partner finance | Wallets, transactions, partner economics dashboards/reconciliation/transparency, ledger health, commission rules, payouts and expenses | **Partial** | Complete accepted → paid → settled evidence for medical analysis and dental lab, provider callbacks, refunds/chargebacks and reconciled organization-specific commercial ledgers |
| Platform Superadmin | Admin console, platform finance, BI, security/compliance, audit, AI governance, ops/support surfaces | **Partial** | Complete control-plane negative authorization tests, verified administrative runbooks and audited live legal/verification/payment operations |
| Legal / trust operations | Legal routes, template/document/partner/consent structures, partner agreement/DPA/NDA/SLA and signature evidence concepts | **Partial / runtime not verified** | Versioned auto-package issuance, authority proof, Kazakhstan-compatible electronic-signature provider verification, renewal/suspension/termination and live legal-evidence lifecycle |
| Android | Native Kotlin app with repositories/APIs and screens across CRM, diagnostics, Shop, School, Jobs, Community, supplier, finance, profile and AI; separate Android CI builds preview APK | **Broad surface; parity/runtime not verified** | Actual install/device-runtime test, role/context journeys, parity against each web capability, offline support boundaries, device-specific accessibility and final release evidence |

### 3. Confirmed information-architecture breaks

The Master Spec allows canonical route aliases when they lead to the same real workflow; it does not allow an alias to masquerade as an implemented capability.

The current `src/index.tsx` route tree declares 248 routes, including 162 redirects. Several target routes that represent distinct public/discovery entities currently redirect to generic destinations:

- `/organizations` and `/organizations/:organizationId` redirect to `/settings`, so the Master Spec organization discovery/public profile contract is not delivered at those canonical destinations.
- `/professionals/:professionalId` redirects to `/profile`, so a public professional detail route is not implemented there.
- `/services/:serviceId` redirects to `/shop`, not a service-specific detail destination.
- Many `/medical-lab/*`, `/dental-lab/*`, `/academy/*`, `/employer/*` and `/business/*` declarations intentionally consolidate to a workspace route. They must be counted as implemented only when the selected workspace exposes the relevant queue/tab/action—not just because the redirect resolves.

Do not mechanically create a separate page for every target route. Reconcile each path to one canonical workspace, tab, entity view or explicitly gated capability; preserve one source of domain truth.

### 4. Cross-cabinet findings

**Identity / onboarding.** `src/pages/Onboarding.tsx` is a real unified entry supporting creation of clinic, diagnostic center, medical lab, dental lab, supplier and academy organizations, plus personal professional, patient, jobs, student and employer intents, invite lookup and join. This is a significant implementation, not an absent feature. The remaining gaps are the incomplete Master Spec organization taxonomy (e.g. medical organization/professional group/manufacturer as distinct first-class types), and the employer intent's route/API integration into an employer workspace and recruiter lifecycle. `src/components/OrganizationOnboarding.tsx` is an older narrower CENTER/LAB flow and must remain a domain-specific adapter, not be confused with the unified entry.

**Active context / IAM.** The unified Person/PersonRole/Organization foundation and partner role registry exist. The branch contract explicitly states that branch management is ahead of branch propagation to all clinical/operational records; branch objects alone are not proof of cross-branch isolation for patients, appointments, inventory, billing, lab orders and analytics. The full negative matrix remains a release requirement.

**AI operating layer.** The eight operational personas and a registry/orchestrator/tool execution path exist in source, including streamed provider responses and confirmation-aware actions. This is beyond a decorative chatbot. It does not prove every role-specific task has an active tool and E2E path, that every domain receives its own queue-aware AI, or that the entire AI agent DAG/governance/long-term memory contract is complete. Legacy clinic-only fallbacks and all persisted PHI readers/writers remain subject to the RB-029 scope audit.

**Clinical graph.** Clinic → diagnostics and clinic → dental-lab handoff are represented by shared entities and partner workflows. Clinical continuity is not yet proven for every chain in Master Spec §12 (diagnosis → imaging/AI findings → plan approval → procedures → lab/materials → payment → follow-up/outcome).

**Economics.** Financial surfaces exist, and the canonical policy correctly prohibits recognizing dental-lab commission at delivery alone. Dental-lab delivery is operational completion, not a settlement event. The medical-analysis and dental-lab settlement paths still need durable provider-backed evidence and reconciliation.

### 5. Release and security posture

- **RB-037 clinical diagnostic sign-off:** resolved in merged code and exact-head CI/E2E; do not leave older lower sections marking it open. Current evidence is recorded in `docs/security/RB-037_CLINICAL_DIAGNOSTIC_SIGNOFF.md` and the reconciled blocker register.
- **RB-029 PHI:** remains P0/open. New-write encryption improvements and guarded backfill utilities do not prove historical inventory, key lifecycle, retention/export/deletion, backup/restore, rollback and approved staging reconciliation. No historical PHI backfill was executed as part of this audit.
- **D1/D2 trial/archive, RB-031 WebKit/CORS/WebSocket, RB-033 repository branch protection, RB-035 full role/tenant/branch/session negative matrix, official Kaspi merchant contract/callback, Android device runtime, and D10 remaining lab operations** remain open/partial pending their specific evidence. Do not close them using an unrelated main CI pass.
- Main CI and Quality Gate are green on the audited SHA; PR #347's separate PHI branch has its own independent, still-running exact-head CI at the time this audit was prepared. Do not mix those results.
- No production/staging database, medical record, key, secret, payment provider, live contract or deployed runtime was modified or queried.

### 5A.1 Candidate remediation overlay — PR #348 (not merged)

The preceding Jobs/employer gap analysis is correct for the audited `main` baseline SHA, but the same audit branch now contains a candidate implementation that addresses the structural gap. Do not continue repeating the old main-baseline finding as the current branch state.

- Employer self-service creates an `EMPLOYER` Organization and returns the canonical organization context.
- Employer owner/recruiter/viewer roles and scoped invitations are wired into IAM.
- Job vacancies have an additive `employerOrganizationId` relation; employer listing, candidate discovery, application reads and constrained application transitions are organization-scoped and audited.
- A dedicated employer workspace is mounted at `/employer`; the E2E candidate covers onboarding, invitation, authorization boundaries, legal activation, pipeline and cross-employer isolation.
- Publication/candidate discovery require verified lifecycle and legal owner/platform signature state. The repository's legal templates are still DRAFT, so the gate is intentionally closed until authorized legal approval and signature evidence exist.
- Candidate verification on the previous PR #348 HEAD: backend/frontend lint, lint-test and Quality Gate passed; the E2E job's first suite failed while later role/context and visual/owner gates were still in progress. The documentation-only follow-up changes require a fresh exact-HEAD CI. Employer status therefore remains **candidate implemented / E2E not yet certified**.

This overlay does not change the historical main-baseline inventory above, and it does not authorize merging PR #348 or activating real employers before legal review.

### 5A. Additional cross-cutting findings — documents, Jobs and AI Employee

**Legal documents and partner activation.** The repository contains 16 Legal Engine Markdown files: the registry, patient personal-data/AI consents, partner agreements, DPA, NDA, SLA, marketplace offer and public policies. The inspected registry and templates declare `status: DRAFT` and `requires_legal_review: true`. These are template assets, not approved/effective agreements or proof of a valid signature/consent workflow. The legal partner lifecycle must remain a release blocker until counsel approves applicable versions, published-only template selection is verified, signer authority/evidence is tested, and an appropriate Kazakhstan-compliant signature/acceptance method is approved. Never auto-promote a draft to published/approved in code.

**Jobs / employer identity is a structural gap, not just missing tabs.** Current `JobEmployer` bootstrap creates an Organization with `type: CORPORATE`, `originalType: JobEmployer`, a Person, and a PersonRole. However:
- `dentvision-backend/src/modules/iam/contexts.ts` does not map `CORPORATE` / `JobEmployer` to a first-class employer scope.
- The employer bootstrap creates PersonRole without organization `scopeType`, `scopeId` or canonical `scopeKey`, while the current organization-context resolver expects organization-scoped roles.
- `JobVacancy` has only `userId` and optional `clinicId`; it does not have a canonical employer Organization relation/owner field.
- Generic authenticated `POST /api/jobs` creates a vacancy or resume from caller-supplied `clinicName` without a verified employer/recruiter context. The backend has no employer-owned vacancy inbox, application status mutation, interview, offer or hire lifecycle endpoints.
- The frontend employer intent routes to `/jobs`, and current generic post UI does not prove integration with `/api/jobs/employers/register`.

This requires a bounded identity/schema/API/UI/E2E implementation before claiming an employer workspace. Do not fix by trusting a clinic/company name string or adding a global role fallback. Preserve candidate resume posting as a separate, privacy-scoped capability.

**AI Employee work queue exists, but is not ecosystem-wide.** The durable `ai_employee_tasks` table/migrations, service, event subscriber, idempotency index, clinic-scoped approval routes and frontend API/panel component exist. The subscriber preserves event provenance and intentionally avoids copying the raw event payload into another JSONB row. However the task input/table require `clinicId`, the subscriber ignores events without `event.clinicId`, and both task API endpoints require `req.user.clinicId`. This does not provide first-class work queues for independent diagnostic centers, medical/dental laboratories, suppliers, academies or employers. The task panel/component exists, but mounting as the default home surface in every participant workspace is not proven by the audited route component. Keep classification **implemented clinic slice / ecosystem coverage partial**.

**Document-age reconciliation.** `docs/AI_REPORT.md`, `docs/REFACTOR_PLAN.md` and `docs/TECH_DEBT.md` originate from July 2026 and contain pre-migration architecture/backlog claims that no longer match current paths/runtime; the AI report and the June/July technical debt list must not be used as live defect inventories. `docs/CONTINUATION_STATE.md` is a September 14 checkpoint for branch `feat/iam-role-matrix-v2` / PR #275 and is historical, not the active continuation source. The October/November RBAC, auth and compliance audit tables also contain historical gap rows; each requires current-source revalidation before reopening a defect.

### 6. Audit conclusions and execution priority

**The repository is a substantial platform foundation, but it does not yet meet all Master Spec 5.0 Definition-of-Done requirements.** The main gaps are end-to-end workflow depth, first-class partner operations, employer/job lifecycle, public discovery, role/branch isolation, full financial settlement and measured runtime parity—not merely missing screens.

Execution order:

1. Keep RB-029/P0, active-context IAM and all clinical/financial write boundaries fail-closed; complete historical PHI inventory and approved staging plan before backfill.
2. Complete the partner/branch negative IAM matrix and verify WebKit, CORS/WebSocket and repository protection separately.
3. Close medical-lab chain-of-custody/validation/release and diagnostic-center modality/worklist/report lifecycle.
4. Finish dental-lab remake, delivery logistics, service/pricing, invoice/settlement/payout and durable notifications; preserve the settlement-only economics boundary.
5. Complete employer/recruiter onboarding, permissions and application pipeline; correct vacancy publication authorization before expanding Jobs.
6. Complete Marketplace refund/fulfillment and Academy economics/credential lifecycle.
7. Reconcile public organization/professional/service discovery routes with real pages or explicit product decisions.
8. Verify Android preview install/runtime and compare the same role/workflow matrix with web.
9. Finish route/visual/accessibility/performance and all remaining release evidence on one exact final HEAD.

A document-only source audit does not qualify any cabinet as production-ready. Use the Master Spec DoD chain for every new closure claim.

---


**Date:** 2026-09-28  
**Audited ref:** `refactor/master-spec-v5-organization-scope`  
**Audited HEAD:** `b976272185cd7222c479a3bb0d237ec1523c2505`

## 1. Authority hierarchy

The audit uses this hierarchy:

1. `docs/00_CONSTITUTION/02_PRODUCT_DNA.md` — constitutional quality law.
2. `docs/DENTVISION_MASTER_SPEC.md` — canonical product/system truth, v5.
3. `DENTVISION_EXECUTION_PLAN.md` — sequencing and Definition of Done.
4. `DENTVISION_CONTEXT.md` — verified current state.
5. `DENTVISION_EXECUTION_LOG.md` — evidence/history.
6. `docs/business/DENTVISION_PARTNER_ECONOMICS.md` — economic policy.
7. Bounded IAM, branch, lab, legal, Android, design and security contracts.
8. `docs/SYSTEM_MAP.md` — generated code facts, not product direction.

Historical/superseded documents must not override the hierarchy above.

## 2. Target product

The intended output is not a clinic CRM with extra tabs.

DentVision is a **Dental Operating System and ecosystem for the whole dental industry**:

- one identity;
- multiple authorized organization/workspace contexts;
- organization and branch as security boundaries;
- role and permission scope per active context;
- one shared domain state;
- one AI/action layer;
- progressive disclosure rather than a feature catalog;
- first-class clinic, professional, patient/buyer, diagnostic center, medical laboratory, dental laboratory, supplier/manufacturer, academy/lecturer/student, employer/job-seeker and platform contexts;
- workflow-first cabinets rather than CRUD page collections;
- AI Workspace as the primary product surface;
- dedicated operational UIs that remain excellent when AI is unavailable;
- shared web/mobile business capabilities;
- auditable clinical, financial, legal and cross-organization workflows.

The canonical workflow shape is:

`Identity → Active Workspace → Organization → Branch → Role → Permission → Data Scope → AI Context → AI Session → Tool → Audit → E2E → Visual Evidence → Release`

A cabinet is complete only when:

`Entry → Context → Permission → Home → Queue → Entity → Workflow → Persistence → Notification → Finance/Outcome → Audit → Mobile → E2E`

## 3. Current architectural baseline

The repository already contains a substantial foundation:

- 68 mounted backend routers;
- 665 unique backend route handlers;
- 629 registered HTTP routes;
- 148 Prisma models;
- 12 background jobs;
- canonical Organization/Person/PersonRole IAM primitives;
- partner-specific IAM roles;
- branch authorization infrastructure;
- diagnostics, medical-lab and dental-lab lifecycle services;
- Marketplace, Academy, Jobs and Community APIs;
- AI OS orchestrator, role/persona registry, permission-gated tools and confirmation flow;
- patient portal;
- legal/trust routes;
- Finance and settlement infrastructure;
- web and Android surfaces.

This is a large implementation base, but repository breadth is not equivalent to product completeness.

## 4. Critical mismatches

### AUDIT-P0-01 — Product IA is still structurally clinic/legacy-route centered

**Evidence**

The Master Spec defines first-class contextual cabinets and target routes for Practice, Diagnostics, Medical Laboratory, Dental Laboratory, Business/Supplier, Academy, Professional/Jobs and Administration.

The current web route tree contains 96 declared React routes and is still centered on:

- `/crm/*`;
- `/diagnostics/*`;
- `/supplier`;
- `/school/*`;
- `/jobs`;
- `/community`.

The canonical target route inventory contains 165 routes. Exact-ish comparison finds only a small subset represented by the current route names; most target cabinet routes are not present as canonical routes.

This does **not** mean every target route must become a separate React page. The Master Spec explicitly allows reconciliation and progressive disclosure. It does mean the current information architecture has not yet been reconciled into the target cabinet model.

**Impact**

The application can still feel like several legacy modules mounted beside a CRM instead of one operating system with contextual cabinets.

**Required direction**

Do not create 165 pages mechanically. Map every target capability to a single canonical workspace/queue/entity/workflow and explicitly document which target routes are aliases, tabs, or intentionally consolidated surfaces.

---

### AUDIT-P0-02 — Self-service onboarding is not yet one unified frontend onboarding engine

**Evidence**

The Self-Service Organization OS requires one account → organization → membership model for all supported participant types.

The backend has a substantial `POST /api/organizations/self-service` implementation covering clinic, diagnostic center, medical/dental laboratory, supplier and academy organization creation.

The current `OrganizationOnboarding.tsx` UI, however, accepts only `CENTER` or `LAB` modes and creates only `diagnostic_center` or `medical_lab` organizations. Other participant onboarding remains in separate flows/components.

The current route tree also has no canonical `/onboarding`, `/organizations/new`, `/organizations/join` or `/context` routes described by the Master Spec; `/my-clinics` and other legacy/partner flows perform parts of that job.

**Impact**

The backend is moving toward the canonical Organization OS, but the user experience is still fragmented by participant type.

**Required direction**

Create one participant/intent onboarding engine with domain adapters. Preserve existing endpoints as compatibility adapters, but make the user journey converge on one model.

---

### AUDIT-P0-03 — AI OS has a canonical orchestrator, but legacy clinic-only AI paths remain active

**Evidence**

The current AI stack contains a strong OS layer:

- `ai/os/orchestrator.ts`;
- active organization/workspace context;
- role-aware tool access;
- confirmation-gated mutations;
- tool provenance;
- verification loop.

However, parallel AI infrastructure still requires clinic scope:

- `ai/types/ai.types.ts` defines `AIContext.clinicId` as mandatory;
- `ai/core/context.manager.ts` loads a Clinic and resolves clinic access;
- `ai/memory/memory.engine.ts` keys durable memory by `clinicId`;
- `ai/ai.routes.ts` contains clinic-only behavior for briefing, proactive alerts, digital twin, insights and several memory/learning paths;
- the same route file still constructs fallback clinic contexts and legacy `clinicId` session scopes.

The newer AI OS correctly distinguishes `organizationId`, `organizationType` and active workspace, but the older service surface remains a competing context model.

**Impact**

A non-clinic user can enter the new organization-aware AI path while parts of memory, briefing, insights or proactive behavior remain clinic-shaped. This directly conflicts with the Master Spec rule that AI context must follow the active organization/workspace and must work across first-class cabinets.

**Required direction**

Finish the AI context consolidation:

`User → Active Workspace → Organization → Branch → Role → Permission → AI Context → AI Session → Tool`

Use organization/workspace identity as the canonical memory/session boundary and keep clinic IDs only as domain identifiers where the underlying clinical model still requires them.

---

### AUDIT-P0-04 — Android is not yet the ecosystem client defined by the product contract

**Evidence**

`android/README.md` explicitly describes the native client as a **clinic CRM**.

The Android navigation catalog is dominated by the 19 CRM sections: schedule, patients, visits, medical card, dental chart, treatment plans, documents, finance, inventory, lab, staff, reminders, workflow, etc.

Android does have diagnostics, supplier, lecturer, school and operator routes, but it is not structurally equivalent to the web's ecosystem shell. The documented Android navigation still uses clinic-first assumptions and explicitly separates the clinic CRM as the core application.

The Master Spec and Product DNA require mobile to expose the same business capability through appropriate interaction patterns, with active organization/context visible and role-specific cabinets.

**Impact**

The mobile product is not yet a true mobile DentVision ecosystem client; it is primarily a clinic CRM client with selected ecosystem extensions.

**Required direction**

Make Android consume the same canonical IAM/context contracts as web and define mobile cabinet entry for every first-class participant type. Do not duplicate the backend or invent a second permission model.

---

### AUDIT-P0-05 — Partner workspaces exist, but several first-class workflows are still consolidated into generic Diagnostics/Lab surfaces

**Evidence**

The web contains real components:

- `DiagnosticWorkspace`;
- `MedicalLabWorkspace`;
- `DentalLabPlatform`;
- diagnostic referrals/results/calendar/statistics;
- dental-lab production/QC/remake/delay transitions;
- medical-lab specimen/result lifecycle.

But routing still exposes the laboratory side primarily through `/diagnostics/lab` and aliases such as `/diagnostics/lab-dashboard`. `LabDashboard.tsx` selects Medical Lab vs Dental Lab vs generic lab behavior internally.

The Master Spec defines dedicated first-class cabinets for Diagnostic Center, Medical Laboratory and Dental Laboratory, with distinct operational queues and workflows.

**Impact**

The underlying domain depth is ahead of the visible IA. A laboratory participant can still experience the product as a generic diagnostics sub-area rather than its own operating environment.

**Required direction**

Keep the existing lifecycle/domain implementations, but expose them through canonical contextual workspaces. Do not duplicate data models.

---

### AUDIT-P0-06 — Release evidence is not equivalent to product completion

**Current CI evidence**

- Quality Gate #4055: successful on HEAD `b976272185cd7222c479a3bb0d237ec1523c2505`.
- CI #3373: still running at the time of this audit.
- Frontend lint, backend lint/typecheck and lint/test portions of CI are already successful.
- E2E is still running; browser UX, mobile, role/context, visual-agent, business-owner, organization lifecycle and final visual evidence steps have not yet completed.

**Repository release blockers**

`docs/RELEASE_BLOCKERS.md` still lists open/in-progress P0 blockers for:

- medical/dental laboratory authorization/runtime verification;
- unnamed interactive controls;
- undersized mobile touch targets;
- complete visual/design evidence;
- browser role/context regression;
- mobile laboratory drawer visual recheck.

**Impact**

A green quality gate or build is not sufficient evidence that the whole Master Spec cabinet/product definition is complete.

**Required direction**

Keep release status gated on the complete E2E + browser + visual + security + production evidence chain.

## 5. Major P1 mismatches / incomplete depth

### AUDIT-P1-01 — CRM is implemented but remains only partially at the full Practice OS depth

The current CRM has substantial real screens and APIs: schedule, patients, cases, cashier/finance, inventory, documents, dental chart, treatment plans, lab, reminders, workflows and patient inbox.

However the Master Spec Practice cabinet also requires a coherent Today/Command Center, cases, diagnostics, lab, communications, branches, team, finance, analytics and AI as one contextual operating environment.

The current implementation still exposes these as `/crm/*` pages and a legacy CRM navigation model rather than a unified Practice cabinet.

The correct next step is IA/workflow consolidation, not replacing the existing CRM data model.

### AUDIT-P1-02 — Marketplace procurement is not yet the canonical one-action CRM → cart flow

The CRM Inventory page can identify low stock and navigate to a matching Marketplace product or search result:

- `/shop/:id` when a match exists;
- `/shop?q=...` otherwise.

The older Marketplace acceptance criterion requires creating a cart in one action from critical inventory. Current behavior is a product/search deep link, not a deterministic cart creation operation.

This should be implemented through the existing cart/order source of truth rather than a second procurement model.

### AUDIT-P1-03 — Academy has real learning primitives, but the full acceptance contract remains unproven

The current course UI supports lessons, video/text/PDF/test/exam/quiz/homework, enrollment, payment, progress, exams, certificates and an AI tutor call.

The Academy specification still marks these acceptance areas incomplete:

- Video + PDF + Test + Exam + Certificate as one complete flow;
- live sessions;
- practical assignments;
- AI Tutor in the full lesson context;
- local/international lecturer publishing;
- office-course registration/certification;
- owner visibility of employee progress.

The implementation should be tested end-to-end before these are considered complete; do not infer completion from the presence of UI controls.

### AUDIT-P1-04 — AI Agents OS is not yet at the documented multi-agent depth

The current registry/orchestrator is real and useful, but the bounded AI specification explicitly records gaps:

- no full DAG decomposition;
- no parallel agent chains/merge/conflict resolution;
- no separate Diagnosis/CBCT/Surgery/Prosthodontic/Orthodontic agent depth;
- incomplete Procurement/Supplier/Logistics agent layer;
- incomplete Course Builder/Mentor/Certification agent layer;
- no full Workflow/Scheduler server agent layer;
- no Knowledge Graph/Research agent layer;
- registry remains substantially hard-coded.

This is a documented product-depth gap, not a release-blocking reason to rewrite the current orchestrator. The next implementation should deepen the existing registry/tool architecture.

### AUDIT-P1-05 — Canonical schema migration is not finished

`docs/UNIFIED_SCHEMA_DEPRECATION.md` explicitly defines Phase C as module-by-module migration from legacy Clinic/ClinicMember/SupplierMember/DiagnosticCenterMember/LaboratoryMember/Lecturer reads to Organization/Person/PersonRole.

The current code still contains deliberate legacy compatibility reads. Examples include:

- AI context workspace inventory;
- branch authorization for legacy clinic branches;
- domain models whose source-of-truth identifiers remain `clinicId`;
- legacy partner membership fallback.

This is acceptable during Phase B/C, but it means the canonical Organization graph is not yet the sole runtime source of truth.

Do not drop legacy tables until all modules are migrated and regression-tested.

### AUDIT-P1-06 — Organization/branch support is ahead of its visible product surface

The backend has canonical branch CRUD, authorization, member assignment, workspace entry, archive semantics and branch billing policy.

The web exposes organization/branch settings through the Settings surface rather than the canonical target route structure. This is acceptable as progressive disclosure, but the full Owner → Organization → Branch → Staff → Operational workspace vertical slice remains release-gated in the Execution Plan.

### AUDIT-P1-07 — Workspace switcher vocabulary does not cover the full Master Spec organization taxonomy

The current web `WorkspaceSwitcher` explicitly models:

`CLINIC, DIAGNOSTIC_CENTER, LABORATORY, SUPPLIER, LECTURER, ACADEMY, PARTNER`

The Master Spec organization model also defines:

`MEDICAL_ORGANIZATION, MANUFACTURER, EDUCATION_CENTER, EMPLOYER, PROFESSIONAL_GROUP`

These types are not first-class in the current switcher.

The correct solution is not to add empty menu entries. Add them only together with real workspace templates and workflows.

There is also a concrete route mismatch: the switcher sends `ACADEMY` contexts to `/school-workspace`, while the current web route is `/school/workspace`. This must be corrected or explicitly aliased.

## 6. Product areas that are materially present

The audit does not classify everything as missing. The repository already has meaningful implementation in:

- public-first Welcome and authenticated AI entry;
- CRM core workflows;
- treatment cases and treatment plans;
- dental chart persistence;
- diagnostics referral/result lifecycle;
- medical laboratory lifecycle;
- dental laboratory production lifecycle;
- supplier workspace;
- Academy course/enrollment/exam/certificate/tutor surfaces;
- Marketplace catalog/cart/checkout/order surfaces;
- Jobs and Community real API workflows;
- patient portal;
- organization/branch IAM;
- audit/compliance infrastructure;
- legal/trust backend lifecycle;
- AI OS orchestration and confirmation gates;
- Finance/settlement foundations.

The problem is the distance between these implemented vertical pieces and the single coherent operating-system experience defined by the canonical documents.

## 7. Documentation audit

### DOC-01 — Canonical hierarchy is not completely clean

The root README and Master Spec state that the Master Spec is the single normative Product/System source of truth.

At the same time, `docs/spec/README.md` calls the older platform specification “Canonical Product Specification”.

The older `docs/spec/*` documents contain useful bounded requirements and acceptance criteria, but their authority should be explicitly subordinate to the Master Spec unless intentionally reconciled.

### DOC-02 — Some release/status documents are historical snapshots

Several dated constitution/release notes contain older commit/run references. They should remain evidence/history, not be interpreted as current state.

The current state must come from HEAD + fresh CI/runtime evidence + `DENTVISION_CONTEXT.md` updates.

### DOC-03 — Generated facts and normative judgments are correctly separated

`SYSTEM_MAP.md` states that it contains code-derived facts and that judgments belong in `SYSTEM_AUDIT.md`. This audit establishes that missing artifact and follows that separation.

## 8. Target architecture for the next phase

The repository should converge on one runtime graph:

`Identity
→ Active Workspace
→ Organization
→ Branch
→ Role
→ Permission
→ Data Scope
→ Domain Entity
→ Workflow Queue
→ AI Context
→ AI Session
→ Tool/Action
→ Confirmation
→ Execute
→ Verify
→ Audit
→ Notification
→ Finance/Outcome`

The web and Android surfaces should be projections of this same graph, not separate product architectures.

### Priority order

1. Finish current CI and close the remaining release-gate evidence.
2. Remove the remaining AI clinic-only context/session/memory paths from the canonical AI execution surface.
3. Finish unified Organization/Person/PersonRole migration module-by-module without destructive legacy-table removal.
4. Make onboarding one participant/intent engine.
5. Reconcile web IA into canonical contextual cabinets without creating duplicate pages/models.
6. Make diagnostic center, medical lab and dental lab distinct first-class workspaces over the existing domain models.
7. Complete Marketplace procurement loop and Academy acceptance matrix.
8. Bring Android to parity with the ecosystem context model.
9. Finish legal/trust, finance and branch vertical-slice production evidence.
10. Only then perform final visual/mobile/production release certification.

## 9. Post-audit corrections already applied

The following concrete findings were corrected after the initial audit:

- AI streaming session persistence now uses the same canonical `aiSessionScope(req)` as normal AI queries, so supplier/lecturer/other organization sessions are not re-saved under a null/stale clinic scope.
- AI memory list/delete/clear and feedback persistence now use the active AI workspace scope instead of raw `req.user.clinicId`.
- AI Workspace visibly shows the active workspace name, not only `clinic.name`.
- Academy context switching now uses the canonical `/school/workspace` route.
- The old `/school-workspace` path is retained as a redirect alias to prevent stale links/bookmarks from becoming a dead route.

These fixes reduce the current AI/context and routing gaps, but they do not close the broader P0/P1 items described above.

## 9.1 Convergence fixes after the first audit

Additional implementation now in the branch:

- Added a canonical `/onboarding` entry using the existing backend self-service Organization API for clinic, diagnostic center, medical laboratory, dental laboratory, supplier and academy creation.
- The onboarding surface supports both Create and Join-by-invitation and therefore converges participant onboarding on Organization → Person/PersonRole → Branch rather than maintaining separate registration products.
- Critical inventory restock now enters the existing Marketplace cart and checkout when a deterministic product match exists.
- Mobile workspace switching copy no longer tells non-clinic users to “create a clinic”; it uses organization-neutral terminology.
- AI optional sidecars no longer invalidate the authenticated session when their best-effort requests receive an authorization error.

## 9.2 Jobs employer vertical slice — candidate branch PR #348

This section records candidate-branch implementation, not the audited `main` baseline above and not a production/release certification. The branch remains a Draft pull request until exact-head checks and review are complete.

**Implemented in the candidate source**
- Employer onboarding creates a first-class `EMPLOYER` Organization through the canonical self-service Organization flow and issues an active organization context.
- Employer access is organization-scoped. The owner/recruiter/viewer role family is governed by the existing IAM permission model; invitations cannot grant owner or platform roles.
- Vacancy publication and employer candidate discovery require the employer lifecycle/verification state and the required owner/platform signature flags. Public employer vacancy discovery independently checks active lifecycle, verification, ecosystem visibility and both legal signature flags.
- The employer workspace supports status display, vacancy creation/listing, per-vacancy applicant inbox and valid application-stage transitions: `new → reviewing → interview → offer → hired`, with rejection available from the allowed stages.
- Candidate resume publication remains a separate `kind=resume` flow. The employer resume API returns a limited field projection rather than candidate email/user identifiers.
- Vacancy creation and application-status changes write their audit events inside the same Prisma transaction as the business mutation. Candidate resume creation and first application submission have now been brought under the same transaction/audit contract; idempotent retries that return an existing application do not create duplicate audit events. Dedicated route tests cover all four write paths and audit failure behavior. Exact-head CI remains the release verification gate.

**Android parity correction (candidate branch)**
- The web Jobs page now exposes a separate candidate entry point for resume publication and an owned-resume list with an open/closed visibility control. Backend `GET /api/jobs/me/resumes` and `PATCH /api/jobs/me/resumes/:id/status` are owner-scoped; visibility changes and their audit events share one Prisma transaction. The E2E lifecycle covers owner isolation, close/hide from employer discovery, and re-opening.
- The Android Jobs screen exposes the public market, text/city search, own applications, application submission and candidate resume publication. It still lacks the owned-resume list/visibility control and the employer workspace, verification status, employer vacancy inbox and pipeline.
- Source review found that the former Android post form also exposed a “Вакансия” choice but sent it to generic `POST /api/jobs`. That route deliberately rejects vacancy creation; only candidate resumes are accepted there. The Android form is now explicitly resume-only, its generic request defaults to `kind=resume`, and the non-persisted free-text “your name” field was removed because the backend derives the candidate name from the authenticated account.
- A second response-contract mismatch was corrected: the resume-create route returns `{ ok, data }`, unlike the flat Jobs list/apply routes. Android now decodes the `ApiEnvelope<JobVacancy>` and unwraps it via `apiCall`; a decoder contract test covers the actual response shape.
- Candidate visibility changes accept only `open` or `closed`; the update is constrained by both the authenticated user ID and `kind=resume`. Another user's resume, or a vacancy, returns 404. Repeating an unchanged status does not write a duplicate audit event.
- Added `JobsRequestContractTest` to protect the mobile generic-post contract. This is a safety correction, **not** completion of the Android employer cabinet. A mobile employer workspace must later bind to the active Organization context and use the verification-gated employer endpoints; it must not bypass legal/RBAC gates.

**Evidence and remaining limits**
- `e2e/tests/jobs-employer.spec.ts` contains `JOBS-EMPLOYER-001`: employer onboarding, recruiter invitation/context, legal activation gate, vacancy creation, candidate resume publication/discovery, application pipeline, cross-employer isolation and public-visibility revocation.
- Candidate discovery is now integrated into the verified web employer workspace: it loads open resumes and supports client-side filtering by title, name field, city, description and tags. It deliberately does not expose candidate email/user IDs in the resume catalogue. However, this is not AI matching: `GET /api/jobs/employer/resumes` still returns all open resumes ordered by creation time, without vacancy-specific ranking, server-side filters, saved searches or candidate contact/consent workflow.
- `JobApplication` persists a status string; the current data model does not establish separate interview scheduling/calendar records or structured offer/acceptance/contract records. The `interview` and `offer` values are pipeline statuses, not completed interview/offer workflows.
- Vacancy edit, close/archive and a complete vacancy lifecycle are not present in the current employer route/UI slice.
- Messaging, candidate-facing status notifications and a complete communication/consent lifecycle are not proven by the current Jobs E2E.
- The E2E legal activation step changes settings directly in its isolated CI database. It proves the publication gate but does not prove real signer-authority verification, an effective legal-package lifecycle or a Kazakhstan electronic-signature provider. The legal/trust release blocker above remains open.

**Classification:** the employer vertical slice has advanced from the main-baseline `Incomplete / Partial` description to **Partial with a verified source/E2E candidate implementation**. It is not a complete Professional/Jobs cabinet under Master Spec §20–21 until the remaining discovery, interview/offer, vacancy-lifecycle, communication, audit and mobile acceptance criteria are closed.

---

## 9. Audit conclusion

The current application is **a substantial but incomplete DentVision platform foundation**.

It is not yet the final product described by the Master Spec.

The largest remaining gap is not raw feature count. It is **coherence**: one identity, one active context, one ecosystem, one workflow model and one AI/action layer must become the visible and runtime structure across every participant type.

The next work should therefore prioritize architectural convergence and vertical workflow completion over adding more isolated screens.
