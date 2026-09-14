# DentVision release role boundary matrix

This is the release contract for organization, branch and specialized partner access. It describes authorization expectations; it is not a claim that every domain is already migrated.

## Clinic

| Role | Organization visibility | Branch visibility | Clinical write | Financial write | Staff management |
|---|---|---|---|---|---|
| OWNER | all | all | yes | yes | yes |
| ADMIN | all | all | policy-controlled | yes | yes |
| MANAGER | organization | assigned branch | policy-controlled | policy-controlled | branch |
| DOCTOR | organization context | assigned | yes | no | no |
| ASSISTANT | organization context | assigned | assigned | no | no |
| RECEPTIONIST | organization context | assigned | reception workflows | no | no |
| CASHIER | organization context | assigned | no | yes | no |
| ACCOUNTANT | all | all | no | yes | no |

## Diagnostic center

Roles: `DIAGNOSTIC_OWNER`, `DIAGNOSTIC_ADMIN`, `DIAGNOSTIC_MANAGER`, `DIAGNOSTIC_OPERATOR`, `RADIOLOGIST`, `RADIOLOGY_TECHNICIAN`, `DIAGNOSTIC_RECEPTION`, `DIAGNOSTIC_FINANCE`, `DIAGNOSTIC_QUALITY`.

- Owner/Admin are organization-level management roles.
- Manager is branch-operational management.
- Operator/radiologist/technician/reception/quality are operational roles and must not gain organization-wide staff or finance control.
- Finance is billing-only and must not gain clinical/file-write access.

## Medical laboratory

Roles: `MEDICAL_LAB_OWNER`, `MEDICAL_LAB_ADMIN`, `MEDICAL_LAB_MANAGER`, `MEDICAL_LAB_RECEPTION`, `MEDICAL_LAB_TECHNICIAN`, `MEDICAL_LAB_VALIDATOR`, `MEDICAL_LAB_DOCTOR`, `MEDICAL_LAB_FINANCE`, `MEDICAL_LAB_QUALITY`.

- Owner/Admin manage the organization.
- Manager controls the assigned branch.
- Technician/Validator/Doctor/Reception/Quality are operationally scoped.
- Finance is financially scoped and separated from clinical/file-write permissions.

## Dental laboratory

Roles: `DENTAL_LAB_OWNER`, `DENTAL_LAB_ADMIN`, `DENTAL_LAB_MANAGER`, `LAB_COORDINATOR`, `DENTAL_TECHNICIAN`, `CAD_DESIGNER`, `CERAMIST`, `ORTHODONTIC_TECHNICIAN`, `QC_SPECIALIST`, `LAB_FINANCE`.

- Owner/Admin manage the organization.
- Manager/Coordinator are operational management roles.
- Technicians/designers/ceramists/orthodontic/QC roles are assigned-work scoped.
- Finance remains separated from medical and file-write permissions.

## Mandatory release invariants

1. Cross-organization access is denied.
2. A branch-scoped role without branch context is denied.
3. Branch-scoped roles cannot read or mutate another branch.
4. Organization roles can see branches only inside their organization.
5. Financial roles cannot acquire clinical/file-write permissions through fallback mappings.
6. No wildcard permission (`*`) is accepted.
7. Existing DiagnosticCenterMember, LaboratoryMember and ClinicMember models remain compatible while branch migration is progressive.
8. E2E must verify both read and mutation denial, not only static permission definitions.
