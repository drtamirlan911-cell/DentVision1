# DentVision — Continuation State

Updated: 2026-09-14
Branch: `feat/iam-role-matrix-v2`
PR: #275
Current implementation head: `d61acb34d7073ed969de1d780c37e4f37ef00df5`

## Current objective
Complete IAM, branch isolation and release-gate work without weakening tests or faking product functionality.

## Progressive operational isolation
1. Branch entity/bootstrap — implemented.
2. Branch assignment on ClinicMember — implemented through transitional schema bootstrap.
3. Shared branch authorization — implemented.
4. Branch-aware clinic/organization context — in progress.
5. Owner/Admin branch CRUD — implemented.
6. Manager branch restriction — implemented at branch route level.
7. Doctor/Assistant assignment restriction — implemented at branch route level; operational-data enforcement follows as each domain gains branchId.
8. Patient — branch-scoped read/write access is implemented in `patients.routes.ts` and `patientBranchScope.ts`.
9. Appointment — database branch consistency is enforced; operational route filtering remains part of the release E2E hardening batch.
10. Inventory — `inventory_items.branch_id` migration/backfill and route branch scoping are implemented.
11. Inventory deduction — appointment close performs an additional clinic + branch check before any stock movement.
12. Finance — branch fields/migration and fail-closed authorization context are now implemented as the next operational boundary; billing routes still require route-level wiring before this item is considered complete.
13. Diagnostics — clinic-originated referral branch fields/migration and fail-closed authorization context are now implemented; diagnostics routes still require route-level wiring before this item is considered complete.
14. Medical Lab / Dental Lab — preserve existing partner membership models and apply branch scope progressively.
15. E2E cross-branch and cross-organization denial — required release batch.

Do NOT add `branchId` to 30+ operational tables in one risky migration. Existing diagnostic/lab membership models must be preserved and migrated gradually.

## Finance branch boundary
Foundation added:
- `dentvision-backend/prisma/migrations/20260914130000_add_finance_diagnostics_branch_scope/migration.sql`
- `dentvision-backend/src/lib/financeBranchScope.ts`
- `dentvision-backend/src/lib/financeBranchScope.test.ts`

Finance rows receiving branch scope:
- `invoices.branch_id`
- `expenses.branch_id`

Existing data is assigned to each clinic's active default branch where one exists. The helper treats OWNER/ADMIN/ACCOUNTANT as organization-wide and all other roles as assigned-branch scoped; missing assignment fails closed.

## Diagnostics branch boundary
Foundation added:
- `referrals.branch_id`
- `dentvision-backend/src/lib/diagnosticBranchScope.ts`
- `dentvision-backend/src/lib/diagnosticBranchScope.test.ts`

The source clinic branch is kept independently from the external diagnostic-center/laboratory organization boundary. Center/lab memberships remain intact.

## Inventory branch isolation
Foundation:
- `dentvision-backend/prisma/migrations/20260914110000_add_inventory_branch_scope/migration.sql`
- `dentvision-backend/src/lib/inventoryBranchScope.ts`
- `dentvision-backend/prisma/ensure-branch-model.ts`

Route enforcement:
- inventory branch-scoped operations are implemented in `inventory.routes.ts`;
- appointment-driven deductions are additionally protected in `deductionRules.ts`.

## Cross-domain release contract
`dentvision-backend/src/lib/branchIsolationReleaseContract.test.ts` requires explicit branch-scope contexts for inventory, finance and diagnostics and verifies fail-closed behavior. This is a release guard, not a substitute for route-level enforcement.

## Product role matrix
Clinic roles: OWNER, ADMIN, MANAGER, DOCTOR, ASSISTANT, RECEPTIONIST, CASHIER, ACCOUNTANT.

Specialized partner families:
- Diagnostic Center: 9 roles
- Medical Lab: 9 roles
- Dental Lab: 10 roles

## Current CI/release state
The latest implementation batch is still awaiting CI results; do not treat the new branch foundation as release-green until CI exercises it.

PR #275 is not release-ready until the complete gate is green.

## Release rule
Required before merge:
- Quality Gate
- frontend/backend lint
- TypeScript/build/unit
- main E2E
- UX gates
- Business Owner
- Organization Owner Lifecycle
- Playwright smoke

## Working principle
Use the repository as the source of truth. Never claim a feature is implemented merely because a test was changed. Product behavior, authorization, data model, UI and E2E must agree.
