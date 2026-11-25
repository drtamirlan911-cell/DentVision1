# DentVision — Dental Laboratory Platform Execution Contract

**Status:** ACTIVE / P0 extension of `DENTVISION_EXECUTION_NORTH_STAR.md`
**Date:** 2026-09-11

This document is part of the DentVision execution canon. It closes a product gap: the existing Laboratory/Diagnostics workspace is not yet a complete **dental technical laboratory platform**.

## Product decision

DentVision must treat a dental laboratory as a first-class ecosystem participant, not merely as a clinic-side Lab Order destination and not as a duplicate diagnostic-center screen.

The canonical ecosystem becomes:

```text
Welcome
  ↓
Discovery / Booking / Diagnostics / Market / Academy
  ↓
Clinic / Doctor
  ↓
Treatment Plan / Patient Case
  ↓
Dental Laboratory
  ↓
Production → QC → Delivery → Clinic
  ↓
AI Employee + Inventory + Finance + Analytics
```

## Dental Lab workspace

A laboratory receives its own tenant-scoped workspace with:

- incoming dental work orders;
- production queue / Kanban;
- work specification and authorized files;
- patient context limited to what the lab needs;
- tooth / construction / material / shade / notes;
- due date and SLA;
- technician assignment;
- production stages;
- QC and remake handling;
- delivery / pickup status;
- laboratory services and pricing;
- staff and roles;
- revenue and operational analytics;
- lab inventory/materials as a later connected stream.

## Canonical production lifecycle

```text
New
 → Accepted
 → In production
 → QC
 → Ready
 → Delivered
```

Exception paths:

```text
In production / QC → Remake
In production → Delayed
Accepted → Declined / Cancelled
```

Existing `LabOrder` remains the canonical clinical work-order object. Do not create a second order model merely for the lab cabinet.

## Security and tenant isolation

- Laboratory users see only orders explicitly assigned to their laboratory.
- Clinic users see their own orders and the laboratory selected for the order.
- Patient medical data is minimized to the authorized work specification.
- Laboratory membership is the authorization boundary for lab operations.
- Cross-clinic access must never be inferred from `labName` text.
- Protected status changes and operational mutations must be RBAC-controlled.

## Clinic → Lab

The clinic-side Lab Order must support selecting a real laboratory and persist that assignment using the canonical `LabOrder` record. Existing metadata/file storage may be reused while the platform is incrementally migrated; no shadow order table is permitted.

## Lab → Clinic

Every meaningful production transition must be visible to the clinic and, where appropriate, surfaced by the AI Employee:

- order accepted;
- production started;
- delayed;
- remake requested;
- QC passed;
- ready;
- delivered.

Notifications must be durable and idempotent.

## AI Employee

For a doctor/clinic:

> “Лабораторная работа по пациенту готова. Следующий шаг — запись на примерку.”

For a laboratory:

> “Сегодня 6 работ с дедлайном, 2 требуют QC, 1 просрочена.”

AI may recommend, navigate and draft. Protected clinical/financial mutations require confirmation.

## Design / Figma contract

The dental laboratory workspace must use the existing DentVision premium design language and Figma design system. It must not introduce a second visual language.

Required composed views:

1. Lab Command Center
2. Incoming Orders
3. Production Board
4. Work Order Detail
5. QC / Remake flow
6. Services & Pricing
7. Team
8. Finance / Analytics

Design rules:

- one global navigation shell;
- no permanent nested sidebar;
- contextual tabs/actions inside the Lab workspace;
- dense production information remains scannable;
- primary next action is obvious immediately;
- desktop and mobile are intentionally different;
- reuse DentVision tokens/components and Code Connect where available.

Figma source of truth:
`DentVision — Premium Mobile Design System — UX`

## Definition of Done

The Dental Laboratory Platform is not considered complete until:

1. A laboratory can register/join as an organization.
2. Authorized laboratory staff can open a dedicated workspace.
3. A clinic can assign a real Lab Order to a real laboratory.
4. The lab can accept and process that order.
5. Production status changes persist and are tenant-safe.
6. QC/remake/delay paths work.
7. The clinic receives meaningful status updates.
8. The lab can manage its team and services.
9. AI Employee surfaces real operational exceptions.
10. Empty/loading/error/success states exist.
11. Desktop/mobile UX follows the DentVision design system.
12. Acceptance tests cover tenant isolation, authorization, idempotent events and the critical production lifecycle.

## Execution priority

This is inserted into the existing execution order as the next concrete depth layer:

```text
Doctor / Owner / Admin daily loops
        ↓
Clinic ↔ Dental Lab ↔ Inventory
        ↓
Dental Lab Platform depth
        ↓
Marketplace / Academy / Jobs / Community depth
```

The work must extend existing `LabOrder`, `Laboratory`, `LaboratoryMember`, event, notification, inventory and AI infrastructure rather than creating parallel sources of truth.

## 2026-11-01 execution checkpoint — PARTNER-003

Implemented and added to the exact-head E2E suite: a clinic creates a canonical LabOrder and assigns it to an independent dental-lab organization; the dental-lab owner sees it in the partner dashboard, sees the team, assigns a technician, progresses the order through sent → in production → try-in → adjustment → ready → delivered, reads the durable event history, and the originating clinic sees the delivered status. A different laboratory is denied access.

The event-log schema is reconciled with one shared runtime helper used by clinic and partner writers. The helper adds the note column when absent and makes the initial fromStatus nullable. A forward migration records the same correction for already-deployed schemas. The migration has not been applied to any live database.

PARTNER-003's original checkpoint above predates later QC implementation and must be read as a historical snapshot, not current status. The 2026-11-15 source reconciliation below supersedes its QC finding. The remaining D10 gaps are still open.

## 2026-11-01 follow-up — PARTNER-003 handoff ownership and clinic notification hardening

Implemented on the existing PR #330 candidate in commits `8dacdb03cc05adec5eba78a55ea7b797a12f2eb1` and `e777520e3fffa29e2eb6e8d89423e0890c9c7bdd`:

- Clinic discovery now returns only active dental labs whose canonical Organization is explicitly marked `DENTAL_LAB`, onboarding type `dental_lab`, lifecycle `ACTIVE`, verification `VERIFIED`, ecosystem-visible and legal-ready. Medical analysis labs do not enter this dental partner selector.
- The clinic can assign a pending canonical LabOrder to a real verified dental lab. Repeating the same assignment is idempotent and does not add duplicate history; assigning another lab after handoff is rejected.
- Clinic POST edit, DELETE and status operations reject partner-owned orders; direct assignment metadata through the generic clinic POST is rejected. The CRM shows delegated ownership, keeps view/print and removes local status/edit/delete controls after transfer.
- Clinic and partner lifecycle status updates, QC updates, technician assignment and event-log writes are serialized using a LabOrder row lock and a single database transaction. Changed technician assignments are added to the event history.
- QC now publishes the canonical clinic status event. QC pass produces the ready notification; QC fail produces a remake notification and is not classified as a completed order. Notifications remain idempotent per order/recipient.
- The E2E suite now asserts verified partner filtering, medical-lab exclusion, same-partner idempotency, reassignment rejection, clinic mutation/deletion denial, direct assignment denial and durable notification after QC pass.

**Verification state at this checkpoint:** Quality Gate `41262145807`, RB-034 `41262145784`, Vercel preview, frontend lint, backend TypeScript/ESLint, build/type checks and Command Center audit passed on `e777520`. CI `41262145782` failed at the generated System Map snapshot check because the file said 693 unique route handlers and the generator said 694; unit tests were skipped by that gate. The E2E job was still executing in its isolated environment. These new E2E assertions are not claimed as passed until a non-cancelled exact-head run completes.

**D10 remains PARTIAL/OPEN.** This closes a security/ownership subflow only; the Definition of Done still requires full independent lab service/pricing management, invoice/settlement/payout, delivery/dispatch, complete role matrix, AI exception handling, desktop/mobile UX and end-to-end acceptance. The schema migration remains unapplied to live databases.



## 2026-11-15 current-source reconciliation — QC implemented; D10 remains open

A read-only comparison of `main` at `4bbd61a339d5f3c4d40d1d5990f633a7b9a87864` confirms that the earlier “QC not implemented” statement is stale:

- `src/pages/diagnostics/DentalLabPlatform.tsx` presents six QC checks: fit/contact, margins, shade, occlusion, surface/polish and documentation/labeling. All checks must be completed; a failed check requires a non-empty note. The UI exposes QC submission only to owner/admin/manager/lab-manager roles.
- `dentvision-backend/src/modules/lab/labPlatform.routes.ts` exposes `PATCH /api/lab-orders/platform/orders/:id/qc`. The server independently enforces the lab-manager policy, validates the complete checklist and note, records the actor/time, and transitions to `ready` on pass or `remake` on failure. Ordinary status updates cannot bypass the QC state.
- `dentvision-backend/src/modules/lab/labPlatform.authorization.test.ts` covers manager identification, technician production-only permissions, denial of technician ready/delivered/remake transitions, checklist completeness and mandatory failure reason.
- `e2e/tests/partner-lifecycle.spec.ts` PARTNER-003 covers technician QC denial (403), technician attempt to bypass QC via status update (409), authorized manager QC pass (200 → ready), and delivery only after QC. It also asserts that delivery does not create dental-lab partner economics before a separate successful settlement.

**Current classification:** QC checklist and pass/sign-off path are implemented in source and covered by the partner lifecycle suite. A QC-failure-to-remake path is represented in code and unit validation, but the full end-to-end remake authorization/feedback lifecycle remains to be verified. Do not describe the whole dental-laboratory cabinet as complete.

**Remaining D10 gaps:**

1. Explicit remake request, authorization, feedback, rework ownership and closed-loop clinic acceptance.
2. Dispatch/shipping/pickup, tracking and proof-of-delivery.
3. Independent laboratory services catalogue and pricing administration.
4. Invoice → payment → settlement → payout, with refunds/chargebacks and idempotent financial reconciliation.
5. Durable, idempotent notifications across every material transition and AI operational exception summaries.
6. Complete owner/admin/manager/coordinator/technician/designer/QC/finance permission matrix, including branch scope and negative E2E tests.
7. Full desktop/mobile acceptance and exact-head CI/E2E evidence for the final integrated workflow.

No production/staging database, migration, payment provider, secret or live partner data was accessed or changed during this reconciliation. D10 remains OPEN/PARTIAL until all remaining lifecycle and release gates pass.

## 2026-11-21 continuation checkpoint — dispatch evidence, repeat remakes and production command surface (candidate PR #352)

The following source-level capabilities are now present on the candidate branch:

- Courier dispatch requires carrier and tracking number; clinic pickup uses a separate ready_for_pickup state.
- The generic status endpoint cannot mark a partner-owned case delivered. Delivery requires a validated HTTPS proof reference and recipient name; the transaction records shipment and order events, actor/time audit, durable clinic notification and an ecosystem event.
- Shipment records are one-to-many per canonical LabOrder. A completed shipment does not block a later remake cycle from creating a new dispatch. Earlier shipment evidence is retained; the lifecycle response returns all attempts and their individual event streams.
- Logistics users can process only ready/delivered handoffs. Their order projection removes patient, doctor, technical, clinical-note, QC, payment and price fields; lifecycle/technical detail remains reserved for managers and assigned production roles.
- Owners/managers can assign a technician from the production board. Assignment is validated against membership in that exact lab and written to the durable order event history.
- The work-item detail view loads the canonical lifecycle and presents the clinic technical brief, production events and shipment history. The event lists are merged chronologically; courier/logistics users cannot open this view.
- Partner Lifecycle E2E coverage includes courier and pickup, HTTPS validation, tenant/role denial, idempotent retry, clinic remake request, laboratory acceptance, repeated production/QC, a second pickup shipment and retained first/second shipment history.

**Release evidence limitation:** the most recent available Quality Gate run for the earlier candidate SHA b85101d8f7306a6f70c46b5e9feea888b475f9cd failed TypeScript at the stale Badge variant danger in DentalLabPlatform.tsx; the candidate code was changed to the supported error variant. That run predates the latest production-timeline changes and is not exact-head evidence. Vercel Preview is currently blocked by a build-rate-limit response. No exact-head TypeScript, lint, Release Gate or full Partner Lifecycle E2E success is claimed.

**Remaining D10 / dental-lab work:** CAD/CAM and workstation dispatch, governed STL/PLY/OBJ file/version management, materials and lot traceability, per-case labour/material costs, formal invoice/tax document lifecycle, branch subscription enforcement, remake warranty/cost responsibility, acceptance-based payment settlement, refund/chargeback reconciliation and durable notification delivery proof and full desktop/mobile/operator acceptance. Dental Laboratory remains **PARTIAL / D10 OPEN**. No production migration, payment-provider or bank payout integration, or live partner operation has been performed.

## 2026-11-22 continuation checkpoint — partner workspace authorization and catalog parity (candidate PR #352)

The candidate now tightens the shared diagnostic-center / laboratory workspace around the Master Spec's first-class organization and active-context rules:

- Referral-list authorization is selected by partner family: diagnostic centers require `diagnostics.read`; medical and dental laboratories require `lab.read`. These permissions are resolved from the active organization-scoped partner roles rather than the legacy global role.
- A partner can open its own private service catalogue when it is an active member of that organization. External discovery remains governed by `ecosystemVisible`; diagnostic-center catalogue reads still require an active center subscription. The same member-vs-public rule is applied to diagnostic studies and laboratory tests.
- The exact `/centers/:id/worklist/staff` endpoint is registered before the dynamic `/worklist/:referralId` endpoint, preventing the literal `staff` segment from being interpreted as a referral identifier.
- Workspace tabs and catalogue operations follow active IAM permissions. Finance, operational queue, catalogue management, team and cashier access are separated instead of being inferred from a generic partner role.
- Referral list/detail projections now separate clinical fields (`medical.read`), financial fields (`billing.read`) and attachments (`files.read`). Operational roles retain the minimal patient/work-item identity and workflow fields; finance-only dashboard projections do not receive the recent patient-referral list.
- Frontend IAM now recognizes the canonical `lab.read`, `lab.write` and `lab.manage` permissions alongside diagnostic, billing and staff permissions.

**Verification status:** this is candidate source work on PR #352, not a release certification. The latest recorded code/test head before this document update is `c3a3fd45bb4dd8cb3d73a4729168cef128d46342`; exact-head CI, Quality Gate and RB-034 were queued/in progress at the time of this checkpoint. Earlier CI on the pre-correction head exposed an IAM test type error, one frontend ESLint warning over the configured threshold, partner lab referral 403 responses and diagnostic-center catalogue/staff-route 404 responses. The fixes above are intended to address those findings; no passing result is claimed until a fresh final-head run completes.

**Classification remains PARTIAL:** this closes several workspace authorization, navigation and data-projection defects, not the complete RIS/PACS/LIS or dental-laboratory operating lifecycle. DICOM networking and a production viewer, analyzer integrations, full accession/chain-of-custody, QC/calibration evidence, remake feedback, shipping proof, financial reconciliation, mobile/operator acceptance and approved staging/production evidence remain separate requirements. No production/staging data, payment provider, secret, migration or deployment was accessed or changed in this checkpoint.


## 2026-11-24 continuation checkpoint — clinic acceptance after delivery and remake (candidate PR #352)

- Added clinic-side `POST /api/lab-orders/:id/acceptance`. It requires the authenticated active clinic, `lab.write`, the verified clinic branch scope, a partner-owned order in `delivered` state and the latest shipment's persisted delivery proof, recipient and delivered timestamp.
- Acceptance is idempotent per shipment. A pending remake decision blocks acceptance; opening a new remake request archives the previous accepted actor/time/shipment/feedback in `clinicAcceptanceHistory` and clears only the current-cycle acceptance. Shipment and lifecycle-event history is retained.
- The acceptance record stores the clinic actor, timestamp, shipment ID, related remake-request ID and optional feedback. It adds a durable lifecycle event with the production status unchanged, an audit record, clinic-to-lab notification and an ecosystem event.
- The clinic CRM now presents a separate acceptance action and displays current and prior-cycle acknowledgement/feedback; the partner projection exposes history to production roles and withholds feedback text from logistics. The dental-lab production projection exposes feedback to operational roles; the logistics projection does not expose the feedback note.
- Candidate E2E extends the partner lifecycle through first delivery → clinic acceptance → remake request/reset → repeated production/QC → second delivery → second clinic acceptance, including pre-delivery denial and idempotent retries. Exact-head CI is required before this flow is considered verified.
- **Classification remains PARTIAL / D10 OPEN.** CAD/CAM and governed file/version control, materials/lot traceability, per-case costs, tax/fiscal documents, acceptance-based financial settlement, warranty/cost responsibility, refund/chargeback reconciliation, notification delivery proof and full desktop/mobile/operator acceptance remain outstanding. No production/staging migration, real payment-provider transaction, payout, deployment or live partner workflow was performed.

## 2026-11-24 follow-up — acceptance-gated dental-lab invoice and settlement

- The laboratory cannot issue a new invoice until the clinic has accepted the latest persisted shipment with delivery timestamp, HTTPS proof and named recipient. Acceptance from an earlier shipment does not unlock the current case.
- Payment creation and the Finance Core settlement callback independently re-check the same acceptance evidence. A stale UI, legacy invoice or direct API call cannot settle an unaccepted delivery.
- The partner workspace and clinic CRM expose invoice/payment actions only after current-cycle acceptance. The commercial fee remains recorded only through the successful settlement event; delivery and acceptance alone create no partner-economics transaction.
- Unit tests cover missing/stale acceptance and incomplete proof. The partner lifecycle E2E asserts invoice denial before acceptance, invoice issuance after acceptance and idempotent invoice retry.
- **D10 remains PARTIAL / OPEN.** Warranty/cost responsibility for remakes, CAD/CAM file/version governance, materials/lot traceability, per-case costs, tax documents, refunds/chargebacks, settlement/payout reconciliation and desktop/mobile/operator acceptance remain separate gates.


## 2026-11-25 continuation — dental-lab material lots and per-case consumption (candidate PR #352)

- Added a laboratory-owned material catalogue, lot receipts, expiry dates, remaining quantities and immutable purchase-cost snapshots. This is separate from clinic `InventoryItem`, which remains clinic-scoped.
- Added per-`LabOrder` material-consumption records with an idempotency key, quantity in thousandths of the declared base unit, unit-cost snapshot, total cost snapshot and actor/time.
- Stock decrement is transaction-locked and rejects foreign-lab lots, expired lots, insufficient stock, inactive materials and duplicate idempotency keys with conflicting payloads.
- Manager-authorized reversals retain the original consumption row and record actor/time/reason while returning the quantity to the same lot. Material costs remain operational cost evidence and do not alter service price, partner commission or wallet balance.
- Exact-head Prisma generation, migration, unit tests, role/tenant E2E and mobile/operator acceptance remain required. This slice does not close CAD/CAM file versioning, formal tax/fiscal documents, warranty/cost allocation, refunds/chargebacks or complete D10.
