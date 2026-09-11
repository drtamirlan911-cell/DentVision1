# DentVision — Dental Laboratory Platform Execution Contract

**Status:** ACTIVE / P0 extension of `DENTVISION_EXECUTION_NORTH_STAR.md`
**Date:** 2026-09-11

This document extends the North Star with the Dental Laboratory as a first-class DentVision participant. It is not a separate product: the laboratory uses the same identity, AI, events, permissions, design system and operational data model as the rest of DentVision.

## Product position

DentVision is not complete if a clinic can send a `LabOrder` but the laboratory has no real workspace to receive, produce, control and deliver that work.

The canonical ecosystem is:

```text
Patient
   ↕
Clinic / Doctor
   ↕
Treatment Plan
   ↕
Lab Order
   ↕
Dental Laboratory
   ├─ Production
   ├─ Technicians
   ├─ QC / remake
   ├─ Materials / inventory
   └─ Delivery
   ↕
Clinic / Patient
```

## Laboratory workspace

The laboratory must have a dedicated tenant-safe workspace with:

- production dashboard;
- incoming orders;
- Kanban / production queue;
- order specification and permitted files;
- deadlines and SLA signals;
- technician assignment;
- production stages;
- QC and remake handling;
- delivery / handoff;
- laboratory team;
- materials and inventory connection;
- price list and commercial context;
- operational analytics;
- AI Employee assistance.

The first production lifecycle is:

`NEW → ACCEPTED → IN_PROGRESS → TRY_IN → CORRECTION → READY → DELIVERED`

Existing `LabOrder` statuses such as `cancelled`, `delayed` and `remake` remain supported where the canonical backend already provides them. Do not create a second order model merely to implement the laboratory UI.

## Roles

At minimum:

- Laboratory Owner / Manager
- Technician
- QC / Production staff
- Delivery / coordination staff

A laboratory user must be isolated from other laboratory tenants and must see only the clinic/patient data explicitly authorized for the order. Protected clinical data must not leak into general laboratory notifications or AI events.

## Clinic ↔ Laboratory workflow

```text
Doctor creates Lab Order
 → laboratory receives order
 → laboratory accepts / declines
 → technician is assigned
 → production stages advance
 → QC / correction / remake when required
 → work becomes READY
 → clinic receives durable notification
 → delivery / handoff
 → order becomes DELIVERED
```

The same order remains the source of truth throughout the lifecycle.

## Treatment Plan connection

Where a Lab Order belongs to a treatment-plan stage, the relationship must remain connected to the canonical treatment plan and appointment/invoice linkage. Laboratory actions must not create a shadow treatment plan.

When the laboratory marks work ready, DentVision should expose the next appropriate clinic action through the AI Employee and the treatment workflow. Clinical mutations still require the existing RBAC + confirmation policy.

## Inventory / materials

Laboratory production may consume or require materials, but DentVision must use the existing inventory source of truth. No fake consumption or procurement records are permitted.

When stock is below a real threshold, AI may recommend replenishment or open Marketplace procurement. Creating a financial or inventory mutation requires the normal confirmation boundary.

## AI Employee contract for laboratories

AI should:

1. brief the laboratory on today's queue and deadlines;
2. surface overdue / at-risk work from real orders;
3. identify workload concentration where real production data supports it;
4. suggest technician assignment without silently mutating assignments;
5. flag remake / correction patterns;
6. surface material shortages from real inventory;
7. propose the next operational action;
8. notify authorized clinic participants when work is ready;
9. never expose unauthorized patient or clinical information;
10. require confirmation for protected mutations.

## Public Welcome implications

Welcome must describe the current ecosystem without promising unavailable public flows. The laboratory is represented as a first-class working space, while public discovery is shown only when a real public discovery flow exists.

Current public intent:

`Работать с лабораторией → laboratory authentication → Dental Lab Workspace`

## Design contract

The laboratory workspace follows the existing DentVision premium design system and the Figma source of truth:

- one global shell;
- no permanent nested sidebar;
- contextual production tabs / filters;
- dense but scannable production board;
- clear primary next action;
- consistent typography, spacing, surfaces and interaction states;
- intentional mobile adaptation;
- no generic AI-dashboard visual language;
- Figma component/variant discipline must be preserved when the Figma connector is available.

## Definition of Done

The laboratory platform is complete only when:

- a laboratory tenant can authenticate;
- authorized staff can see its orders;
- a clinic can send a real order;
- the laboratory can progress the real order through production;
- technician assignment persists;
- deadlines/statuses are real;
- ready/delivered events reach authorized clinic users;
- treatment-plan linkage remains intact where applicable;
- tenant isolation is enforced;
- protected data is minimized in events/notifications;
- inventory integration uses canonical stock;
- AI suggestions are backed by real data;
- mutations obey confirmation policy;
- mobile and desktop workflows are usable;
- acceptance/verification paths exist.

This extension moves the execution order to:

```text
Welcome / Home
 → Patient + Diagnostics discovery
 → AI Employee
 → Clinic daily loop
 → Dental Laboratory workspace
 → Clinic ↔ Lab ↔ Treatment Plan ↔ Inventory
 → Marketplace / Academy / Jobs / Community depth
```
