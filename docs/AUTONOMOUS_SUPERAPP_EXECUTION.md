# DentVision — Autonomous Super App Execution Contract

Status: ACTIVE

This document turns the DentVision mission into an executable engineering contract. The source repository already defines DentVision as an AI Operating System for Digital Dentistry rather than a collection of disconnected modules. This contract is subordinate to the existing Mission, Product DNA, Super App Blueprint, UX Blueprint, and Release Gate.

## Operating mode

For every iteration:

1. Inspect existing implementation before changing it.
2. Preserve working behavior and public contracts unless there is a verified reason to change them.
3. Prefer integration over parallel duplicate implementations.
4. Implement the smallest coherent production change.
5. Run the strongest available static/test/CI validation.
6. Fix failures before moving to the next layer.
7. Record remaining risks instead of declaring success without evidence.

## Product north star

DentVision should feel like one operating system with one intelligence layer:

- AI Workspace is the primary interaction surface.
- CRM is the clinical system of record.
- Marketplace, School, Jobs, Community, Analytics, Laboratory and Finance are connected modules.
- Patient, clinic, staff, supplier, laboratory and education workflows share identity and permissions.
- Web and Android must expose the same business capabilities and compatible navigation semantics.

## Release gates

A release is not considered production-ready until the repository has evidence for:

- authentication and session lifecycle
- RBAC and tenant isolation
- IDOR resistance on every tenant-bound resource
- patient and medical-card workflows
- appointments and treatment plans
- documents/files
- diagnostic workflows
- AI actions and safe confirmation boundaries
- marketplace and checkout
- payments/webhooks
- academy
- database migrations and integrity
- API error handling and validation
- end-to-end critical paths
- web production build
- Android production build
- TypeScript/type safety
- lint
- unit/integration tests
- security checks
- responsive/mobile UX

## Critical end-to-end workflow

The primary clinical journey must remain coherent:

`Patient → Appointment → Visit → Diagnosis → Treatment Plan → Consent/Communication → Payment → Laboratory/Orders → Follow-up → Analytics`

AI should be able to assist at each appropriate stage without silently performing high-impact clinical or financial actions.

## Super App UX principles

- One visual language.
- One navigation model.
- One command/search surface.
- Progressive disclosure instead of dense dashboards.
- Mobile-first interaction targets.
- No dead buttons, fake success states, unexplained placeholders or duplicated screens.
- Every empty state explains what to do next.
- Every async action has loading, success and failure states.
- Destructive and high-impact actions require explicit confirmation.

## Current repository baseline

The repository currently contains a React/Vite/TypeScript web application, a Node/Express/Prisma backend, PostgreSQL integration, WebSocket infrastructure, an Android application, a design-system layer, AI workspace components, CRM, Shop, School and Analytics surfaces, plus CI/release-gate documentation.

The existing release gate is intentionally conservative and currently records its checks as pending. That status must only be changed when validation evidence exists.

## Definition of done

A feature is done only when:

- the user journey works end-to-end;
- authorization is enforced server-side;
- loading/error/empty states exist;
- mobile layout is usable;
- the feature is reachable from the intended navigation surface;
- data mutations are validated and tenant-scoped;
- tests cover the critical behavior;
- web and Android parity is addressed where applicable;
- CI remains green.

## Priority order

P0 — security, data isolation, authentication, broken production paths, build blockers.

P1 — clinical core, AI workspace, navigation, cross-module workflows, Android parity.

P2 — marketplace, academy, jobs/community, analytics depth, visual polish and advanced automation.

Never sacrifice P0 correctness for P2 visual work.
