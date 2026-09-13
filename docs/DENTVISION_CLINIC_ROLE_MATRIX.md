# DentVision — Clinic Workspace Role Matrix

Canonical clinic workspace roles are implemented through the existing `Person → PersonRole → Role → Permission` graph. This document is the product contract; it does not introduce a second RBAC system.

## Roles

| Role | Scope | Primary responsibility | Explicit boundary |
|---|---|---|---|
| OWNER | Organization | Full clinic governance, clinical sign-off, finance, staff and settings | Must remain tenant-scoped; no platform-wide governance |
| ADMIN | Organization | Administration, billing, staff, operations | Cannot clinically sign off treatment |
| MANAGER | Branch | Branch operations, staff coordination, inventory and analytics | No clinical sign-off; no organization-wide ownership |
| DOCTOR | Assigned | Diagnosis, treatment, medical records, treatment-plan sign-off | No staff/organization management; no billing management |
| ASSISTANT | Assigned | Appointment/clinical support, inventory and lab coordination | No clinical sign-off, billing management or staff management |
| RECEPTIONIST | Branch | Patient registration, appointments, communication and operational billing | No medical write/sign-off or financial management |
| CASHIER | Branch | Payments, invoices and cashier workflow | No medical write/sign-off |
| ACCOUNTANT | Organization | Accounting, financial controls and analytics | No patient medical/clinical access |

## Enforcement model

`Person → active context → Organization/Branch membership → Role → Permission → Scope → Ownership → Resource state → Audit`

A role never grants access outside its active organization. `BRANCH` roles are restricted to assigned branches; `ASSIGNED` roles are restricted to explicitly assigned work/patients/resources where the endpoint supports assignment checks.

## Clinical safety

`medical.manage` is clinical sign-off and is intentionally limited to OWNER and DOCTOR in the clinic role matrix. ADMIN may author/edit permitted administrative or clinical data but does not certify treatment for the patient.

## Financial separation

CASHIER and ACCOUNTANT receive `billing.manage`. DOCTOR and ASSISTANT do not. Patient medical data is not a prerequisite for financial work.

## Consumer separation

PATIENT, STUDENT and BUYER are independent contexts and are not clinic employees. Having a clinic role must not automatically expose professional Academy/Marketplace content when the active context is PATIENT.

## Configuration surfaces

- Clinic: **Settings → Team & Access → Employees / Roles & Permissions**
- Platform: **Platform → IAM / Security → Roles & Permissions**
- Partner organizations: their own organization workspace, using the same IAM graph and specialized role registry.

## Release requirements

Every new role or permission change must include:

1. Positive authorization test.
2. Negative authorization test for the nearest privileged boundary.
3. Tenant/branch isolation test.
4. UI visibility derived from effective permissions, not hardcoded role-only assumptions.
5. Audit coverage for sensitive mutations.
