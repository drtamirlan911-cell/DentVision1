# RBAC Audit

## Current Implementation

- Backend: `permissions.ts` with `roleHasPermission()` + `requirePermission()` middleware
- Backend UserRole enum: `OWNER | DOCTOR | ASSISTANT | ADMIN | CASHIER | LAB | MANAGER | STUDENT | SUPERADMIN`
- Frontend: `ORG_ROLES` / `PLATFORM_ROLES` in `auth.store.ts` with page-level access lists
- Granular permission keys: `patient.read`, `patient.write`, `bi.clinic`, `bi.platform`, etc.
- `requireMinRole()` hierarchy middleware for quick role-gating

## Gap Analysis

| Requirement | Status |
|-------------|--------|
| SUPERVISOR / DIRECTOR role | ⚠️ Exists in frontend ORG_ROLES, not in backend UserRole enum |
| SUPPLIER role | ✅ Exists via `supplierRole` JWT claim, separate workspace |
| LECTURER role | ✅ Exists via `lecturerId` JWT claim, separate workspace |
| STUDENT role | ✅ Backend user role |
| PATIENT role | Implemented | UserRole.PATIENT exists in the current Prisma schema; patient-portal access uses the linked Patient.userId and consent boundary. PATIENT is a consumer context, not a clinic employee role. |
| JOB_CANDIDATE role | ❌ No role — candidates are job-applicant records |

## Post-Compliance

- Permission catalog extended with `bi.finance` for accountant-level access
- All BI routes protected by 3 permission tiers: `bi.clinic`, `bi.network`, `bi.platform`
- No dedicated RBAC tables added — the existing `permissions.ts` map + Prisma UserRole enum remain the source of truth to avoid complexity


## Current-state correction — 2026-10-25

The earlier gap row claiming that PATIENT is not a platform role was stale and contradicted the current Prisma UserRole enum and the canonical IAM role matrix at docs/DENTVISION_IAM_ROLE_MATRIX.md. Keep the distinction explicit: PATIENT is a consumer identity/context, not an employee role; portal data access must remain bound to the user's linked Patient record and consent. Other historical gap rows in this audit should be revalidated before they are treated as current implementation status.
