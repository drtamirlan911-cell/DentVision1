# DentVision System Audit

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

## 9. Audit conclusion

The current application is **a substantial but incomplete DentVision platform foundation**.

It is not yet the final product described by the Master Spec.

The largest remaining gap is not raw feature count. It is **coherence**: one identity, one active context, one ecosystem, one workflow model and one AI/action layer must become the visible and runtime structure across every participant type.

The next work should therefore prioritize architectural convergence and vertical workflow completion over adding more isolated screens.
