# DentVision Release Gate

| Check | Status | Details |
|-------|--------|---------|
| AUTH | PENDING | |
| RBAC | PENDING | Specialized partner role catalog added; full runtime matrix verification still required. |
| ROLE MATRIX | PENDING | Diagnostic center, medical laboratory and dental laboratory roles are registered; E2E permission/scope verification remains. |
| TENANT ISOLATION | PENDING | |
| BRANCH ISOLATION | PENDING | Branch scope must be verified against the real branch relation; no speculative schema added. |
| IDOR | PENDING | |
| PATIENT | PENDING | Active PATIENT context is isolated from professional Academy/Marketplace audiences; full patient journey verification remains. |
| APPOINTMENT | PENDING | |
| DIAGNOSIS | PENDING | |
| TREATMENT PLAN | PENDING | |
| FILES | PENDING | |
| DIAGNOSTIC | PENDING | |
| AI | PENDING | AI must consume active-context policy and never aggregate patient + professional contexts. |
| MARKETPLACE | PENDING | Real `/api/shop/products` and `/api/shop/products/:id` responses are filtered server-side; CI/E2E verification pending. |
| PAYMENTS | PENDING | |
| ACADEMY | PENDING | Real `/api/school/courses` and `/api/school/courses/:id` responses are filtered server-side; CI/E2E verification pending. |
| CONTENT ISOLATION | PENDING | Patient context cannot inherit professional/doctor content; mixed audiences are fail-closed; real API E2E coverage added. |
| SECURITY | PENDING | |
| DATABASE | PENDING | |
| API | PENDING | |
| E2E | PENDING | New context-bound Academy/Marketplace API journey added; CI run pending. |
| BUILD | PENDING | |
| TYPECHECK | PENDING | |
| LINT | PENDING | |
| UNIT TESTS | PENDING | |

## Final Status: NOT READY

P0: -
P1: -
P2: -
