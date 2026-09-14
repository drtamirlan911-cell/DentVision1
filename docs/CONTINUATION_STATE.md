# DentVision — Continuation State

Updated: 2026-09-14
Branch: `feat/iam-role-matrix-v2`
PR: #275

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
9. Appointment — database branch consistency is enforced; operational route filtering remains part of release E2E hardening.
10. Inventory — `inventory_items.branch_id` migration/backfill and route branch scoping are implemented.
11. Inventory deduction — appointment close performs an additional clinic + branch check before any stock movement.
12. Finance — branch foundation and fail-closed policy are present; route/service wiring is still required before release completion.
13. Diagnostics — referral branch foundation and fail-closed policy are present; route/service wiring is still required before release completion.
14. Medical Lab / Dental Lab — preserve existing partner membership models and apply branch scope progressively.
15. E2E cross-branch and cross-organization denial — required release batch.

Do NOT add `branchId` to 30+ operational tables in one risky migration. Existing diagnostic/lab membership models must be preserved and migrated gradually.

## Finance branch boundary
Foundation already present in the branch:
- `dentvision-backend/prisma/migrations/20260914130000_add_finance_diagnostics_branch_scope/migration.sql`
- `dentvision-backend/src/lib/financeBranchScope.ts`
- `dentvision-backend/src/lib/financeBranchScope.test.ts`

Additional release policy:
- `dentvision-backend/src/lib/financeBranchBoundary.ts`
- `dentvision-backend/src/lib/financeBranchBoundary.test.ts`
- `dentvision-backend/src/lib/financeWalletBoundary.ts`
- `dentvision-backend/src/lib/financeWalletBoundary.test.ts`

Hardening added:
- finance branch resolution requires an actual `clinic_members` row;
- missing membership returns an empty branch set and `organizationWide: false`;
- organization roles cannot obtain finance visibility from a role string alone;
- wallet access is explicitly separated from the generic `finance.manage` permission;
- PLATFORM/GATEWAY wallets are denied to non-SUPERADMIN users.

Policy:
- OWNER / ADMIN / ACCOUNTANT are organization-wide within their organization.
- Other roles require an explicit assigned branch.
- Cross-organization access always fails.
- Missing branch context fails closed.

The existing finance routes still need to consume these policies for resource-level enforcement.

## Diagnostics branch boundary
Foundation already present in the branch:
- `referrals.branch_id`
- `dentvision-backend/src/lib/diagnosticBranchScope.ts`
- `dentvision-backend/src/lib/diagnosticBranchScope.test.ts`

Additional reusable enforcement:
- `dentvision-backend/src/lib/diagnosticReferralBranchPolicy.ts`
- `dentvision-backend/src/lib/diagnosticReferralBranchPolicy.test.ts`

Hardening added:
- diagnostic branch resolution requires an actual `clinic_members` row;
- missing membership returns an empty branch set and `organizationWide: false`;
- referral access requires the same clinic and an active branch;
- SUPERADMIN is the only unconditional clinic-boundary bypass;
- diagnostic-center/laboratory partner organization access remains a separate boundary.

The source clinic branch remains distinct from the external diagnostic-center/laboratory organization boundary. Existing center/lab membership models are preserved.

## Role matrix release contract
Added:
- `docs/RELEASE_ROLE_BOUNDARY_MATRIX.md`
- `dentvision-backend/src/lib/partnerRoleMatrix.test.ts`

Locked specialized partner matrix:
- Diagnostic Center: 9 roles
- Medical Lab: 9 roles
- Dental Lab: 10 roles

Required invariants include cross-org denial, fail-closed branch context, financial/clinical separation and no wildcard permissions.

## Inventory branch isolation
Foundation:
- `dentvision-backend/prisma/migrations/20260914110000_add_inventory_branch_scope/migration.sql`
- `dentvision-backend/src/lib/inventoryBranchScope.ts`
- `dentvision-backend/prisma/ensure-branch-model.ts`

Route enforcement:
- inventory branch-scoped operations are implemented in `inventory.routes.ts`;
- appointment-driven deductions are additionally protected in `deductionRules.ts`.

## Release contract
Static policy tests are not a substitute for route-level E2E. Before merge, verify both read and mutation denial for cross-branch and cross-organization cases.

## Current CI/release state
Fresh CI is required after the latest commits. No claim of release-green status is made until the complete gate is green.

PR #275 remains blocked from merge until:
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
