# DentVision — Continuation State

Updated: 2026-09-14
Branch: `feat/iam-role-matrix-v2`
PR: #275
Current implementation head: `cf79210842d145047b417bdd1f72d86c9c6d3fff`

## Current objective
Complete IAM, branch isolation and release-gate work without weakening tests or faking product functionality.

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

## Branch architecture
Target model:
`Organization → Branch → Clinic / operational data → Members`

`Clinic` remains the operational entity for backward compatibility. `Branch` is persisted in `branches` and is organization-aware while retaining nullable `clinic_id` during the migration period.

Branch bootstrap: `dentvision-backend/prisma/ensure-branch-model.ts`

Branch authorization core: `dentvision-backend/src/lib/branchAuthorization.ts`
- ORGANIZATION
- BRANCH
- ASSIGNED
- OWN
- fail-closed organization/branch checks

Branch routes: `dentvision-backend/src/modules/branches/branches.routes.ts`
- authenticated access
- Owner/Admin branch management
- Manager/assigned-member branch visibility restrictions
- staff-to-branch assignment
- organization-aware branch persistence fields
- shared branch authorization used for mutations

Branch route contract test: `dentvision-backend/src/modules/branches/branches.routes.test.ts`

## Progressive operational isolation
1. Branch entity/bootstrap — implemented.
2. Branch assignment on ClinicMember — implemented through transitional schema bootstrap.
3. Shared branch authorization — implemented.
4. Branch-aware clinic/organization context — in progress.
5. Owner/Admin branch CRUD — implemented.
6. Manager branch restriction — implemented at branch route level.
7. Doctor/Assistant assignment restriction — implemented at branch route level; operational-data enforcement follows as each domain gains branchId.
8. Patient — branch-scoped read/write access is implemented in `patients.routes.ts` and `patientBranchScope.ts`.
9. Appointment — branch consistency/filtering is implemented through the appointment branch work; keep cross-branch denial in release E2E.
10. Inventory — `inventory_items.branch_id` migration/backfill is implemented; `inventory.routes.ts` now scopes list/suggest/create/update/adjust/movements/delete/low-stock by authorized branches. Owner/Admin/Accountant remain organization-wide; other roles fail closed without an assigned branch.
11. Finance — next operational boundary.
12. Diagnostics / Medical Lab / Dental Lab — next specialized partner boundary.
13. E2E cross-branch and cross-organization denial — required release batch.

Do NOT add `branchId` to 30+ operational tables in one risky migration. Existing diagnostic/lab membership models must be preserved and migrated gradually.

## Inventory branch isolation
Foundation:
- `dentvision-backend/prisma/migrations/20260914110000_add_inventory_branch_scope/migration.sql`
- `dentvision-backend/src/lib/inventoryBranchScope.ts`
- `dentvision-backend/prisma/ensure-branch-model.ts`

Route enforcement commit:
- `cf79210842d145047b417bdd1f72d86c9c6d3fff`

Rules:
- organization roles: OWNER / ADMIN / ACCOUNTANT see all active branches in the clinic;
- branch/assigned roles see only their assigned branch;
- missing branch assignment fails closed;
- create accepts a branch only when it is active and inside the caller's authorized branch set;
- item mutation and movement operations first resolve the item through the branch-scoped query;
- low-stock and suggestions use the same branch visibility.

## Important compatibility rule
Legacy clinic-linked branch rows remain supported while organization ownership is introduced. New branch writes may carry `organizationId`; the branch table keeps `clinic_id` until operational data is migrated.

Do not silently treat a test-only branch fixture as product functionality.

## Current CI/release state
Latest implementation commit `cf79210842d145047b417bdd1f72d86c9c6d3fff` triggered:
- Quality Gate #2214 — in progress
- CI #1904 — in progress

Do not wait indefinitely for CI. After a meaningful batch, inspect the result once; fix concrete failures and continue implementation.

Known earlier blocker:
`designTokens.test.ts` had stale `ALLOWED_LITERAL_COLOR_LINES` exceptions for `Shop.tsx`. Shop itself was already fixed in commit `39e3a2759bd250ccff396d01fe401922c999fcd9`. Fix the stale test contract rather than weakening the design-token guard.

Business Owner journey previously failed because tests expected `Добавить сотрудника` while UI uses `Добавить вручную`, had conflicting `Пригласить` controls, and expected branch management before real branch management existed. The branch layer is now real; E2E expectations must be aligned with actual UI behavior rather than mocked state.

## Canonical registries
`dentvision-backend/src/lib/clinicRoleAccessRegistry.ts`
- canonical clinic role scopes and permissions.

`dentvision-backend/src/lib/roleAccessRegistry.ts`
- canonical Diagnostic Center / Medical Lab / Dental Lab role families and scopes.

Tests:
- `dentvision-backend/src/lib/clinicRoleAccessRegistry.test.ts`
- `dentvision-backend/src/lib/roleAccessRegistry.test.ts`
- `dentvision-backend/src/lib/branchAuthorization.test.ts`
- `dentvision-backend/src/modules/branches/branches.routes.test.ts`
- `dentvision-backend/src/lib/inventoryBranchScope.test.ts`

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

After meaningful commits, inspect workflow status and investigate concrete failures. Do not use CI as a reason to stop implementation.

## Working principle
Use the repository as the source of truth. Never claim a feature is implemented merely because a test was changed. Product behavior, authorization, data model, UI and E2E must agree.
