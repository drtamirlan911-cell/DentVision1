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

## Database migration

`dentvision-backend/prisma/migrations/20260914010000_add_branches/migration.sql` creates `branches`, adds `clinic_members.branch_id`, creates the required indexes/foreign key, and backfills one `MAIN` branch per existing clinic.

The application currently uses the migration-backed branch table through parameterized Prisma SQL queries while the legacy Prisma schema is being consolidated. This avoids introducing a second competing organization/clinic model during the IAM v2 transition.

## API

Mounted under the existing authenticated organization router:

- `GET /api/organizations/branches?clinicId=...`
- `POST /api/organizations/branches`
- `PATCH /api/organizations/branches/:id`
- `POST /api/organizations/branches/:id/members/:userId`

Only OWNER/ADMIN may mutate branches. Branch-scoped roles receive only their assigned branch on list.

## Next isolation layer

The branch foundation is intentionally separate from the existing clinic tenant boundary. The next release-gate step is to propagate `branch_id` through clinical and operational records (patients, appointments, inventory, billing, lab orders, diagnostics and reporting) and add positive/negative cross-branch E2E checks. Until that propagation is complete, branch management must not be described as complete data isolation for every legacy clinic record.
