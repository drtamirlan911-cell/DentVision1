# DentVision — Master Product & System Specification

**Status:** CANONICAL / ACTIVE  
**Version:** 3.5  
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

### 2026-09-11 — P0-2 booking hardening + clinical IDOR coverage

**Done**
- Booking write path now loads the patient's `clinicId` and fails closed when the patient does not belong to the selected clinic.
- Removed an accidental misplaced ownership check from `getAvailableSlots`; slot discovery is now a pure clinic/schedule read while ownership is enforced at booking write time.
- Clean clinical tenant IDOR coverage was applied directly to `main` after stale PR #272 became non-mergeable; superseded #270/#271 and stale #272 history are not resurrected.
- Existing AI booking machinery was revalidated from repository history: caller identity is backend-derived, doctor membership is checked, availability is rechecked at write time, and the assistant creates a pending Booking request rather than bypassing the clinic confirmation workflow.

**Verification**
- Booking source contains the ownership guard only in `requestAppointment`, immediately before write-side business validation.
- Patient-facing diagnostic AI output is gated on `doctorConfirmed`; unconfirmed report/conclusion data is withheld and represented as pending confirmation.
- Quality Gate contract defects in `aiEmployeeTasks.ts`, AI Workspace, Digital Assistant and Dental Lab workspace were corrected on `main`.
- Latest Quality Gate is running against the consolidated fixes; green status is not claimed until completion.

**Remaining**
- Complete the live patient booking journey: discovery → registration → consent → pending request → clinic confirmation → notification → appointment persistence.
- Verify booking notification delivery in the live E2E stack.
- Verify AI booking caller authorization in the current test stack rather than relying only on historical verification.

### 2026-09-11 — P0-3 diagnostics safety + execution slice

**Done**
- Patient-facing diagnostic result serialization exposes report/conclusion only when `doctorConfirmed = true`.
- Unconfirmed AI diagnostic output remains clinical decision support and is returned only as a pending-confirmation state.
- Added executable clinical tenant IDOR coverage for patients, appointments, diagnostic referrals and clinic spoofing directly to `main`.
- Completed the missing diagnostics referral API surface on `main`: scoped referral listing, creation, detail, controlled update, lifecycle status transitions, draft deletion, file upload/delete, comments, dashboard scope, AI result generation and doctor result signing.
- Referral creation now enforces authenticated clinic access, patient→clinic ownership and doctor→clinic membership; server-controlled payment, settlement and identity fields are stripped from client input.
- Referral mutations use object-level access guards. Center/laboratory staff are admitted only for referrals assigned to their own organization.
- AI diagnostic generation is explicitly non-signing and returns `requiresDoctorConfirmation`; doctor signing is the separate mutation that completes the referral and writes the diagnostic result into the patient visit record.
- Existing atomic unpaid-referral claim and diagnostic organization access hardening remain in place.

**Verification**
- The diagnostics routes now map the service's existing referral lifecycle functions into actual HTTP workflow endpoints instead of leaving them unreachable.
- AI image/lab interpretation requires a linked patient, valid image-analysis consent and a viewable source file before image-based output is written.
- Doctor confirmation is the only route in this slice that marks the diagnostic result signed/completed and persists the result into the patient's clinical record.
- New changes are under the active GitHub Quality Gate run `34611885168`; completion is pending.

**Remaining**
- Verify the complete diagnostics journey against the live E2E stack: discovery → center → study → referral → acceptance → payment/confirmation → performed → result → AI interpretation → doctor confirmation → patient record.
- Add/verify payment settlement HTTP integration where required by the current production payment pipeline.
- Add explicit live tests for center/lab object-level mutations and patient result visibility after confirmation.

### 2026-09-11 — P0-4 laboratory foundation checkpoint

**Done**
- Laboratory workspace already enforces authenticated laboratory membership before dashboard, order, status, technician and team operations.
- Clinic-to-laboratory assignment is scoped to the caller's active clinic and publishes the canonical `labOrder.assigned` event.
- Laboratory status transitions are server-validated against the existing transition graph and publish the canonical `labOrder.status_changed` event without leaking unsupported event fields.

**Remaining**
- Execute the full clinic → lab order → accept → production → QC → ready → delivery → doctor → patient record journey.
- Align persisted laboratory states with the canonical P0-4 state vocabulary without creating a parallel order model.
- Add end-to-end delivery/result notification coverage.

### Other P0 state

- **P0-1 Consent + Authorization:** FOUNDATION / HARDENING CONTINUES.
- **P0-2 Booking:** EXECUTION IN PROGRESS; security hardening done, live persistence/notification verification remaining.
- **P0-3 Diagnostics:** EXECUTION IN PROGRESS; API lifecycle surface now wired, live end-to-end verification remaining.
- **P0-4 Laboratory:** FOUNDATION + EXECUTION STARTED.
- **P0-5 AI Employee:** FOUNDATION EXISTS / EXECUTION REQUIRED.
- **P0-6 Home:** PARTIALLY IMPLEMENTED.
- **P0-7 Role workspaces:** PARTIALLY IMPLEMENTED.
- **P0-8 Ecosystem:** PARTIALLY IMPLEMENTED.
- **P0-9 Finance:** FOUNDATION EXISTS.
- **P0-10 AI platform:** FOUNDATION EXISTS / EXECUTION REQUIRED.
- **P0-11 E2E/release:** IN PROGRESS.

## Immediate next actions

1. Finish and verify Quality Gate for the diagnostics route execution slice.
2. Complete live P0-3 diagnostics E2E including payment/confirmation, result, AI interpretation, doctor confirmation and patient-record persistence.
3. Complete P0-2 live booking persistence/confirmation/notification verification in parallel where the E2E stack permits.
4. Move directly through P0-4 laboratory execution, reusing the existing Lab Order model and event contract.
5. Then execute P0-5 AI Employee with the same trust contract.
6. After every meaningful change: implement → regression → verify → commit → update this ledger → continue.
