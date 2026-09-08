# Audit next gates

The audit is now intentionally moving by gate, not by repeatedly fixing the same migration symptom.

## Gate order

- Database: deploy + E2E seed
- API: authentication, CRUD, RBAC, error contracts
- Browser: login/dashboard/patients/appointments/marketplace + responsive layouts
- Android: unit tests + debug + preview
- Security: auth refresh, role boundaries, fail-closed behavior
- Parity: web and Android endpoint/model coverage

## Rule

A gate is considered complete only from an actual automated result. A code inspection alone is not a green gate.

## Current database strategy

Product schema compatibility is covered by one post-`init_full_schema` additive guard migration. Existing narrower Product finalizers remain idempotent and harmless.
