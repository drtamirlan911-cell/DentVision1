# DentVision Branch Model

## Purpose

A branch is a real operating unit inside a clinic. It is not a UI label and it is not represented by duplicating clinics.

The branch foundation provides:

- persistent branch identity and code;
- active/inactive lifecycle;
- one protected default branch per clinic;
- branch assignment on clinic membership;
- owner/admin branch administration;
- branch-scoped visibility for managers and other branch-scoped roles;
- a migration that creates `MAIN` for every existing clinic and assigns legacy members to it.

## Authorization contract

| Role | Branch visibility | Branch administration |
|---|---|---|
| OWNER | all clinic branches | create/update/activate/deactivate/assign |
| ADMIN | all clinic branches | create/update/activate/deactivate/assign |
| MANAGER | assigned branch | no |
| RECEPTIONIST | assigned branch | no |
| CASHIER | assigned branch | no |
| DOCTOR | assignment scope | no |
| ASSISTANT | assignment scope | no |

The API must fail closed: a user without membership in the clinic cannot read or mutate its branches.

## Database and Prisma model

`dentvision-backend/prisma/migrations/20260914010000_add_branches/migration.sql` creates `branches`, adds `clinic_members.branch_id`, creates the required indexes/foreign key, and backfills one `MAIN` branch per existing clinic.

The repository uses a single large legacy Prisma schema. `prisma/ensure-branch-model.ts` is an idempotent schema bootstrap that adds the `Branch` model, `Clinic.branches`, and `ClinicMember.branchId/branch` before `prisma generate`, migrations, `db push`, or Studio. This makes Branch a real generated Prisma model without copying the entire legacy schema into a second competing schema file.

## API

Mounted under the existing authenticated organization router:

- `GET /api/organizations/branches?clinicId=...`
- `POST /api/organizations/branches`
- `PATCH /api/organizations/branches/:id`
- `POST /api/organizations/branches/:id/members/:userId`

Only OWNER/ADMIN may mutate branches. Branch-scoped roles receive only their assigned branch on list.

## Next isolation layer

The branch foundation is intentionally separate from the existing clinic tenant boundary. The next release-gate step is to propagate `branch_id` through clinical and operational records (patients, appointments, inventory, billing, lab orders, diagnostics and reporting) and add positive/negative cross-branch E2E checks. Until that propagation is complete, branch management must not be described as complete data isolation for every legacy clinic record.
