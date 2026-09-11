# DentVision — Execution North Star & Completion Contract

**Status:** ACTIVE / EXECUTION CANON  
**Version:** 1.0  
**Date:** 2026-09-11  
**Audience:** Founder, Product, Design, Engineering, AI agents  
**Purpose:** convert the existing DentVision constitution/specification into one executable product contract and prevent UX drift.

> This document is an execution layer over the existing Mission, Product DNA and Platform Specification. It does not replace them. When documents conflict, Mission + Product DNA remain the authority; this document resolves implementation ambiguity and records the current target state.

---

## 1. North Star

**DentVision should not make users learn an application. DentVision should understand the user's intent and present the next correct action.**

DentVision is one AI Operating System for dentistry, not a collection of independent products.

The user should experience:

```text
Public Welcome
    ↓
Intent / discovery
    ↓
Contextual authorization only when personal data or mutation requires it
    ↓
Home / Command Center
    ↓
AI Employee + services
    ↓
One continuous workflow across Clinic · Diagnostics · Market · Academy · Jobs · Community · Finance
```

The AI Workspace remains the primary intelligent surface. The Home / Command Center is the orientation and service-launch surface for users who need to understand the ecosystem before entering a specific workflow.

---

## 2. What We Learned From Existing Specs

The repository already contains a strong product foundation:

- Mission defines DentVision as an AI Operating System rather than a CRM.
- Product DNA defines world-class references, AI-primary interaction, single source of truth, automation, RBAC, accessibility and quality gates.
- Personas define Doctor, Owner, Admin and Buyer as primary users plus extended platform roles.
- First-Run defines AI greeting, functional navigation and fast interaction.
- AI Intelligence defines memory, tools, agent routing, proactive intelligence and confirmation policies.
- Roadmap defines CRM+AI as the retention core and Shop/School/Network as ecosystem expansion.
- Module Status identifies important implementation gaps.

The problem is therefore **not lack of product ideas**. The problem is the gap between the documented ambition and the currently connected user journeys.

The execution priority is to close that gap instead of creating more isolated screens.

---

## 3. Corrections to Previous Direction

### 3.1 First-run sidebar

The older First-Run specification described a cinematic sidebar expansion and automatic 15-second collapse. That interaction is now considered **obsolete for the current product experience**.

New rule:

- AI surface is ready immediately.
- Desktop sidebar starts collapsed unless the user explicitly chose otherwise.
- No automatic sidebar expansion on application entry.
- No decorative navigation theatre.
- Sidebar may open because the user requests it, uses a navigation command, or has explicitly pinned it.
- Mobile uses bottom navigation / drawer patterns rather than a permanently expanded desktop rail.

This preserves the Product DNA requirement that AI is the primary intelligent surface while removing unnecessary chrome and startup friction.

### 3.2 Welcome vs Home

Welcome and Home are different products surfaces:

**Welcome** answers: “What can I do here?”  
**Home / Command Center** answers: “What should I do now?”

Welcome is public and intent-first. Home is authenticated/contextual and service-aware.

### 3.3 Patient booking

A button that navigates to login is **not** considered a booking flow.

The real target journey is:

```text
Find a doctor / clinic
 → choose city / location
 → filter specialty / service / availability
 → doctor or clinic profile
 → choose service
 → choose slot
 → authenticate/register only when required
 → confirm booking
 → confirmation + reminder
 → patient portal / booking history
```

A new patient must be able to discover a provider before being forced into clinic CRM membership.

### 3.4 Diagnostics

Diagnostics must be discoverable and usable by a new user without requiring membership in a clinic.

Target journey:

```text
Find diagnostics
 → location
 → study type
 → center
 → price / availability
 → order
 → confirmation
 → status
 → result
 → share / route result to authorized doctor
```

### 3.5 AI Employee

A chat box alone is not the DentVision AI Employee.

The employee contract requires:

1. proactive greeting;
2. useful daily briefing from real data;
3. detection of important events;
4. recommendations with a clear reason;
5. actionable controls;
6. navigation and platform actions through tools;
7. confirmation before protected clinical/financial mutations;
8. persistent context and memory under RBAC;
9. graceful manual fallback when AI is unavailable.

No fake metrics or fabricated operational events are permitted.

---

## 4. Canonical Information Architecture

### Global shell

There is **one global navigation system**.

Desktop:

```text
┌──────────────┬───────────────────────────────────────┐
│ Global rail  │ Workspace                             │
│              │                                       │
│ AI           │ Page / workflow                       │
│ Clinic       │                                       │
│ Diagnostics  │                                       │
│ Market       │                                       │
│ Academy      │                                       │
│ Jobs         │                                       │
│ Community    │                                       │
│ More         │                                       │
└──────────────┴───────────────────────────────────────┘
```

Mobile:

```text
AI · Clinic · Diagnostics · Market · More
```

Rules:

- no permanent nested sidebar inside a major module;
- module-specific navigation belongs in contextual tabs, segmented controls, sheets or page-level actions;
- sidebar groups can collapse;
- sidebar must not auto-expand on entry;
- route changes must not destroy useful AI context;
- desktop layouts must be designed for desktop rather than stretching mobile layouts across large screens.

### Service map

Home exposes a small, role-aware set of service cards. It must not reproduce the entire sidebar.

Primary services:

- AI Employee
- Clinic
- Diagnostics
- Market
- Academy
- Jobs
- Community
- Finance / Analytics when relevant to the current role

Cards are entry points, not duplicate navigation menus.

---

## 5. Role Scenarios — Definition of the Product

### Doctor

**Morning:** AI greeting → today's schedule → risks → lab/results → priority patient → open chart.  
**During visit:** patient → chart → odontogram → diagnosis/draft plan → treatment plan → documentation.  
**After visit:** next appointment → lab order → patient communication → learning recommendation.

Success: the doctor can complete the clinical morning loop without menu hunting.

### Owner

AI briefing → revenue / utilization / debts → exceptions → staffing → inventory → recommended actions → approval.

Success: owner sees what requires attention instead of opening reports one by one.

### Admin

AI briefing → today's bookings → confirmations → cancellations → waiting list → payments → documents → follow-up.

Success: routine reception work can be handled in batches and from AI.

### Patient

Welcome → find doctor/clinic → compare → choose service/slot → register when needed → book → reminders → results/history.

Success: no clinic account is required merely to discover care.

### Buyer

Need → search → compare suppliers → verify stock/price → checkout → order tracking → reorder.

Success: procurement feels like one marketplace, connected to clinic inventory.

### Diagnostic center

Public profile → services → availability → incoming orders → study status → result upload → authorized delivery.

Success: diagnostic center does not need a clinic-only workflow to receive legitimate orders.

### Laboratory

Orders → specifications/files → production status → deadline → delivery → remake analytics.

Success: lab work is connected to the patient case and clinic workflow.

### Student / Lecturer

Discover → course/case → enrollment → learning → assessment → certificate → professional profile.

Success: learning feeds the professional identity and network.

### Recruiter / Job seeker

Profile → search → match → apply → communication → hiring outcome.

Success: jobs are connected to credentials and professional identity.

---

## 6. P0 Completion Program

These are product-completion workstreams, not suggestions.

### P0-A — Shell and desktop

- [ ] sidebar never auto-opens on entry;
- [ ] collapsed/pinned preference persists;
- [ ] desktop shell has correct content offsets and max-widths;
- [ ] no horizontal overflow caused by shell;
- [ ] no nested permanent sidebars;
- [ ] keyboard navigation and focus states work;
- [ ] mobile and desktop use intentionally different shell mechanics;
- [ ] empty/loading/error/success states are visually coherent.

### P0-B — Welcome → Home

- [ ] public Welcome remains intent-first;
- [ ] service discovery works without unnecessary auth;
- [ ] authenticated user lands on Home / Command Center;
- [ ] Home is role-aware;
- [ ] Home contains useful service cards without duplicating sidebar navigation;
- [ ] AI briefing is visible from Home;
- [ ] no fake dashboard metrics.

### P0-C — Patient acquisition and booking

- [ ] public doctor/clinic discovery exists;
- [ ] search/filter is backed by real data;
- [ ] doctor/clinic profile is usable;
- [ ] services are selectable;
- [ ] availability is real, not decorative;
- [ ] registration/login is invoked at the correct privacy/action boundary;
- [ ] appointment creation persists to the canonical appointment model;
- [ ] duplicate booking is prevented;
- [ ] confirmation is visible;
- [ ] booking appears to both patient and clinic according to permissions;
- [ ] reminders/status changes have a defined path.

### P0-D — Diagnostics discovery and order

- [ ] public diagnostics discovery exists;
- [ ] center profiles and services are real;
- [ ] location/search filters work;
- [ ] order/request persists to canonical data;
- [ ] status lifecycle is visible;
- [ ] result delivery respects patient/doctor permissions;
- [ ] AI can summarize an authorized result without replacing professional review.

### P0-E — AI Employee

- [ ] role-aware greeting;
- [ ] daily briefing from real sources;
- [ ] “I noticed” / “I recommend” cards;
- [ ] up to three high-value suggested actions;
- [ ] action buttons execute or navigate to real destinations;
- [ ] protected actions require confirmation;
- [ ] tool results are visible;
- [ ] conversation survives reload;
- [ ] degraded/manual mode works;
- [ ] no fabricated metrics/events;
- [ ] proactive events are deduplicated and non-spammy.

### P0-F — Design quality

- [ ] one visual language across Welcome, Home, AI and modules;
- [ ] typography and spacing are consistent;
- [ ] premium dark/light surfaces are deliberate, not generic;
- [ ] primary action is obvious within two seconds;
- [ ] cards are used for hierarchy, not decoration;
- [ ] tables/dense clinical screens remain scannable;
- [ ] interaction states exist for hover/focus/pressed/disabled/loading/error;
- [ ] accessibility basics pass on all critical flows.

---

## 7. Definition of Done — Product, Not Screen

A workflow is **DONE** only when all are true:

1. A new user can discover the entry point.
2. The happy path reaches a real backend/source of truth.
3. The action persists and is visible to the correct participants.
4. Authentication occurs only where necessary.
5. Permissions and tenant isolation are enforced.
6. Empty/loading/error/success states are implemented.
7. AI can assist the workflow where appropriate.
8. Manual fallback works when AI is unavailable.
9. Clinical/financial mutations use the required confirmation policy.
10. Desktop and mobile behavior are intentionally designed.
11. The workflow has acceptance tests or an executable verification path.
12. The experience does not require instructions to understand the next step.

A visually complete page with a fake or disconnected action is **INCOMPLETE**.

---

## 8. Evidence-Based Gap Register From Existing Repository Docs

The existing Module Status document already records these implementation risks. They remain relevant until verified in the current runtime:

| Area | Previously recorded state | Execution implication |
|---|---|---|
| IntelligenceLayout | Partial / too large | shell must be split by responsibility without changing product behavior blindly |
| AI Workspace | Partial | greeting, actions, persistence and production behavior must be verified |
| Design System | Partial | missing primitives must be added only when a real workflow needs them |
| CRM | Partial | finance and connected workflows require completion |
| Shop | Partial | remove mock-data dependency from production happy paths |
| School | Partial | live/practical learning remains a later completion stream unless it blocks current journeys |
| Notifications | Partial | proactive AI needs reliable event delivery |
| WebSocket | Partial/missing by backend path | realtime behavior must use the actual deployed backend architecture, not assumptions |
| Analytics | Missing/placeholder | do not present fake analytics on Home |
| Jobs | Partial | employer side must be completed before claiming a two-sided marketplace |
| Community | Partial | comments/media remain non-core until network loop is activated |
| Mobile | Partial | safe-area and touch behavior must be verified on real devices |
| Error handling | Partial | route-level boundaries and recoverable states are required |
| Backend Auth | Partial | logout/reset/session behavior needs production verification |
| Backend AI | Partial | multi-agent behavior is not complete merely because rule files exist |
| Files | Missing/fake storage in one backend | document/image workflows must use a real storage path before production claims |
| Validation | Partial | request validation must be active at boundaries |
| New backend CRUD | Missing in recorded status | patient/clinic/appointment flows must use whichever backend is actually authoritative; no shadow model |
| Database migrations | Missing in recorded status | production schema evolution must gain versioned migrations before scale |

This register is a **verification queue**, not permission to start another endless audit. Each item must be resolved only when it blocks a real user journey, reliability, security or release quality.

---

## 9. Architecture Guardrails

### Single source of truth

One patient, one appointment, one inventory record, one clinic identity. UI layers may present different views but MUST NOT create shadow records.

### Public vs private boundary

Public discovery may expose only intentionally public provider/service information. Personal medical, financial and booking mutation data requires the appropriate authenticated context.

### Multi-role identity

A user may hold multiple capabilities. Do not force a permanent one-role identity when the underlying account can safely support multiple roles/scopes.

### AI safety

AI may answer, navigate, draft and propose. Protected clinical/financial mutations require RBAC + confirmation. Diagnostic assistance remains assistive and reviewable.

### Data provenance

AI claims about patients, finance, inventory, appointments or diagnostics must be traceable to authorized platform data. If data is unavailable, the UI must say so rather than inventing it.

### No navigation duplication

If a destination already exists in global navigation, do not create another permanent navigation rail for the same destination.

---

## 10. Product Quality Metrics

The implementation should optimize measurable outcomes rather than screen count.

### Activation

- Time to first meaningful action
- Time to first successful booking
- Time to first successful clinic action
- Time to first useful AI response

### Workflow efficiency

- steps/clicks for common jobs;
- time to complete booking;
- time to open patient context;
- time to confirm daily appointments;
- time to reorder a known product.

### AI Employee

- percentage of greetings backed by complete real data;
- recommendation acceptance rate;
- successful tool-action rate;
- false/proactive-noise rate;
- percentage of morning loop completed through AI.

### Reliability

- error rate by critical flow;
- failed mutations;
- duplicate bookings;
- tenant-isolation incidents;
- degraded-mode recovery.

Do not optimize these metrics by fabricating activity or hiding failure states.

---

## 11. Competitive Reference Rule

Use competitors as **principle references**, not visual copies.

- ChatGPT → conversation, memory, tool use, streaming
- Linear → speed, focus, keyboard fluency, restrained motion
- Apple → hierarchy, accessibility, restraint
- Stripe → trust, progressive disclosure, precise workflows
- Kaspi → ecosystem coherence and low-friction commerce
- Doctolib / Zocdoc-class booking → public discovery before forced clinic membership
- Dental practice systems such as Dentrix/Dentally/Curve → deep dental operational context
- Figma → component/variant discipline and design-to-code consistency
- Shopify-class commerce → catalog, checkout and order state clarity
- modern education platforms → learning continuity and credential identity

DentVision must adapt these principles to dental workflows, privacy, clinical safety and the AI operating-system model.

---

## 12. Execution Order

Do not build in random feature order.

```text
1. Shell + desktop correctness
        ↓
2. Welcome → Home / Command Center
        ↓
3. Patient discovery → booking
        ↓
4. Diagnostics discovery → order → result
        ↓
5. AI Employee briefing + proactive actions
        ↓
6. Doctor / Owner / Admin daily loops
        ↓
7. Clinic ↔ Lab ↔ Inventory connected workflows
        ↓
8. Marketplace / Academy / Jobs / Community depth
        ↓
9. Analytics + automation density
        ↓
10. Imaging / hardware readiness
```

Parallelization is allowed, but no parallel task may create a second source of truth or conflicting navigation model.

---

## 13. Release Gate

DentVision is ready for a meaningful public release only when these journeys are demonstrably executable:

- **New patient:** Welcome → find provider → book → confirmation.
- **New diagnostic user:** Welcome → find center → request study → status/result path.
- **Doctor:** sign in → AI briefing → patient → chart/plan → next action.
- **Admin:** sign in → AI briefing → confirmations → payment/document action.
- **Owner:** sign in → AI briefing → business exception → action/approval.
- **Buyer:** search → compare → checkout → order tracking.

For every journey, verification must cover desktop + mobile, success + failure, permission boundaries and persistence.

---

## 14. Documentation Rule

Every material implementation decision must be reflected in one of:

- code;
- this execution contract;
- the relevant canonical specification;
- an ADR/decision record;
- automated acceptance coverage.

A decision that exists only in a chat message is **not a DentVision product decision**.

When implementation changes the product contract, update this document or the higher-level canonical specification in the same change.

---

## 15. Final Product Law

> **Make the next correct action obvious. Make the action real. Carry the context forward. Remove everything unnecessary.**

If a new screen, menu, card, animation or AI feature does not improve that loop, it should not be added merely because it looks impressive.

DentVision wins by making the complexity of dentistry disappear behind one coherent, intelligent system.
