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
| PATIENT role | ❌ Explicit patient role — patients are CRM records, not platform users |
| JOB_CANDIDATE role | ❌ No role — candidates are job-applicant records |

## Post-Compliance

- Permission catalog extended with `bi.finance` for accountant-level access
- All BI routes protected by 3 permission tiers: `bi.clinic`, `bi.network`, `bi.platform`
- No dedicated RBAC tables added — the existing `permissions.ts` map + Prisma UserRole enum remain the source of truth to avoid complexity
