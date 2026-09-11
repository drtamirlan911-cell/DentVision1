# DentVision — North Star Addendum: Dental Laboratory + Welcome

**Status:** ACTIVE / P0
**Date:** 2026-09-11

This addendum extends `docs/DENTVISION_EXECUTION_NORTH_STAR.md` without creating a competing product specification.

## 1. Dental Laboratory is a first-class platform participant

DentVision is not complete if the laboratory is only a Lab Order screen inside the clinic.

The canonical ecosystem is:

```text
Patient
  ↕
Clinic / Doctor
  ↕
Dental Laboratory
  ↕
Inventory / Materials / Marketplace
  ↕
AI Employee
```

A dental laboratory has its own tenant, workspace, roles, permissions, production queue and operational lifecycle while remaining connected to the originating clinic case.

### Laboratory workspace

P0 capabilities:

- laboratory dashboard;
- incoming clinic orders;
- production queue / Kanban;
- order specification and permitted files;
- deadline and SLA visibility;
- technician assignment;
- production stages;
- QC / remake handling;
- delivery / handoff;
- laboratory team management;
- laboratory price list;
- materials and inventory connection;
- clinic/customer relationship context;
- production and remake analytics.

Canonical lifecycle may include:

`Новый → Принят → В работе → Примерка → Коррекция → QC → Готово → Выдано`

with explicit exception states such as `remake` and `delayed` where supported by the backend.

### Privacy boundary

The laboratory receives only the patient/case information necessary for the authorized work. Medical history, financial information and unrelated clinic data must never be exposed merely because a Lab Order exists.

### AI Employee

AI may:

- explain incoming work;
- surface approaching deadlines;
- identify queue bottlenecks from real data;
- connect a completed lab order to the clinic's next operational step;
- suggest material procurement when supported by real inventory data;
- draft actions.

Protected clinical, financial and inventory mutations remain confirmation-gated.

## 2. Welcome must represent the actual ecosystem

Welcome remains public and intent-first, but its service map must stay synchronized with the real DentVision platform.

The public surface should communicate that DentVision serves both:

- people seeking dental care;
- professionals and organizations operating dental workflows.

Current public intents:

- Записаться к врачу
- Найти диагностику
- Учиться
- Купить
- Найти работу

Professional entry contexts:

- Врач
- Клиника
- Лаборатория

A professional role must never be presented as a fake destination. If a role is shown on Welcome, its authentication context and post-login workspace must exist.

Welcome copy must include the laboratory ecosystem without turning the landing screen into a feature catalog.

## 3. Welcome UX rules

- Primary question: **Что вы хотите сделать?**
- One dominant AI entry point.
- Public discovery before unnecessary authentication.
- No duplicate global navigation.
- Six public service cards should remain scannable on mobile and desktop.
- Professional work contexts are visually secondary to public intent.
- No decorative animation that delays the first meaningful action.
- All labels describe user outcomes, not internal module names.
- New services must be added to Welcome only when their first meaningful action is actually available.

## 4. Acceptance criteria

- A new patient can immediately discover care.
- A new user can discover diagnostics without clinic membership.
- A professional can clearly understand that DentVision supports clinic and laboratory operations.
- A laboratory user entering through the professional context reaches the Dental Lab Production Workspace after authentication.
- Welcome does not claim capabilities that are not connected to a real workflow.
- Welcome and Figma design-system language remain visually consistent with the rest of DentVision.
