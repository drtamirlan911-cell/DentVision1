# DentVision — Continuation State

Updated: 2026-09-14
Branch: `feat/iam-role-matrix-v2`
PR: #275
Current implementation head: `b1156879cf40fdfb1f5399c6f5cba785fa233706`

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
11. Inventory deduction — appointment close now performs a second clinic + branch check before any stock movement, preventing cross-branch material deduction even through legacy rules/direct calls.
12. Finance — next operational boundary.
13. Diagnostics / Medical Lab / Dental Lab — next specialized partner boundary.
14. E2E cross-branch and cross-organization denial — required release batch.

Do NOT add `branchId` to 30+ operational tables in one risky migration. Existing diagnostic/lab membership models must be preserved and migrated gradually.

## Inventory branch isolation
Foundation:
- `dentvision-backend/prisma/migrations/20260914110000_add_inventory_branch_scope/migration.sql`
- `dentvision-backend/src/lib/inventoryBranchScope.ts`
- `dentvision-backend/prisma/ensure-branch-model.ts`

Route enforcement:
- inventory branch-scoped operations are implemented in `inventory.routes.ts`;
- appointment-driven deductions are additionally protected in `deductionRules.ts`.

Rules:
- organization roles: OWNER / ADMIN / ACCOUNTANT see all active branches in the clinic;
- branch/assigned roles see only their assigned branch;
- missing branch assignment fails closed;
- inventory movement during appointment close requires the inventory item clinic and branch to match the appointment;
- cross-branch mismatch is returned as a shortage and no movement is posted.

## Product role matrix
Clinic roles: OWNER, ADMIN, MANAGER, DOCTOR, ASSISTANT, RECEPTIONIST, CASHIER, ACCOUNTANT.

Specialized partner families:
- Diagnostic Center: 9 roles
- Medical Lab: 9 roles
- Dental Lab: 10 roles

## Current CI/release state
Latest implementation batch `b1156879cf40fdfb1f5399c6f5cba785fa233706` triggered:
- Quality Gate #2220 — in progress
- CI #1907 — in progress

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
