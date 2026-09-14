# DentVision — Continuation State

Updated: 2026-09-14
Branch: `feat/iam-role-matrix-v2`
PR: #275
Latest known head before this state commit: `f238e5f08ec86c59437dfc46ee1d12c7ffb8e0b0`

## Current objective
Complete the IAM/release-gate work without weakening tests or faking product functionality. The next major architectural task is **real branch management and branch isolation**.

## Product role matrix
Clinic roles:
- OWNER — organization scope
- ADMIN — organization scope
- MANAGER — branch scope
- DOCTOR — assigned scope
- ASSISTANT — assigned scope
- RECEPTIONIST — branch scope
- CASHIER — branch scope
- ACCOUNTANT — organization scope

Specialized partner families:
- Diagnostic Center: 9 roles
- Medical Lab: 9 roles
- Dental Lab: 10 roles
- Total specialized partner roles: 28

## Branch architecture decision
Target model:
`Organization → Branch → Clinic / operational data → Members`

`Organization` already exists and is the IAM/business ownership layer. `Clinic` remains the operational clinic entity for backward compatibility. A real `Branch` entity must be introduced; do not simulate branches only in UI/tests.

Minimum Branch fields:
- id
- organizationId
- name
- code
- address
- phone
- city
- active
- createdAt
- updatedAt

Recommended constraints:
- unique `(organizationId, code)`
- index `(organizationId, active)`

Membership direction:
- Existing `ClinicMember` should gain nullable branch assignment initially for backward compatibility.
- Do not casually replace existing `[userId, clinicId]` uniqueness.
- If multi-branch membership is required, prefer a dedicated assignment model rather than forcing one branch into a membership that must remain unique.

Authorization requirements:
- Owner/Admin: manage and see all organization branches.
- Manager: only assigned branch(es).
- Doctor/Assistant: only assigned operational data.
- Cross-branch access: deny.
- Cross-organization access: deny.
- Audit branch-sensitive access and mutations.

## Migration strategy
Do NOT add `branchId` to 30+ operational tables in one risky migration.

Implement in this order:
1. Branch Prisma entity.
2. Branch assignment/membership model.
3. Branch authorization service/middleware.
4. Branch-aware clinic/organization context.
5. Owner/Admin branch CRUD.
6. Manager branch restriction.
7. Doctor/Assistant assignment restriction.
8. Audit logging.
9. E2E tests for cross-branch and cross-organization denial.
10. Progressively migrate operational domains: Patient → Appointment → Inventory → Finance → Diagnostics → Labs.

Existing diagnostic/lab membership models must be preserved and migrated gradually.

## Current known CI/release state
Previously confirmed:
- Quality Gate passed.
- Frontend lint passed.
- Backend lint passed.
- TypeScript/build/unit tests had passed except for the current design-token blocker when last inspected.
- Main E2E: 200/205 passed, 5 expected skipped.
- UX-001, UX-003, UX-004 passed.
- UX-002 was fixed for Shop accessibility.

Known current blocker:
`designTokens.test.ts` has stale `ALLOWED_LITERAL_COLOR_LINES` exceptions for `Shop.tsx`. Shop itself was already fixed in commit `39e3a2759bd250ccff396d01fe401922c999fcd9`. Fix the stale test contract; do not weaken the design-token guard by adding arbitrary literal colors.

Business Owner journey previously failed because tests expected `Добавить сотрудника` while UI uses `Добавить вручную`, had conflicting `Пригласить` controls, and expected branch management that does not yet exist as a real Branch entity. Do not fake branch management just to satisfy E2E.

## Existing canonical registries
`dentvision-backend/src/lib/clinicRoleAccessRegistry.ts`
- Canonical clinic role scopes and permissions.

`dentvision-backend/src/lib/roleAccessRegistry.ts`
- Canonical Diagnostic Center / Medical Lab / Dental Lab role families and scopes.

Tests:
- `dentvision-backend/src/lib/clinicRoleAccessRegistry.test.ts`
- `dentvision-backend/src/lib/roleAccessRegistry.test.ts`

Latest IAM registry commit: `f238e5f08ec86c59437dfc46ee1d12c7ffb8e0b0`.

## Important Prisma facts
`Clinic` currently has direct relations to patients, appointments, lab orders, treatment plans/cases, invoices, inventory, bookings, documents, AI messages, referrals, etc.

`ClinicMember` currently contains `userId`, `clinicId`, `role`, compensation fields, and unique `(userId, clinicId)`.

`Organization`, `Person`, `PersonRole`, and `OrganizationInvitation` already exist.

There is currently **no separate Branch entity** in Prisma at the point this state was recorded.

## Release rule
PR #275 must not be merged until the complete release gate is green, including:
- Quality Gate
- frontend lint
- backend lint
- TypeScript/build/unit
- main E2E
- UX gates
- Business Owner
- Organization Owner Lifecycle
- Playwright smoke

After every meaningful commit, inspect workflow runs for the new head and investigate failures instead of waiting blindly.

## Working principle
Use the repository as the source of truth. Never claim a feature is implemented merely because a test was changed. Product behavior, authorization, data model, UI and E2E must agree.
