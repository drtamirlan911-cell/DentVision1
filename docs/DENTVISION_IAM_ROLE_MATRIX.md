# DentVision IAM — Role, Scope and Configuration Model

## Why this model

DentVision must not treat a role as a global label. Access is evaluated in the active workspace and is composed from:

`User → Organization → Role → Permission → Scope → Ownership → Resource state → Audit`

The existing unified `Person → PersonRole → Role → Permission` graph remains the enforcement source. This document defines the product policy that graph implements.

## Configuration surfaces

### Organization workspace

**Settings → Team & Access** is the intended organization-level control center.

It must contain:

1. **Employees** — invite, activate/deactivate, remove, assign role(s), assign branch(es).
2. **Roles** — select a system role and review its effective permissions.
3. **Branches** — create/edit/archive branches and define which employees can operate in each branch.
4. **Access rules** — optional narrowing of a system role by branch, department, assigned patients/orders, or explicit resource grant.
5. **Audit** — who changed a role, scope, invitation, or permission and when.

System roles are not edited destructively by organization users. An organization may narrow access through scope, but must not silently redefine a system role for every organization.

### Platform control center

**Platform → IAM / Security → Roles & Permissions** is reserved for SUPERADMIN/platform governance.

It controls:

- canonical system roles;
- permission catalog;
- organization/person types;
- default role templates;
- role availability by organization type;
- audit and emergency access policy.

Any future custom-role editor must create a new organization-scoped role/template rather than mutate a canonical system role.

## Scope model

| Scope | Meaning |
|---|---|
| ORGANIZATION | All permitted resources in one organization |
| BRANCH | Only assigned branch(es) of the organization |
| ASSIGNED | Only records/orders explicitly assigned to the user |
| OWN | Records created/owned by the user where the resource supports ownership |
| EXPLICIT | A temporary or explicit grant, always auditable |

Scope is an access boundary, not a UI filter. Backend queries must enforce it.

## Clinic roles

### OWNER — Владелец
Organization-wide governance: branches, staff, finance, analytics, operational configuration and clinical oversight. Cannot cross the organization boundary.

### ADMIN — Администратор
Daily administrative operation: patients, appointments, staff, billing and clinic settings within the organization. Ownership transfer and platform governance remain outside this role.

### MANAGER — Управляющий
Operational management for assigned branch(es): schedule, staff coordination, inventory, analytics and operational workflows. No unrestricted organization-wide access by default.

### DOCTOR — Врач
Clinical work: assigned/authorized patients, appointments, medical records, treatment plans, odontogram and diagnostics/lab workflows required for care. No automatic access to every patient in every branch.

### ASSISTANT — Ассистент
Chairside and operational support: appointments, patient context required for assigned work, documents/lab coordination and inventory visibility. No clinical sign-off or unrestricted finance access.

### Additional clinic roles

- RECEPTION — registration and scheduling; no diagnosis/treatment-plan sign-off.
- CASHIER — payments/invoices according to billing policy; no clinical mutation.
- ACCOUNTANT — financial reporting and reconciliation; no medical-data access unless explicitly required.
- INVENTORY_MANAGER — stock and purchasing workflows.
- MARKETING_MANAGER — campaigns and non-clinical analytics.
- HR_MANAGER — staff lifecycle without medical access.
- READ_ONLY — explicit read-only scope.

These may be introduced as organization-scoped role templates without changing the legacy `UserRole` enum.

## Diagnostic center roles

| Role | Default scope | Primary responsibility |
|---|---|---|
| DIAGNOSTIC_OWNER | ORGANIZATION | Full center governance, staff, finance, operations |
| DIAGNOSTIC_ADMIN | ORGANIZATION | Administration and operations |
| DIAGNOSTIC_MANAGER | BRANCH | Branch operations and staff coordination |
| DIAGNOSTIC_OPERATOR | BRANCH | Registration, orders, statuses and files |
| RADIOLOGIST | ASSIGNED | Clinical interpretation and result validation |
| RADIOLOGY_TECHNICIAN | BRANCH | Performing studies and technical files |
| DIAGNOSTIC_RECEPTION | BRANCH | Registration and order intake |
| DIAGNOSTIC_FINANCE | ORGANIZATION | Billing, settlement and analytics |
| DIAGNOSTIC_QUALITY | ORGANIZATION | Quality control, audit and process analytics |

A diagnostic partner receives only the minimum clinic/patient/order context necessary for the referral. Membership in the diagnostic organization never grants access to the clinic CRM.

## Medical laboratory roles

| Role | Default scope | Primary responsibility |
|---|---|---|
| MEDICAL_LAB_OWNER | ORGANIZATION | Full laboratory governance |
| MEDICAL_LAB_ADMIN | ORGANIZATION | Administration and operations |
| MEDICAL_LAB_MANAGER | BRANCH | Branch operations |
| MEDICAL_LAB_RECEPTION | BRANCH | Registration and order intake |
| MEDICAL_LAB_TECHNICIAN | BRANCH | Perform analysis and upload result |
| MEDICAL_LAB_VALIDATOR | ASSIGNED | Validate laboratory results |
| MEDICAL_LAB_DOCTOR | ASSIGNED | Clinical interpretation/confirmation |
| MEDICAL_LAB_FINANCE | ORGANIZATION | Billing and settlement |
| MEDICAL_LAB_QUALITY | ORGANIZATION | Quality control and audit |

A technician cannot perform final clinical validation unless the policy explicitly grants that permission.

## Dental laboratory roles

| Role | Default scope | Primary responsibility |
|---|---|---|
| DENTAL_LAB_OWNER | ORGANIZATION | Full laboratory governance and production |
| DENTAL_LAB_ADMIN | ORGANIZATION | Administration and orders |
| DENTAL_LAB_MANAGER | BRANCH | Production/branch management |
| LAB_COORDINATOR | BRANCH | Clinic communication and order coordination |
| DENTAL_TECHNICIAN | ASSIGNED | Assigned production work |
| CAD_DESIGNER | ASSIGNED | Digital design |
| CERAMIST | ASSIGNED | Ceramic production stages |
| ORTHODONTIC_TECHNICIAN | ASSIGNED | Orthodontic production |
| QC_SPECIALIST | ORGANIZATION | Quality control |
| LAB_FINANCE | ORGANIZATION | Finance and settlement |

## Cross-organization workflow

`Clinic → Diagnostic Center → Result → Clinic → Dental/Medical Lab → Result/Delivery → Clinic`

Each step receives only the data needed for that step. A partner cannot use a referral to enumerate or search the originating clinic's entire patient database.

## Permission principles

Permissions are atomic (`module.action`) and roles are bundles. Scope and ownership narrow the bundle.

Examples:

- `diagnostics.read`
- `diagnostics.write`
- `diagnostics.manage`
- `lab.read`
- `lab.write`
- `lab.manage`
- `staff.read`
- `staff.write`
- `staff.manage`
- `billing.read`
- `billing.manage`
- `files.read`
- `files.write`
- `medical.read`
- `analytics.read`
- `audit.read`

A role with `diagnostics.write` does not automatically receive `billing.manage`.

## Resource-state rules

Permission is not sufficient by itself. Mutations also depend on resource state.

Examples:

- a completed/validated diagnostic result is not editable by ordinary operators;
- a validated medical-lab result requires the appropriate validator/doctor permission to amend;
- a delivered dental-lab order remains auditable and should not be silently rewritten;
- disabled/revoked members cannot act even if historical role rows remain for audit.

## Safety rules for implementation

1. Do not expand the legacy `UserRole` enum merely to represent every profession.
2. Use the existing unified `Person → Role → Permission` graph for specialized partner roles.
3. Keep canonical system roles immutable for organization users.
4. Enforce scope in backend queries; frontend visibility is not security.
5. Keep cross-tenant and cross-branch negative tests as release gates.
6. Keep historical audit records when a member is disabled or a role is changed.
7. Do not give external partners a clinic-wide patient permission merely because they can process a referral.
8. Frontend and Android should consume effective permissions from IAM rather than maintain independent role matrices.

## Implementation status

- Specialized diagnostic/medical-lab/dental-lab roles are registered in `dentvision-backend/src/lib/roleAccessRegistry.ts`.
- The existing permission seeder now creates those roles in the unified DB Role/Permission graph.
- Workspace role labels expose these roles consistently.
- Branch/assignment scope is represented as policy metadata first; it must only be enforced against a real branch/assignment relation already present in the domain model. No speculative branch database model is introduced by this change.
