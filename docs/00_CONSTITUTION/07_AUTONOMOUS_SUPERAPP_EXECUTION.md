# DentVision Autonomous Super App Execution Contract

Version: 1.0  
Status: ACTIVE  
Owner: DentVision Engineering

## 1. Objective

DentVision is developed as one AI-native dental operating system, not as a collection of independent pages. Existing working functionality is preserved unless a replacement demonstrably improves reliability, security, UX, or maintainability.

## 2. Execution Loop

Every implementation cycle follows:

1. Inspect the existing implementation and its dependencies.
2. Identify the smallest safe change that advances the product.
3. Implement the change in the active feature branch.
4. Validate types, lint, tests, build, routing, and affected workflows where tooling is available.
5. Fix discovered regressions before moving to the next dependency.
6. Record architectural or release-gate changes in repository documentation.

A report without implementation is not considered completion for an engineering task.

## 3. Product Layers

### Experience
- Home / AI Workspace
- Global navigation and command palette
- Responsive Web and Android experiences
- Shared design tokens and interaction patterns

### Clinical Core
- Patients
- Medical records
- Odontogram
- Appointments
- Diagnosis
- Treatment plans
- Documents and files
- Laboratory and diagnostics

### Intelligence
- AI assistant
- Clinical analysis
- Treatment planning assistance
- Context-aware navigation and actions
- Explainable recommendations with human confirmation for consequential actions

### Business Ecosystem
- Finance / cashier
- Shop / procurement
- School / Academy
- Jobs
- Community
- Analytics
- Profile / organization administration

### Platform
- Authentication
- RBAC / permissions
- Tenant isolation
- Audit log
- API contracts
- Database integrity
- Observability
- Offline/sync readiness

## 4. Non-Negotiable Invariants

1. A user must never read or mutate another tenant's protected clinical or financial data.
2. Authorization is enforced server-side; UI visibility is not a security boundary.
3. AI may recommend or prepare actions, but consequential clinical, financial, permission, or deletion actions require an explicit authorization boundary.
4. Patient data is never silently fabricated to make an interface appear complete.
5. Loading, empty, error, success, and permission-denied states are first-class UI states.
6. Every important navigation target must resolve to a real route or an intentional unavailable state.
7. Web and Android share domain semantics and API contracts even when presentation differs.
8. New functionality must use the existing design system rather than introduce a parallel visual language.
9. Production code must not depend on development-only mocks or hardcoded credentials.
10. Release status is determined by executable checks, not by documentation claims.

## 5. UX Quality Bar

The default user journey should minimize navigation and data re-entry. Prefer contextual actions, progressive disclosure, search/command access, sensible defaults, and clear next steps. Dense clinical workflows should remain fast on desktop while preserving touch-safe interaction on mobile.

## 6. Completion Definition

A module is complete only when its UI, API, authorization, persistence, error handling, tests, navigation, and release-gate coverage are coherent. A page that renders but cannot safely complete its intended workflow is incomplete.

## 7. Release Principle

`NOT READY` remains the default until blocking checks pass. The existing release gate explicitly tracks AUTH, RBAC, tenant isolation, IDOR, clinical modules, AI, marketplace, payments, academy, security, database, API, E2E, build, typecheck, lint, and unit tests. Those checks must be progressively converted from placeholders into evidence-backed validation.
