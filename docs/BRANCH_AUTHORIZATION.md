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


## Archived branch semantics (RB-035)

- `active=false` means the branch is archived and cannot be used as an operational workspace.
- Archive is not deletion: patient, appointment, finance, diagnostics, inventory and audit history remain stored. No clinical history is reassigned or removed by archive.
- Every request made with a stale JWT carrying an archived `branchId` must fail closed for branch-scoped work. Identity/context recovery endpoints may load a new context, but the inactive branch claim is dropped from the effective request context.
- A branch-scoped employee whose only assignment is archived receives no branch-scoped records or write access until assigned to an active branch. A user cannot switch into, open, set default, or assign staff to an archived branch.
- Organization owners/admins retain organization-level settings access so they can restore a branch. Existing history and assignments remain untouched.
- Reactivation uses the existing owner/admin branch update action. Existing assignments become operational only after the branch is active again.
- Historical records in archived branches require a separately authorized archive/reporting workflow; a stale JWT is never evidence of archive-history permission.


## Legacy and canonical clinic branch assignment parity (RB-035)

- Clinic branch assignment routes MUST update both legacy ClinicMember.branchId and canonical BranchMember in one transaction whenever a canonical Person exists. Disable/unassign marks BranchMember inactive rather than deleting it.
- IAM branch switching and request authentication may fall back to legacy ClinicMember only when the user, clinic and branch IDs all match and the branch is active. The legacy fallback is not an alternative tenant identifier.
- A branch row with a non-null organization_id must match the selected Organization exactly. Only rows with organization_id IS NULL may use the legacy mapping where branch.clinic_id equals Organization.originalId.
- Archive does not modify either assignment representation. Archived rows remain inactive for operational access; after owner/admin restoration, preserved active assignments become usable again.
- Patient, finance, diagnostic and inventory reads, diagnostic referral lists/details and aggregates, appointments, analytics, treatment cases and lab orders must all apply the same active-branch allow-list.
- Clinic actors reading medical-lab orders must be in the matching active clinic context and have an active branch assignment. Membership in another clinic alone is not enough; laboratory tenant access uses its own organization context.
