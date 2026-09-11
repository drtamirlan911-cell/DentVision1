# DentVision — Laboratory + Welcome Execution Addendum

**Date:** 2026-09-11  
**Status:** ACTIVE  
**Parent:** `docs/DENTVISION_EXECUTION_NORTH_STAR.md`

## 1. Product correction

DentVision is not complete if Laboratory exists only as a clinic-side Lab Order screen. A dental laboratory is a first-class ecosystem participant and requires its own tenant-safe production workspace.

The canonical ecosystem is:

```text
Welcome
  ↓
Intent / discovery
  ↓
AI Employee + services
  ↓
Clinic ↔ Diagnostics ↔ Dental Laboratory ↔ Marketplace / Inventory
```

## 2. Dental Laboratory platform

The Laboratory becomes a first-class service and role with:

- laboratory tenant and RBAC;
- laboratory owner/manager workspace;
- technician workspace;
- incoming orders;
- production queue / Kanban;
- specification and file review;
- deadlines and priority;
- production lifecycle;
- remake / correction tracking;
- delivery / handoff;
- laboratory team and workload;
- materials and inventory connection;
- pricing and operational analytics;
- clinic relationship context;
- AI Employee assistance.

The platform MUST reuse the canonical `LabOrder` and existing event infrastructure rather than creating a shadow order system.

## 3. Canonical laboratory flow

```text
Clinic / Doctor
 → Lab Order
 → Laboratory receives order
 → Accept / request clarification
 → Production
 → QC / correction
 → Ready
 → Delivery / handoff
 → Clinic receives result
 → Treatment workflow continues
```

Patient and clinical data exposed to laboratory users must be the minimum necessary for the authorized work. Tenant isolation is mandatory.

## 4. Welcome update

Welcome must accurately communicate the current ecosystem. It should no longer imply that DentVision consists only of AI + clinic + diagnostics + education + Shop.

Welcome must expose:

- patient care / booking;
- diagnostics;
- dental laboratory ecosystem;
- Academy;
- Marketplace;
- Jobs;
- AI Employee;
- role-aware work entry for Doctor, Clinic/Owner and Laboratory.

Welcome remains public-first and task-first. Do not add a generic feature grid or duplicate the global navigation.

## 5. Figma design contract

The Laboratory workspace and Welcome updates must follow the existing DentVision Figma design system and its component/variant discipline.

Design rules:

- no generic AI-dashboard appearance;
- premium restrained surfaces;
- strong hierarchy and whitespace;
- production queue optimized for rapid scanning;
- contextual actions instead of nested permanent sidebars;
- mobile and desktop are intentionally composed;
- Welcome communicates the ecosystem without becoming a feature catalog.

Figma remains the visual source of truth when connector capacity allows synchronization. Code must not invent a competing design language.

## 6. Execution order update

The next connected workflow is:

```text
Lab Platform
   ↓
Lab Order
   ↓
Treatment Plan / case context
   ↓
Inventory / materials
   ↓
AI Employee
   ↓
Clinic next action
```

Each mutation must use existing RBAC and confirmation policies. No fake production metrics, orders, stock or AI events are permitted.
