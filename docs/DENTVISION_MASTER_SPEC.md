# DentVision — Master Product & System Specification

**Status:** CANONICAL / ACTIVE  
**Version:** 3.1  
**Date:** 2026-09-11  
**Owner:** DentVision by Dr.Tamirlan

> This is the single normative source of truth for DentVision product intent, architecture guardrails, execution order, completed work, current blockers, and next actions. Product/system documents that conflict with this file are non-normative and must not drive implementation.

## 1. Product identity / North Star

DentVision is a **Dental Super App / ecosystem** unifying clinical operations, AI, diagnostics, laboratory workflows, marketplace, education, jobs, community and finance.

**North Star:** DentVision should not make users learn an application. It should understand the user's intent and present the next correct action.

DentVision is not merely a CRM. CRM is a core clinical/business surface inside the wider ecosystem.

## 2. Canonical product model

- One identity across product surfaces and organizations.
- One ecosystem: Clinic/CRM, AI, Diagnostics, Laboratory, Shop, Academy, Jobs, Community and Finance.
- One AI command layer using only authorized context.
- One trust boundary: authentication, consent, RBAC, tenant isolation and auditability.
- One source of truth: no shadow patients, appointments, clinics, inventory or medical records.
- Multiple organizations per identity with explicit active organization/clinic context.
- Client-supplied organization/clinic IDs are never authorization proof.

Protected clinical graph:

`Patient → Visit → Diagnosis → Treatment Plan → Procedure/Treatment → Lab Order → Diagnostic Referral → Files/Results → AI Context`

Every hop must enforce authorization and tenant ownership.

## 3. Canonical entry and navigation

`Public Welcome → intent/discovery → auth/registration when required → selected surface → AI Workspace when applicable`

Welcome answers **“What can I do here?”**. Home/Command Center answers **“What should I do now?”**.

AI Workspace is the primary operational interface for authenticated users. Service cards are entry points, not duplicate navigation.

Navigation rules:
- one primary action per region;
- no duplicate canonical destinations;
- active organization/location is visible;
- mobile uses progressive disclosure;
- no permanent nested module sidebars;
- sidebar does not auto-expand merely because the app opened;
- desktop/mobile shell mechanics may differ intentionally;
- route changes preserve useful AI context where possible.

## 4. Consent + authorization contract

Do **not** create a second consent system. Use the existing consent infrastructure:

- `Consent`
- `consent.catalog.ts`
- `compliance.service.ts`
- `consentGate.ts`
- `assertCurrentConsent()` / `requireCurrentConsent()`

For protected clinical operations the canonical chain is:

`authenticate → current consent → active organization/clinic → RBAC → tenant/object authorization → business authorization → action → audit`

Sensitive reads/mutations include patient medical history, medical documents, DICOM/imaging, treatment plans, odontogram, clinical notes, prescriptions, diagnostics, lab results, AI clinical analysis/recommendations, cross-clinic records and patient profile changes.

Expected authorization outcomes are deterministic:

`ALLOW | DENY | CONSENT_REQUIRED | ROLE_REQUIRED | ORGANIZATION_REQUIRED | CLINIC_REQUIRED | PATIENT_ACCESS_REQUIRED`

The platform should converge on one reusable authorization layer/primitives:

`canAccessOrganization()`  
`canAccessClinic()`  
`canAccessPatient()`  
`canAccessMedicalRecord()`  
`canAccessDiagnosticResult()`  
`canAccessLabOrder()`  
`canPerformClinicalMutation()`  
`canPerformFinancialMutation()`

IDs from URL/body/query are never proof of access.

## 5. Patient Portal security

The Patient Portal must resolve:

`User → active organization/clinic context → patient identity → authorized resource`

Critical surfaces to verify include:

- `/patient-portal/me`
- appointments
- treatments
- treatment plans
- visits
- invoices
- documents and document content
- diagnostics
- appointment requests/cancellation
- cross-clinic grants

A foreign `clinicId`, `patientId`, appointment ID or document ID must not expose or mutate another tenant's data.

## 6. P0 execution order

This is the mandatory implementation sequence. It replaces open-ended audits.

### P0-1 — Consent + Authorization + Tenant Isolation

Finish the current security block across protected clinical endpoints. Reuse the existing consent engine. Expand object/tenant authorization and regression coverage. Record each completed slice in this file.

### P0-2 — Patient → Doctor → Clinic booking

Canonical journey:

`Welcome → find doctor → clinic → service → date/time → auth → consent → booking pending → clinic confirmation → patient notification → appointment → visit → medical record`

Use the existing public booking, Patient Portal, Booking model and appointment service. Do not create a second booking system.

### P0-3 — Diagnostics

`Find diagnostics → location → study type → center → price/availability → date → order → payment/confirmation → status → performed → result → authorized AI summary → doctor confirmation → patient record`

Use real center registration, services, orders, status, result upload/release, patient/doctor permissions and audit.

### P0-4 — Laboratory

`Clinic → Lab Order → Laboratory → Accept → Production → QC → Ready → Delivery → Doctor → Patient record`

Canonical states:

`DRAFT → SUBMITTED → ACCEPTED → IN_PRODUCTION → QC → READY → DELIVERED | CANCELLED`

Include deadline/SLA and real-data AI delay alerts.

### P0-5 — AI Employee

AI is an operating layer, not decorative chat.

Context:
`currentUser, currentRole, activeOrganization, activeClinic, currentPatient, currentTask, permissions, recentEvents`

Tools may include:
`getTodaySchedule, getPatient, searchPatient, createBooking, requestDiagnostic, getLabOrders, getInventory, createTask, sendReminder, draftTreatmentPlan, analyzeDiagnostic, getFinancialSummary`

Contract:
`real data → detect → explain → recommend → confirmation when required → execute through authorized tool → audit`

Clinical/irreversible actions require appropriate human confirmation. AI never bypasses RBAC, tenant isolation, consent or audit.

### P0-6 — Home / Command Center

Home answers “What should I do now?” and is role-aware.

Doctor: today, patients, appointments, tasks, labs, diagnostics, AI briefing.  
Owner: revenue, appointments, team, utilization, expenses, AI alerts.  
Admin: bookings, patients, payments, labs, reminders, operational problems.  
Patient/Buyer: appointments, doctors, diagnostics, documents, payments, AI assistant.

No fake metrics or decorative AI events.

### P0-7 — Role workspaces

Finish Doctor, Owner and Admin daily loops using the same backend truth. Do not build disconnected dashboards.

### P0-8 — Ecosystem surfaces

Connect Shop, Academy, Jobs and Community to the same identity/organization architecture. Existing self-service organization onboarding is the common pattern, not separate registration systems.

### P0-9 — Finance Hub

Use real Revenue, Expenses, Payroll, Supplier payments, Marketplace commission, Academy revenue, SaaS and Cashflow data. CAC/LTV/MRR/Churn/ROI/ARPU/Margin only when calculated from real data.

### P0-10 — AI platform

Target architecture:

`AI Router → Role Context → Permission Engine → Tool Registry → LLM → Action Validator → Confirmation → Audit`

Domain modules may include Dental, Radiology, Orthopedic, Orthodontic, Therapy, Endodontic, Laboratory, Finance, Reception and Marketing AI.

### P0-11 — Critical E2E and release

Prioritize executable journeys rather than testing every page:

Patient registration, doctor/clinic discovery, booking, cancellation, document access; doctor onboarding, clinic membership, patient access, treatment plan, AI recommendation/doctor confirmation; diagnostics registration/order/result release; lab registration/order/QC/ready; owner registration, invitation, RBAC, organization switching.

Release gate:
`TypeScript → ESLint → build → Prisma/migrations → backend tests → frontend tests → critical E2E → RBAC → tenant isolation → consent → legal/trust → AI confirmation → mobile UX → desktop UX → deployment verification`

No patient, medical record, diagnostic, lab result, financial transaction or clinical mutation may be accessible merely because an attacker knows an ID.

## 7. Partner onboarding architecture

All organization onboarding converges on:

`Account → Organization → Profile → Team → Services → Verification → Legal → Workspace`

Supported organization/person types include Clinic, Diagnostic Center, Laboratory, Supplier/Seller, Academy/Lecturer, Employer and Doctor/Professional.

Do not create chaotic parallel registration architectures.

## 8. Legal / Trust

Production trust path:

`Registration → KYB/KYC → legal package → consent → electronic acceptance → audit → workspace`

DentVision Electronic Acceptance is internal auditable electronic acceptance and must not be represented as Kazakhstan EDS. Real Kazakhstan EDS/provider integration is a later explicit integration.

## 9. UX / Figma

Figma is the visual design-system reference. Code remains the source of the working product.

Use Figma for tokens, typography, spacing, buttons, cards, navigation, AI surfaces, patient/clinical components, tables and mobile navigation. Never block functional P0 work because Figma is unavailable/rate-limited.

Premium UX rules: distinctive clinical identity, restrained surfaces, clear hierarchy, no generic AI-incubator styling, no decorative navigation theatre, no duplicate content, no emoji as primary product icons.

Every important flow needs loading, empty, error, permission/consent and success states.

## 10. Existing implementation baseline — recorded 2026-09-11

The repository already contains substantial work in these areas and must be reused rather than rebuilt:

- Execution/North Star direction and product ecosystem architecture.
- Self-service organization onboarding for clinics and ecosystem organizations.
- Professional/Doctor onboarding.
- Legal/trust and organization-scoped legal context.
- Auditable Electronic Acceptance.
- Existing Consent Engine and strict consent gate.
- Patient Portal and cross-clinic access/revoke mechanisms.
- Public booking request flow.
- AI Employee role contract/task infrastructure.
- Lazy-loaded charts/performance work.
- Security hardening across multiple protected domains.

The implementation state is evidence from repository code/tests/commits, not from this checklist alone.

## 11. Execution ledger — mandatory session-independent state

**Rule:** Every substantive implementation session MUST update this section in the same commit/PR as the code change, stating what was completed, what remains, verification performed, and the next P0 action. This prevents session loss and repeated audits.

### Current state — 2026-09-11

- **P0-1 Consent/Authorization/Tenant Isolation:** IN PROGRESS. The repository has a fail-closed consent gate on the Patient Portal and object-scoped filters on portal reads/actions. During endpoint-level verification, a concrete tenant-boundary defect was identified in `POST /api/patient-portal/link`: a signed-in patient can submit an arbitrary `clinicId`, and when no existing patient card matches, the route creates a new patient record in that clinic. The client-supplied clinic ID therefore becomes an implicit authorization mechanism, which violates the canonical trust chain.
- **P0-1 Patient Portal identity:** IN PROGRESS. `resolvePatientForUser()` safely claims only unowned patient cards by email/phone and uses compare-and-set linking, but the portal still resolves a single patient card without an explicit active organization/clinic context. Multi-clinic identity needs to converge on an explicit active context rather than first-match semantics.
- **P0-1 Document boundary:** VERIFIED for object lookup. Document content is queried with both document ID and the resolved patient ID, so a foreign document ID does not match. External document URL handling remains a separate data-egress hardening item.
- **P0-1 Diagnostics data minimization:** REMAINING. Patient diagnostics are sourced from the patient-scoped referral query, but the response currently includes `platformFee`, which is an internal platform financial field and should not be exposed to a patient. Remove internal-only financial fields from patient-facing DTOs and add a regression assertion.
- **P0-2 Patient booking:** FOUNDATION EXISTS. Public booking, Patient Portal and appointment infrastructure exist; end-to-end security/context/persistence verification remains after the P0-1 boundary fixes.
- **P0-3 Diagnostics:** FOUNDATION EXISTS. Self-service diagnostic-center onboarding and diagnostic infrastructure exist; complete public discovery → order → result → AI → doctor confirmation journey remains.
- **P0-4 Laboratory:** FOUNDATION EXISTS / EXECUTION REQUIRED. Laboratory is a first-class participant; full operational lifecycle, SLA/deadline and result delivery need completion.
- **P0-5 AI Employee:** FOUNDATION EXISTS. Role-based contract and task/event infrastructure exist; real-data briefing/tool execution/confirmation loop remains a P0 product completion target.
- **P0-6 Home:** PARTIALLY IMPLEMENTED. Existing Home/service-grid/proactive AI work exists; it must be connected to real role-aware data without duplicate navigation.
- **P0-7 Role workspaces:** PARTIALLY IMPLEMENTED. Existing clinic/CRM surfaces exist; Doctor/Owner/Admin daily loops remain to be connected end-to-end.
- **P0-8 Ecosystem:** PARTIALLY IMPLEMENTED. Self-service onboarding exists for multiple partner types; depth and cross-surface workflows remain.
- **P0-9 Finance:** FOUNDATION EXISTS. Real-data completeness and ecosystem integration remain.
- **P0-10 AI platform:** FOUNDATION EXISTS / EXECUTION REQUIRED. Existing AI authorization/tool infrastructure should be consolidated into the target router/context/permission/tool/action/audit architecture.
- **P0-11 E2E/release:** IN PROGRESS. Security and release hardening exists in the repository; final critical-journey verification remains.

### Next action

**P0-1 immediate implementation sequence:**
1. Remove implicit patient creation from `/patient-portal/link`; linking must require an existing authorized patient card, valid booking/invitation, or explicit cross-clinic authorization. A client-supplied `clinicId` alone is never sufficient.
2. Add a regression test proving a patient cannot create/link a patient record into an arbitrary clinic.
3. Remove `platformFee` and other internal-only financial fields from patient diagnostic DTOs and add a DTO-level regression test.
4. Converge Patient Portal reads on explicit active organization/clinic context, preserving approved cross-clinic grants.
5. Re-run the critical patient tenant/IDOR suite.
6. Only after these pass, mark P0-1 complete and immediately execute P0-2 booking.

For each discovered defect: fix in code → add/adjust regression coverage → verify → commit → update this ledger → proceed to the next P0 item.

## 12. Definition of Done

A workflow is DONE only when:

1. discoverable entry exists;
2. happy path reaches real backend/source of truth;
3. persistence is visible to authorized participants;
4. authentication occurs only where required;
5. consent/RBAC/tenant isolation/object authorization are enforced;
6. loading/empty/error/success/permission states exist;
7. AI assists where appropriate;
8. manual fallback works;
9. clinical/financial mutations follow confirmation policy;
10. desktop/mobile are intentionally usable;
11. acceptance test or executable verification exists;
12. user understands the next step without instructions.

A visually complete page with fake or disconnected actions is incomplete.

## 13. Non-negotiable execution rules

1. GitHub is the source of truth for implementation.
2. This file is the single normative product/execution document.
3. Do not revive obsolete PRs or competing product specs.
4. Do not begin another broad audit when a concrete P0 task is available.
5. Do not claim completion without repository evidence.
6. Fix defects in code rather than documenting them indefinitely.
7. Preserve existing working systems; extend/reconcile instead of duplicating.
8. Never invent data, AI events, financial metrics or clinical facts.
9. Critical clinical/financial actions require the prescribed confirmation and audit path.
10. After each meaningful change, record **Done / Verification / Remaining / Next** in this file.
11. The next session must resume from this ledger rather than reconstructing context from chat history.
