# DentVision — Master Product & System Specification

**Status:** CANONICAL / ACTIVE  
**Version:** 3.2  
**Date:** 2026-09-11  
**Owner:** DentVision by Dr.Tamirlan

> Single normative source of truth for DentVision product intent, architecture guardrails, execution order, completed work, current blockers, and next actions. Conflicting product/system documents are non-normative.

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

Use the existing consent infrastructure; do not create a second consent system:
`Consent`, `consent.catalog.ts`, `compliance.service.ts`, `consentGate.ts`, `assertCurrentConsent()` / `requireCurrentConsent()`.

Canonical chain:
`authenticate → current consent → active organization/clinic → RBAC → tenant/object authorization → business authorization → action → audit`

Sensitive operations include medical history, documents, DICOM/imaging, treatment plans, odontogram, clinical notes, prescriptions, diagnostics, lab results, AI clinical analysis/recommendations, cross-clinic records and patient profile changes.

Authorization outcomes:
`ALLOW | DENY | CONSENT_REQUIRED | ROLE_REQUIRED | ORGANIZATION_REQUIRED | CLINIC_REQUIRED | PATIENT_ACCESS_REQUIRED`

Target reusable primitives:
`canAccessOrganization()` · `canAccessClinic()` · `canAccessPatient()` · `canAccessMedicalRecord()` · `canAccessDiagnosticResult()` · `canAccessLabOrder()` · `canPerformClinicalMutation()` · `canPerformFinancialMutation()`.

IDs from URL/body/query are never proof of access.

## 5. Patient Portal security

Canonical resolution:
`User → active organization/clinic context → patient identity → authorized resource`

Critical surfaces: `/patient-portal/me`, appointments, treatments, treatment plans, visits, invoices, documents/content, diagnostics, appointment request/cancellation and cross-clinic grants.

A foreign clinic/patient/resource ID must not expose or mutate another tenant's data.

## 6. P0 execution order

This sequence replaces open-ended audits.

### P0-1 — Consent + Authorization + Tenant Isolation
Finish protected clinical endpoint convergence using the existing consent engine, reusable authorization and regression coverage.

### P0-2 — Patient → Doctor → Clinic booking
`Welcome → find doctor → clinic → service → date/time → auth → consent → booking pending → clinic confirmation → notification → appointment → visit → medical record`.
Use existing public booking, Patient Portal, Booking model and appointment service. Never create a second booking system.

### P0-3 — Diagnostics
`Find diagnostics → location → study → center → price/availability → date → order → payment/confirmation → status → performed → result → authorized AI summary → doctor confirmation → patient record`.

### P0-4 — Laboratory
`Clinic → Lab Order → Laboratory → Accept → Production → QC → Ready → Delivery → Doctor → Patient record`.
States: `DRAFT → SUBMITTED → ACCEPTED → IN_PRODUCTION → QC → READY → DELIVERED | CANCELLED`.

### P0-5 — AI Employee
AI is an operating layer, not decorative chat. Context includes current user/role, active organization/clinic, current patient/task, permissions and recent events. Contract:
`real data → detect → explain → recommend → confirmation → authorized tool execution → audit`.
Clinical/irreversible actions require human confirmation.

### P0-6 — Home / Command Center
Role-aware “What should I do now?” surface using real data only.

### P0-7 — Role workspaces
Complete Doctor, Owner and Admin daily loops against shared backend truth.

### P0-8 — Ecosystem surfaces
Connect Shop, Academy, Jobs and Community to the same identity/organization architecture.

### P0-9 — Finance Hub
Revenue, expenses, payroll, supplier payments, marketplace commission, academy revenue, SaaS and cashflow from real data. CAC/LTV/MRR/Churn/ROI/ARPU/Margin only when actually calculable.

### P0-10 — AI platform
`AI Router → Role Context → Permission Engine → Tool Registry → LLM → Action Validator → Confirmation → Audit`.

### P0-11 — Critical E2E and release
Critical patient, doctor, diagnostics, lab and owner journeys; release gate covers TypeScript, lint, build, Prisma, backend/frontend tests, E2E, RBAC, tenant isolation, consent, legal/trust, AI confirmation, mobile, desktop and deployment verification.

## 7. Partner onboarding architecture

`Account → Organization → Profile → Team → Services → Verification → Legal → Workspace`

Applies to Clinic, Diagnostic Center, Laboratory, Supplier/Seller, Academy/Lecturer, Employer and Doctor/Professional. Do not create parallel registration architectures.

## 8. Legal / Trust

`Registration → KYB/KYC → legal package → consent → electronic acceptance → audit → workspace`.

DentVision Electronic Acceptance is internal auditable acceptance, not Kazakhstan EDS. EDS integration is a separate future integration.

## 9. UX / Figma

Figma is the visual design-system reference; code is the working-product source of truth. Use Figma for tokens, typography, spacing, controls, cards, navigation, AI surfaces, clinical components and mobile navigation, but never block functional P0 work on Figma availability.

Premium rules: distinctive clinical identity, clear hierarchy, no generic AI-incubator styling, no decorative navigation theatre, no duplicate content and no emoji as primary UI icons. Important flows require loading, empty, error, permission/consent and success states.

## 10. Existing implementation baseline

Repository already contains substantial working foundations: ecosystem architecture, self-service organization onboarding, professional onboarding, Legal/Trust, Electronic Acceptance, Consent Engine, Patient Portal, cross-clinic access/revoke, public booking, AI Employee infrastructure, lazy-loaded charts and security hardening across protected domains. Reuse and reconcile; do not rebuild parallel systems.

## 11. Execution ledger — mandatory session-independent state

**Rule:** Every substantive implementation session updates this section in the same commit/PR as code, recording **Done / Verification / Remaining / Next**. The next session resumes here, not from chat history.

### Current state — 2026-09-11

- **P0-1 Consent/Authorization/Tenant Isolation:** FIRST SECURITY SLICE COMPLETE; overall P0-1 remains IN PROGRESS.
- **P0-1 `/patient-portal/link`: DONE for identified tenant-boundary defect.** The endpoint no longer creates a Patient record from a client-supplied `clinicId`. Existing authorized/unclaimed matches can still be linked; otherwise the endpoint fails closed with HTTP 403. New patient creation remains in the booking/onboarding workflow.
- **P0-1 Patient diagnostics DTO: DONE for identified data-minimization defect.** Internal `platformFee` is no longer selected or returned by patient diagnostics.
- **P0-1 Verification: PASSED.** GitHub Actions executed a dependency-free repository regression after the fixes and passed both assertions: arbitrary `/link` cannot create a patient, and patient diagnostics do not expose `platformFee`. The earlier `npm test` attempt was also recorded as invalid because `dentvision-backend/package.json` has no `test` script; verification was corrected rather than falsely reported.
- **P0-1 Patient identity/context: REMAINING.** `resolvePatientForUser()` safely claims only unowned cards by email/phone with compare-and-set, but Patient Portal still needs explicit active organization/clinic context for multi-clinic identity instead of first-match semantics.
- **P0-1 Cross-clinic authorization convergence: REMAINING.** Existing grant/revoke infrastructure remains; endpoint-by-endpoint convergence on the canonical authorization primitives is required.
- **P0-1 Document boundary: VERIFIED.** Document content lookup includes both document ID and resolved patient ID. External document URL handling remains a separate egress-hardening item.
- **P0-2 Patient booking: FOUNDATION EXISTS.** Public booking, Patient Portal and appointment infrastructure exist; complete security/context/persistence verification follows the remaining P0-1 context/authorization work.
- **P0-3 Diagnostics: FOUNDATION EXISTS.** Self-service diagnostic-center onboarding and referral infrastructure exist; discovery → order → result → authorized AI → doctor confirmation remains.
- **P0-4 Laboratory: FOUNDATION EXISTS / EXECUTION REQUIRED.** Full lifecycle, SLA/deadline and result delivery remain.
- **P0-5 AI Employee: FOUNDATION EXISTS.** Real-data briefing/tool execution/confirmation loop remains.
- **P0-6 Home:** PARTIALLY IMPLEMENTED.
- **P0-7 Role workspaces:** PARTIALLY IMPLEMENTED.
- **P0-8 Ecosystem:** PARTIALLY IMPLEMENTED.
- **P0-9 Finance:** FOUNDATION EXISTS.
- **P0-10 AI platform:** FOUNDATION EXISTS / EXECUTION REQUIRED.
- **P0-11 E2E/release:** IN PROGRESS.

### Next — execute immediately

1. Converge Patient Portal on explicit active organization/clinic context while preserving approved cross-clinic grants.
2. Finish reusable authorization primitives and endpoint convergence for clinical resources.
3. Run the existing critical patient tenant/IDOR suite and fix any concrete failures.
4. Mark P0-1 complete only with repository evidence.
5. Immediately execute P0-2 Patient → Doctor → Clinic booking; do not start another broad audit.
6. After every substantive change: code → regression → verify → commit → update this ledger → continue.

## 12. Definition of Done

A workflow is DONE only when it has a discoverable entry, real backend/source-of-truth happy path, authorized persistence, consent/RBAC/tenant/object authorization, loading/empty/error/success/permission states, appropriate AI assistance, manual fallback, confirmation for clinical/financial mutations, usable desktop/mobile behavior and executable verification. A visually complete page with fake/disconnected actions is incomplete.

## 13. Non-negotiable execution rules

1. GitHub is implementation source of truth.
2. This file is the single normative product/execution document.
3. Do not revive obsolete PRs or competing product specs.
4. Do not begin broad audits when a concrete P0 task exists.
5. Never claim completion without repository evidence.
6. Fix defects in code rather than documenting them indefinitely.
7. Preserve working systems; extend/reconcile instead of duplicating.
8. Never invent data, AI events, financial metrics or clinical facts.
9. Critical clinical/financial actions require prescribed confirmation and audit.
10. Update this ledger after every meaningful implementation slice.
11. Next session resumes from this ledger.
