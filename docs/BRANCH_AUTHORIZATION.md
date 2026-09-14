# Branch Authorization Contract

DentVision branch access is fail-closed and has two independent boundaries:

1. `organizationId` — the tenant/business boundary.
2. `branchId` — the operational boundary inside that organization.

## Scope semantics

| Scope | Access |
|---|---|
| ORGANIZATION | Any branch belonging to the caller's organization |
| BRANCH | Only branches explicitly assigned to the caller |
| ASSIGNED | Only explicitly assigned branches/resources |

An organization-scoped role is **not** a cross-organization role. The caller's resolved organization must equal the requested organization.

Missing organization context, organization mismatch, missing branch for branch-scoped access, and unassigned branch access all fail closed.

## Current role mapping

- Owner: ORGANIZATION
- Admin: ORGANIZATION
- Manager: BRANCH
- Doctor: ASSIGNED
- Assistant: ASSIGNED
- Receptionist: BRANCH
- Cashier: BRANCH
- Accountant: ORGANIZATION

Specialized diagnostic and laboratory roles use the same scope vocabulary from the canonical partner role registry.

## Implementation rule

Route handlers must resolve organization membership and branch assignments from trusted server-side state. Client-provided organization/branch identifiers are selectors, never proof of authorization.

Operational tables will receive branch ownership progressively. Do not introduce a broad all-table migration merely to satisfy this contract.
