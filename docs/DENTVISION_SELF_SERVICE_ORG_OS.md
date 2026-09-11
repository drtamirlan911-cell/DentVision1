# DentVision — Self-Service Organization OS

## P0 product principle

**DentVision is self-service by default.** Every participant can create their own account, create or join an organization, configure the organization, add employees, define services/products, complete verification, and enter the correct workspace without a DentVision operator manually creating the organization.

DentVision platform staff are not a required operational dependency. Their role is limited to platform security, moderation, fraud prevention, regulated verification, compliance, disputes, and ecosystem quality.

## Canonical lifecycle

`Welcome → Account → Intent / participant type → Organization → Profile → Team → Services / Products → Verification → Workspace`

Joining an existing organization is a parallel path:

`Invite / secure join link → Account / Login → Invitation verification → Accept role → Organization context → Workspace`

A person may belong to multiple organizations simultaneously and may have a different role in each organization.

## Participant types

| Participant | Self-service organization | Team | Primary workspace |
|---|---|---|---|
| Patient / Buyer | personal account | no | Patient / Market |
| Doctor | professional profile; optional clinic creation | optional | Doctor / AI |
| Clinic / Owner | create clinic | doctors, assistants, admin, cashier, managers | Clinic |
| Diagnostic Center | create center | radiologists, operators, managers, admin | Diagnostics Center |
| Dental Laboratory | create lab | technicians, managers, QC, admin | Dental Lab |
| Seller / Supplier | create business/store | managers, warehouse, sales | Marketplace Seller |
| Academy / School | create academy | lecturers, admins, managers | Academy |
| Lecturer / Expert | professional profile | optional | Academy |
| Employer / Jobs | create employer profile | recruiters/managers | Jobs |
| Platform admin | no customer organization | platform staff only | Admin / Security |

## Rules

1. **No manual DentVision creation step.** A new organization is created by its owner or authorized founder.
2. **Create and join are different flows.** Never mix owner onboarding with employee invitation acceptance.
3. **Invitees self-register.** An owner sends an expiring invitation; the employee creates/logs into their own account and accepts it.
4. **RBAC is organization-scoped.** A person's role in one organization must never leak into another organization.
5. **Tenant isolation is mandatory.** Every organization-scoped read/write is authorized against the active organization.
6. **Idempotency is mandatory.** Refreshing, resubmitting, or reopening onboarding cannot create duplicate organizations, memberships, or invitations.
7. **Verification is asynchronous.** Regulated organizations may operate in a `verification_pending` state while platform checks run. Verification must not require a human operator to perform ordinary setup.
8. **Protected operations remain gated.** Clinical, financial, legal-signature, and other high-impact mutations require the existing confirmation/RBAC policy.
9. **The owner always controls their team.** Owner/admin can invite, revoke, change allowed roles, and see invitation state.
10. **One person, many organizations.** The account layer is global; organization membership is contextual.
11. **No fake completion.** A workspace is opened only after the server confirms the required bootstrap state.
12. **Public discovery stays public.** Patient-facing discovery must not expose private organization or medical data.

## Required backend capabilities

The unified onboarding engine should expose an idempotent contract equivalent to:

- `POST /api/onboarding/start`
- `GET /api/onboarding/state`
- `POST /api/onboarding/organization`
- `PATCH /api/onboarding/organization`
- `POST /api/onboarding/invite`
- `GET /api/onboarding/invitations`
- `POST /api/onboarding/invitations/:token/accept`
- `POST /api/onboarding/complete`

Existing domain-specific endpoints may remain as compatibility adapters, but new UX must converge on the same account → organization → membership model.

## Organization bootstrap contract

Every organization created through onboarding must have:

- owner membership
- unified `Organization` record
- domain entity where the service already has one (`Clinic`, `DiagnosticCenter`, `Laboratory`, etc.)
- organization-scoped permissions
- profile/contact data
- initial workspace state
- audit event
- verification state where applicable

The bootstrap operation must be atomic from the user's point of view: either the organization and owner membership exist together, or the operation is safely retryable.

## Team invitation contract

Invitation data must contain:

- organization
- intended role
- inviter
- secure random token or equivalent secure identifier
- expiry
- optional recipient email/phone binding
- status: pending / accepted / revoked / expired

Acceptance must verify token validity, expiry, recipient restrictions, organization state, and duplicate membership before creating membership.

## Workspace launch contract

After onboarding, launch the workspace that matches the active organization type. Never send a user to a generic dashboard when a dedicated workspace exists.

Examples:

- Clinic → Clinic workspace
- Diagnostic Center → Diagnostics Center workspace
- Dental Laboratory → Dental Lab production workspace
- Seller → Seller workspace
- Academy → Academy workspace
- Doctor without organization → Doctor / AI workspace
- Patient → Patient portal

## UX contract

The user should never need to understand DentVision's internal data model.

The onboarding UI asks only for the information needed for the next step, preserves progress, supports mobile first, and shows a clear completion state. Role-specific fields are introduced only after the participant type is selected.

Do not create seven independent registration products. Build one onboarding engine with domain adapters.

## Security / medical data boundary

Creating an account or organization is not equivalent to authorization to access patient data. Patient/medical data remains behind authentication, organization membership, RBAC, and tenant checks. Diagnostic centers and laboratories can create their organization without receiving any patient data until an authorized referral/order exists.

## Definition of Done

Self-service organization onboarding is complete only when:

- owner can register without DentVision staff creating the organization;
- owner can create the organization and enter its workspace;
- owner can invite employees;
- employee can self-register/login and accept the invitation;
- the same user can belong to multiple organizations;
- roles are organization-scoped;
- tenant isolation is enforced server-side;
- onboarding is retry-safe and idempotent;
- verification states are explicit;
- no fake metrics or fake completion are shown;
- protected mutations retain confirmation/RBAC gates;
- mobile and desktop flows are usable;
- tests cover isolation, invitation security, duplicate submission, and multi-organization membership;
- production deployment is verified before claiming the feature is live.

## Product decision

This document supersedes any flow that requires a DentVision employee to manually create a clinic, diagnostic center, laboratory, seller, academy, or employer as part of normal onboarding. Platform review may still be required for regulated verification or trust/safety, but it is not the user's setup dependency.
