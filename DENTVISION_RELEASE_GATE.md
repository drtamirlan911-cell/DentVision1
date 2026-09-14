# DentVision Release Gate

| Check | Status | Details |
|-------|--------|---------|
| AUTH | PENDING | |
| RBAC | PENDING | Unified IAM graph remains the only authorization path; clinic and partner role registries are seeded into Role/Permission. |
| ROLE MATRIX | PENDING | Clinic roles OWNER/ADMIN/MANAGER/DOCTOR/ASSISTANT/RECEPTIONIST/CASHIER/ACCOUNTANT plus diagnostic, medical-lab and dental-lab roles are registered; runtime scope E2E verification remains. |
| TENANT ISOLATION | PENDING | |
| BRANCH ISOLATION | PENDING | BRANCH roles must be verified against the real branch relation; ASSIGNED roles must be verified against resource assignment. |
| IDOR | PENDING | |
| PATIENT | PENDING | Active PATIENT context is isolated from professional Academy/Marketplace audiences; full patient journey verification remains. |
| APPOINTMENT | PENDING | |
| DIAGNOSIS | PENDING | |
| TREATMENT PLAN | PENDING | |
| FILES | PENDING | |
| DIAGNOSTIC | PENDING | |
| AI | PENDING | AI must consume active-context policy and never aggregate patient + professional contexts. |
| MARKETPLACE | PENDING | Real `/api/shop/products` and `/api/shop/products/:id` responses are filtered server-side; latest E2E verification pending. |
| PAYMENTS | PENDING | |
| ACADEMY | PENDING | Real `/api/school/courses` and `/api/school/courses/:id` responses are filtered server-side; latest E2E verification pending. |
| CONTENT ISOLATION | PENDING | Patient context cannot inherit professional/doctor content; mixed audiences are fail-closed; real API E2E coverage added. |
| SECURITY | PENDING | |
| DATABASE | PENDING | |
| API | PENDING | |
| E2E | PENDING | The previous CI run had 177 passed / 23 failed; those failures were downstream from the marketplace catalogue returning no visible fixture. The latest branch head now includes a deterministic GENERAL marketplace fixture and awaits fresh PR CI. |
| BUILD | PENDING | |
| TYPECHECK | PENDING | |
| LINT | PENDING | |
| UNIT TESTS | PENDING | Clinic role registry unit coverage added. |

## Final Status: NOT READY

P0: -
P1: -
P2: -

## IAM release invariant

`Person → active context → Organization/Branch → Role → Permission → Scope → Ownership → Resource state → Audit`

Do not add a second RBAC implementation or expand the global `UserRole` enum for specialized workspace roles. Consumer contexts (`PATIENT`, `STUDENT`, `BUYER`) remain separate from clinic/partner organization roles.
