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
