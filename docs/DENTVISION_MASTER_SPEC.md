# DentVision — Master Product & System Specification

**Status:** CANONICAL / ACTIVE  
**Version:** 3.3  
**Date:** 2026-09-11  
**Owner:** DentVision by Dr.Tamirlan

> Single normative source of truth for product intent, architecture guardrails, P0 execution order, completed work, blockers and next actions. GitHub code/tests are the evidence source.

## North Star
DentVision is a Dental Super App/ecosystem, not merely a CRM. It unifies Clinic/CRM, AI, Diagnostics, Laboratory, Shop, Academy, Jobs, Community and Finance.

**North Star:** understand user intent and present the next correct action instead of making the user learn the application.

## Canonical architecture

One identity, one ecosystem, one AI command layer, one trust boundary and one source of truth. Multiple organizations are supported through explicit active organization/clinic context.

Clinical graph:
`Patient → Visit → Diagnosis → Treatment Plan → Procedure/Treatment → Lab Order → Diagnostic Referral → Files/Results → AI Context`

No client-supplied organization/clinic/patient/resource ID is authorization proof.

## Trust contract

Protected clinical flow:
`authenticate → current consent → active organization/clinic → RBAC → tenant/object authorization → business authorization → action → audit`

Reuse existing `Consent`, `consent.catalog.ts`, `compliance.service.ts`, `consentGate.ts`, `assertCurrentConsent()` / `requireCurrentConsent()`.

Authorization outcomes:
`ALLOW | DENY | CONSENT_REQUIRED | ROLE_REQUIRED | ORGANIZATION_REQUIRED | CLINIC_REQUIRED | PATIENT_ACCESS_REQUIRED`

Target reusable primitives:
`canAccessOrganization`, `canAccessClinic`, `canAccessPatient`, `canAccessMedicalRecord`, `canAccessDiagnosticResult`, `canAccessLabOrder`, `canPerformClinicalMutation`, `canPerformFinancialMutation`.

AI never bypasses consent, RBAC, tenant isolation or audit. Clinical/irreversible actions require prescribed human confirmation.

## Patient Portal contract

Canonical resolution:
`User → active organization/clinic context → patient identity → authorized resource`

Critical surfaces: profile, appointments, treatments, treatment plans, visits, invoices, documents/content, diagnostics, booking request/cancellation and cross-clinic grants.

Patient-facing DTOs must not expose internal platform economics or unrelated tenant data.

## Canonical navigation / UX

`Welcome → intent/discovery → authentication when required → selected surface → AI Workspace`

Welcome answers “What can I do here?”; Home/Command Center answers “What should I do now?”. No duplicate destinations or permanent nested module sidebars. Active organization/location is visible. Mobile uses progressive disclosure. Figma is the visual reference; code is the working-product source of truth. Never block functional P0 work on Figma availability.

Premium rules: distinctive clinical identity, clear hierarchy, no generic AI-incubator styling, no decorative navigation theatre, no duplicate content and no emoji as primary UI icons.

## Mandatory P0 order

1. **P0-1 Consent + Authorization + Tenant Isolation**
2. **P0-2 Patient → Doctor → Clinic booking**
3. **P0-3 Diagnostics**
4. **P0-4 Laboratory**
5. **P0-5 AI Employee**
6. **P0-6 Home / Command Center**
7. **P0-7 Role workspaces**
8. **P0-8 Shop / Academy / Jobs / Community**
9. **P0-9 Finance Hub**
10. **P0-10 AI platform**
11. **P0-11 critical E2E + release**

### P0-2 canonical booking
`Welcome → find doctor → clinic → service → date/time → auth → consent → booking pending → clinic confirmation → notification → appointment → visit → medical record`

Use the existing public booking, Patient Portal, Booking model and appointment service. No second booking system.

Booking must validate at write time: clinic exists and is open, requested time belongs to clinic schedule, doctor belongs to clinic, patient belongs to clinic, and the slot is not already occupied by an appointment or pending/confirmed booking.

### Diagnostics
`Discovery → center → study → availability → order → payment/confirmation → performed → result → authorized AI summary → doctor confirmation → patient record`.

### Laboratory
`Clinic → Lab Order → Laboratory → Accept → Production → QC → Ready → Delivery → Doctor → Patient record`.

States:
`DRAFT → SUBMITTED → ACCEPTED → IN_PRODUCTION → QC → READY → DELIVERED | CANCELLED`.

### AI Employee
`real data → detect → explain → recommend → confirmation → authorized tool execution → audit`.

### AI platform
`AI Router → Role Context → Permission Engine → Tool Registry → LLM → Action Validator → Confirmation → Audit`.

## Existing foundation

Repository already contains self-service organization onboarding, professional onboarding, Legal/Trust, Electronic Acceptance, Consent Engine, Patient Portal, cross-clinic access/revoke, public booking, AI Employee task infrastructure, lazy-loaded charts and security hardening. Reuse these systems; do not build parallel architectures.

## Execution Ledger — session independent

**Rule:** Every substantive implementation slice records **Done / Verification / Remaining / Next** in this file in the same implementation checkpoint. Never restart from a broad audit.

### 2026-09-11 — P0-1 security slice

**Done**
- Fixed `/patient-portal/link`: client-supplied `clinicId` can no longer create a new Patient record. Existing authorized/unclaimed matches may link; otherwise the endpoint fails closed with HTTP 403.
- Removed internal `platformFee` from patient diagnostics DTO selection.
- Scoped patient identity resolution to the authenticated session's active `clinicId` by default. Explicit `clinicId` remains supported for deliberate link flows. This removes cross-clinic first-match semantics when a user has an active clinic context.

**Verification**
- Repository security regression passed in GitHub Actions after the `/link` and diagnostics changes.
- Regression explicitly proved arbitrary `/link` cannot create a patient and patient diagnostics do not expose `platformFee`.
- Existing document content lookup was verified to scope document ID by resolved patient ID.

**Remaining**
- Complete endpoint-by-endpoint convergence on reusable authorization primitives.
- Complete explicit active organization/clinic context for multi-clinic Patient Portal sessions where token context is not yet sufficient.
- Finish cross-clinic grant authorization convergence.
- External document URL data-egress hardening.

### 2026-09-11 — P0-2 booking slice

**Done**
- Identified and hardened the booking service boundary so a booking request cannot use a patient from one clinic with a different clinic ID.
- Booking write path already re-checks clinic working hours, valid schedule time, doctor membership and appointment/booking conflicts at write time; this remains the canonical booking path.

**Verification**
- Added a repository-level booking tenant-boundary regression through GitHub Actions; verification checks that patient clinic ownership is loaded and enforced before booking creation.
- Existing booking service tests cover invalid time, conflicts and unknown doctor paths.

**Remaining**
- Run the complete patient booking journey against the live E2E stack: discovery → registration → consent → pending request → clinic confirmation → notification → appointment.
- Verify the same authorization boundary for every AI booking tool caller.
- Do not mark P0-2 complete until persistence and notification are verified end-to-end.

### Other P0 state

- **P0-3 Diagnostics:** FOUNDATION EXISTS / EXECUTION REQUIRED.
- **P0-4 Laboratory:** FOUNDATION EXISTS / EXECUTION REQUIRED.
- **P0-5 AI Employee:** FOUNDATION EXISTS / EXECUTION REQUIRED.
- **P0-6 Home:** PARTIALLY IMPLEMENTED.
- **P0-7 Role workspaces:** PARTIALLY IMPLEMENTED.
- **P0-8 Ecosystem:** PARTIALLY IMPLEMENTED.
- **P0-9 Finance:** FOUNDATION EXISTS.
- **P0-10 AI platform:** FOUNDATION EXISTS / EXECUTION REQUIRED.
- **P0-11 E2E/release:** IN PROGRESS.

## Immediate next actions

1. Finish P0-1 reusable authorization/context convergence and run the existing patient tenant/IDOR suite.
2. Finish P0-2 live patient booking journey and confirmation/notification persistence.
3. Immediately move to P0-3 Diagnostics; do not start another general audit.
4. After every meaningful change: implement → regression → verify → commit → update this ledger → continue.

## Definition of Done

A workflow is complete only when it has a discoverable entry, real backend/source-of-truth happy path, authorized persistence, consent/RBAC/tenant/object authorization, loading/empty/error/success/permission states, appropriate AI assistance, manual fallback, confirmation for clinical/financial mutations, usable desktop/mobile behavior and executable verification.

## Non-negotiable rules

1. GitHub is implementation source of truth.
2. This file is the single normative product/execution document.
3. Do not revive obsolete PRs or competing product specs.
4. Do not begin broad audits when a concrete P0 task exists.
5. Never claim completion without repository evidence.
6. Fix defects in code rather than documenting them indefinitely.
7. Preserve working systems; extend/reconcile instead of duplicating.
8. Never invent data, AI events, financial metrics or clinical facts.
9. Critical clinical/financial actions require prescribed confirmation and audit.
10. Next session resumes from this ledger, not chat history.
