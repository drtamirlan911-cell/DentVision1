# DentVision Current State

This file is the human-readable control point for future development sessions. The generated machine-readable counterpart is `.dentvision/current-state.json`.

## Current phase

**Phase 0 — CI stabilization**

Do not advance the roadmap until the current phase has evidence of completion.

## Roadmap

0. CI stabilization
1. Restore and verify `dentvision-backend/src/modules/patients/patients.routes.ts` against its original implementation
2. Backend runtime: server, health, DB, Redis, workers, environment and Docker
3. Security: RBAC, workspace/tenant isolation, ownership, audit and idempotency
4. AI Event OS
5. AI Employee Runtime: event → context → reasoning → permission → action → verification → audit → memory
6. Workspace-isolated AI threads and memory
7. Proactive role-specific AI
8. Web E2E
9. Android parity and E2E
10. Production deployment
11. Full UI/UX audit
12. Performance optimization
13. Final security audit
14. Release Gate

## Protected state

- PR #247 remains a work-in-progress until the release gates pass.
- PR #242 is obsolete/closed.
- Do not invent routes, permissions, data models or business rules to make tests pass.
- Preserve existing behavior when restoring/reconstructing files; compare against Git history first.

## Working rule

After each phase: make the change, run the relevant checks, record evidence, then proceed. If a check fails, fix it before advancing.

## Index

Run `npm run project:index` after structural changes to routes, APIs, roles, workspaces, tests or Android screens.
