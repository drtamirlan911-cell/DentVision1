# DentVision Super App — Master Product & Visual Control

## Non-negotiable rules
- Work only through the active feature PR/branch unless explicitly instructed otherwise; never change `main` directly.
- Preserve all existing functionality, routes, API contracts, database behavior, AI logic, permissions, workflows, and data relationships.
- Visual/UX work must make DentVision feel like one Dental Operating System, not separate CRM/Shop/School/AI products.
- No uncontrolled redesign from scratch.
- No purple/blue gradients, neon, glow-heavy AI, excessive glassmorphism, giant decorative cards, or template-like SaaS styling.
- Prefer clinical neutral surfaces, restrained gold accent, strong typography hierarchy, compact information density, subtle borders, restrained radii/shadows, and excellent mobile behavior.
- Every new change must be checked against this document before implementation.

## Product north star
DentVision should combine the strongest patterns from leading dental PMS, cloud practice systems, patient-engagement platforms, AI workflow products, modern productivity tools, education platforms, commerce systems, and super-app navigation — while remaining distinctly DentVision.

Core object: **Clinical Case**.
Clinical graph: Patient → Diagnosis → Imaging → AI Findings → Treatment Plan → Appointments → Procedures → Lab → Materials → Documents → Payments → Communication → Follow-up → Outcome.

Global hierarchy: GLOBAL → WORKSPACE → ENTITY → ACTION → AI.
AI Workspace state: IDLE → THINKING → EXECUTING → RESULT → CONFIRMATION.

## Global shell
- Workspace: AI Workspace, Practice, Diagnostics
- Business: Shop, Academy, Analytics
- Network: Jobs, Community
- More: Profile, Settings, Help
- Administration: role-based admin tools
- Desktop sidebar + mobile bottom navigation
- Global command/search center
- Context-aware AI layer and notifications

## Visual system
Single DentVision theme across all services:
- Light: clinical white/neutral surfaces, charcoal text, muted gray hierarchy, restrained gold accent.
- Dark: charcoal/graphite surfaces, soft white text, restrained gold accent.
- Semantic colors only for meaning: success, warning, danger, info.
- One surface hierarchy: page background → surface → raised surface → selected/active surface.
- One border language and one shadow language.
- Radius scale: 8 / 11 / 14 / 18px; avoid arbitrary giant rounding.
- No page-sized gradients; no visual theme changes between services.
- AI should look like an integrated clinical intelligence layer, not a glowing chatbot toy.

## UX principles to continuously enforce
1. Reduce clicks and context switching.
2. Surface the next best action instead of forcing users to hunt through menus.
3. Keep patient/case context persistent across clinical workflows.
4. Make high-frequency tasks fast: schedule, patient search, visit, charting, treatment plan, payment, lab, diagnostics, follow-up.
5. Progressive disclosure: advanced controls appear when needed.
6. Dense desktop workflows; touch-safe mobile workflows.
7. Empty/loading/error/success states must use the same design language.
8. Search and command actions should work consistently across the product.
9. Role-based navigation must remain intact.
10. Accessibility, keyboard navigation, focus states, reduced motion, and readable contrast are product requirements.

## Competitive capability checklist
Study and selectively adopt the best interaction patterns from:
- Dental PMS: Dentrix, Eaglesoft, Open Dental, Curve Dental, CareStack, Denticon/tab32.
- Patient engagement: NexHealth, Weave, Solutionreach/RevenueWell.
- Productivity: Linear, Notion.
- Commerce: Shopify-class catalog/cart/order patterns.
- Education: modern LMS/course/progress/certification patterns.
- Super-app: Kaspi-class service discovery and contextual shortcuts.
- AI: context-aware copilots, approvals, explainable actions, human confirmation for consequential operations.

Do not copy branding or proprietary UI. Extract proven interaction patterns and adapt them to DentVision.

## Completed in current visual program
- [x] Unified Super App sidebar/navigation.
- [x] Unified visual theme and semantic palette.
- [x] Unified global surface/border/text treatment.
- [x] Removed/neutralized major legacy gradients, glow shadows, and glass surfaces.
- [x] Unified buttons, inputs, badges, cards, progress, tabs, modal/popover/dropdown/toast behavior.
- [x] Improved mobile touch targets and bottom navigation.
- [x] Unified Dashboard/service hub/quick actions.
- [x] Polished Diagnostics result list.
- [x] Polished Academy, Wallet, payment QR, AI context, and other identified screens.
- [x] Created and maintained PR #245: `feat/unified-dentvision-visual-system`.
- [x] Established persistent master-plan/change-control workflow.
- [x] Normalized additional legacy translucent surfaces, black/white utility surfaces, cyan service gradients, oversized shadows, and focus states at the shared theme layer.
- [x] Aligned legacy `design-tokens.ts` with the unified clinical neutral/gold visual foundation while retaining token names for compatibility.

## Current active pass
- [ ] Find remaining legacy visual outliers across Dashboard, AI, Analytics, Academy, Shop, Diagnostics, Auth and shared primitives.
- [ ] Normalize remaining inline gradients and hard-coded service-specific colors that cannot be safely handled by the shared theme.
- [ ] Normalize remaining mobile overlays and shared interaction surfaces.
- [ ] Verify cross-page consistency after every batch.

## Canonical multi-branch operating model

A Branch is a first-class operating unit of an Organization/Clinic and must be represented consistently in product architecture, navigation, authorization and analytics. It is not merely a location string.

### Owner flow

`Settings/Organization → Branches → Create Branch → Configure → Staff & Access → Operations → Analytics → Archive/Suspend`

The owner must be able to discover this flow from normal navigation and must not need to know internal API/model names.

### Branch workspace

When a branch is opened, the workspace should expose, according to real permissions and implemented domain capabilities:

- Overview / operational status;
- Staff and branch assignments;
- Schedule, rooms/chairs and equipment where supported;
- Patients and Clinical Cases;
- Services and branch-specific price overrides;
- Inventory/warehouse and inter-branch transfers;
- Diagnostics and laboratory routing;
- Finance, payments and cash operations;
- Analytics and branch performance;
- Documents/templates;
- Notifications, reminders and patient communication;
- AI context, alerts and automation preferences;
- Branch Settings.

### Branch configuration

Minimum branch identity: unique organization-scoped code, name, city, address, phone, active/default state and settings. Operational configuration should progressively cover working hours/holidays, staff/access, rooms/chairs/equipment, services/pricing, inventory, diagnostics/labs, finance/payment, documents, notifications and AI preferences using existing domain models.

Shared organization policies/services remain canonical. Branch-specific overrides must be explicit and must not create duplicate domain definitions.

### Branch switching and data scope

The active organization context and active branch context are separate but related. Organization-scoped owners may switch branches and may aggregate branch data where authorized. Branch-scoped users must be constrained to their assigned/permitted branch set. Cross-tenant access remains denied.

Applicable branch-aware resources include patients, appointments, staff memberships, inventory, invoices/expenses, referrals/diagnostics and future clinical/operational entities. UI, API, AI and background actions must use the same scope rules.

### Branch lifecycle safety

Branch creation must persist and survive refresh. Edit must persist. Staff assignment must affect effective access. Archive/suspend must be reversible where supported, preserve history/audit records, avoid silent orphaning and block inappropriate new operations. Historical patients, appointments, invoices, expenses, inventory and referrals must not disappear because a branch is archived.

### Product requirement vs implementation status

This section defines the canonical product requirement. It is not evidence that every branch screen, route, API or workflow is already implemented. Implementation status is determined only from current repository code and current CI/runtime evidence.

## Next product passes after visual unification
### Phase A — Navigation & information architecture
- [ ] Audit every route and sidebar item.
- [ ] Ensure service hierarchy is predictable.
- [ ] Add contextual breadcrumbs/entity headers where useful.
- [ ] Make command/search a true global entry point.
- [ ] Add and verify the owner `Settings/Organization → Branches` entry point without creating duplicate navigation.

### Phase B — Clinical operating system
- [ ] Patient 360 as the central longitudinal view.
- [ ] Clinical Case workspace.
- [ ] Treatment-plan timeline and case acceptance flow.
- [ ] Odontogram/charting workflow.
- [ ] Imaging/diagnostics context linking.
- [ ] Lab/material/document/payment relationships.

### Phase C — AI operating layer
- [ ] One AI interaction model across the app.
- [ ] Context-aware suggestions tied to patient/case.
- [ ] Explainable findings and confidence.
- [ ] Action previews before consequential changes.
- [ ] Approval queue and audit trail.
- [ ] AI-generated documentation with clinician control.

### Phase D — Practice operations
- [ ] Schedule optimization.
- [ ] Recall/no-show workflow.
- [ ] Patient communication.
- [ ] Cashier/finance.
- [ ] Inventory and lab operations.
- [ ] Team/roles/multi-location, including the canonical branch lifecycle above.
- [ ] Operational analytics.

### Phase E — Ecosystem
- [ ] Diagnostics center workflows.
- [ ] Shop/catalog/orders/supply chain.
- [ ] Academy/course/progress/certification.
- [ ] Jobs/community/network.
- [ ] Profile/settings/help.

### Phase F — Release excellence
- [ ] Accessibility audit.
- [ ] Responsive audit at real phone/tablet/desktop breakpoints.
- [ ] Performance and bundle audit.
- [ ] Error/loading/empty-state audit.
- [ ] Security/permissions regression audit.
- [ ] E2E critical-path coverage.
- [ ] Production release gate.

## Change ledger
### 2026-09-09
- Completed shared theme normalization for additional translucent legacy surfaces, black/white utility surfaces, cyan service gradients, oversized shadow classes, and keyboard focus states.
- Completed legacy design-token normalization so older components using `T`/`COLORS` no longer introduce a separate navy/purple/cyan/pink visual language.
- Rationale: reduce cross-service visual drift without changing application behavior or token API names.
- Active branch: `feat/unified-dentvision-visual-system`.
- Active PR: #245.
- Regression status: visual/token changes only; CI validation remains required.

### 2026-09-16
- Added the canonical multi-branch operating model to the Super App master plan.
- Defined owner discovery/creation/configuration/staff/operations/analytics/archive flow, branch workspace scope, branch-aware resources, switching, isolation and lifecycle safety.
- This is a product requirement; implementation status remains determined by repository code and fresh CI/runtime evidence.

Future changes must append a dated entry describing what changed, why, what remains, regression/test status, and the active PR/branch.
