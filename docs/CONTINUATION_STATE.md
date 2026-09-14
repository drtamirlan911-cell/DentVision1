# DentVision — Continuation State

Updated: 2026-09-14
Branch: `feat/iam-role-matrix-v2`
PR: #275
Current implementation head: `00ae0c1b4867b466cfb932e4fbad35372da19c95`

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

## Migration strategy
Do NOT add `branchId` to 30+ operational tables in one risky migration.

Implement progressively:
1. Branch entity/bootstrap — implemented.
2. Branch assignment on ClinicMember — implemented through transitional schema bootstrap.
3. Shared branch authorization — implemented.
4. Branch-aware clinic/organization context — in progress.
5. Owner/Admin branch CRUD — implemented.
6. Manager branch restriction — implemented at branch route level.
7. Doctor/Assistant assignment restriction — implemented at branch route level; operational-data enforcement follows as each domain gains branchId.
8. Audit branch-sensitive access and mutations — next hardening batch.
9. E2E cross-branch and cross-organization denial — next release batch.
10. Progressive operational migration: Patient → Appointment → Inventory → Finance → Diagnostics → Labs.

Existing diagnostic/lab membership models must be preserved and migrated gradually.

## Important compatibility rule
Legacy clinic-linked branch rows remain supported while organization ownership is introduced. New branch writes may carry `organizationId`; the branch table keeps `clinic_id` until operational data is migrated.

Do not silently treat a test-only branch fixture as product functionality.

## Current known CI/release state
Latest meaningful branch commits triggered:
- Quality Gate
- CI

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
