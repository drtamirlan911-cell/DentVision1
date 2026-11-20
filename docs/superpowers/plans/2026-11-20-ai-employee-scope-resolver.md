# AI Employee scope resolver implementation plan

**Date:** 2026-11-20  
**Branch:** feat/user-jarvis-product-knowledge-20261120  
**Normative design:** docs/AI_EMPLOYEE_ORGANIZATION_SCOPE.md  
**Product contract:** docs/DENTVISION_MASTER_SPEC.md v5.0, §§15, 17, 19

## Goal

Implement the first safe prerequisite for an ecosystem-wide AI Employee queue: a reusable server-side resolver that returns the caller's verified clinic or canonical Organization scope, role scope, active branch membership, and database-derived permissions.

## Implementation

1. Call the existing AI IAM resolver; do not trust global role or raw organization claims.
2. Preserve clinic compatibility. For canonical organizations, derive the workspace type and domain identity from the persisted Organization and verified Person records.
3. Resolve active branches from Branch + BranchMember. For pre-canonical clinics only, use ClinicMember.branchId and independently verify the branch.
4. Treat JWT branchId / assignedBranchId as selection hints and branchIds as non-authoritative. A supplied branch hint outside the database-resolved branch set denies the scope. Branch-scoped roles require one selected active branch; branchId=null is reserved for an explicitly organization-wide role.
5. Resolve permissions through resolveUserPermissions using the exact active tenant and verified role.
6. Fail closed on guests, missing/archived organizations, roles without an explicit scope policy, invalid branch selection, and platform scope until a separate platform policy exists.

## Tests

- canonical partner organization + active branch membership;
- organization-wide role constrained to branches of its own organization;
- forged branch claim, stale/revoked PersonRole and BranchMember denial;
- ambiguity denial for branch-scoped members without a single selected branch;
- cross-organization branch exclusion;
- canonical clinic role aliases resolved through the shared PERSON_ROLE_MAP, plus pre-canonical clinic compatibility without inventing Organization IDs;
- missing membership and platform/guest denial;
- exact organization and role supplied to permission resolution.

## Explicit non-goals for this slice

No schema migration, nullable clinic_id change, partner task producer, event-envelope change, task CRUD query, approval execution, UI queue, data backfill, staging/production migration, or deployment. Those stages remain blocked until this resolver and its negative tests are verified.

## Definition of done

The resolver and focused regression tests are committed to the existing Draft PR #351. Exact-head GitHub CI and Quality Gate must be inspected before claiming verification. The existing clinic queue remains unchanged and partner task queues remain deny-by-default.
