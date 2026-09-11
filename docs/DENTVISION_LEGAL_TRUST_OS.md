# DentVision — Legal & Trust OS

## P0 principle

DentVision must be legally ready by design, not after launch. Partner onboarding, medical-data access, privacy, responsibility allocation, contracting, consent, billing evidence, audit, suspension and termination are platform workflows.

The goal is minimum manual work for the DentVision owner while preserving legal review where the law, contract risk or regulated verification requires it.

## Canonical lifecycle

`Partner self-registration → KYB/KYC → risk classification → document package → variable population → review rules → e-signature → effective status → workspace/data permissions → continuous audit → renewal/amendment/termination`

No customer organization should require a DentVision employee to manually create routine contracts.

## Document engine

The Contract Engine is the source of truth for generated agreements. Existing legal templates, versions, blocks, partners, documents and legal audit logs remain the foundation.

Document packages are generated from approved versioned templates and variables. A package may contain:

- platform/service agreement;
- data processing agreement (DPA) where applicable;
- confidentiality/NDA terms where applicable;
- medical-data and security addendum where applicable;
- marketplace/supplier terms;
- academy/lecturer terms;
- employer/jobs terms;
- diagnostic/laboratory terms;
- patient terms, privacy notice and consent records;
- payment/commission/settlement terms;
- SLA/support terms where applicable;
- amendments and termination documents.

A new template version never silently changes an already executed document. Executed documents retain the exact content/version/hash and evidence required to reproduce what was accepted.

## Automatic contracting

After successful onboarding and verification, DentVision should automatically determine the required document package from participant type, organization type, enabled modules, geography, data classification and commercial model.

The system then:

1. selects only published templates;
2. fills verified organization/person variables;
3. creates the document package;
4. shows material terms before signature;
5. obtains required electronic acceptance/signature;
6. records signer identity, authority, timestamp, document version/hash and consent evidence;
7. activates only the services whose prerequisites are satisfied;
8. schedules renewal/expiry reminders;
9. creates an immutable audit trail.

Automation must never mean invisible consent. The user must see what is being accepted and who is bound by it.

## Signature model

Support a provider-neutral signature abstraction so the platform can use an appropriate Kazakhstan-compatible electronic-signature provider when required, while retaining an internal acceptance/evidence mechanism for lower-risk clickwrap/consent flows where legally appropriate.

Every executed document must retain:

- signer user/account;
- organization and role at signing time;
- authority basis where relevant;
- signature/acceptance method;
- exact document version;
- content hash;
- timestamp;
- IP/device/session evidence where legally appropriate;
- consent text/version where applicable;
- revocation/withdrawal status where applicable.

Never store sensitive signing secrets in the application database.

## Medical and personal data boundary

DentVision separates:

1. account/profile data;
2. organization/business data;
3. ordinary operational data;
4. personal data;
5. special/medical data;
6. documents/images/DICOM and other clinical files;
7. contractual/legal evidence.

Access to medical data requires authenticated identity, active organization context, RBAC/permission checks, tenant isolation and a valid business/legal purpose. A diagnostic center or laboratory may onboard and contract without receiving patient data. Patient data is introduced only through an authorized referral/order/workflow.

Consent, privacy notice, data-processing basis, access grants and withdrawals must be versioned and auditable.

## Responsibility matrix

Every partner relationship should explicitly classify responsibility for:

- patient/consumer relationship;
- clinical decisions;
- diagnostic interpretation;
- laboratory production/QC;
- product quality and authenticity;
- delivery;
- payments/refunds;
- data accuracy;
- data security;
- incident notification;
- regulatory compliance;
- retention/deletion obligations;
- subcontractors/processors.

DentVision must not silently assume a partner's professional or clinical responsibility merely because the workflow is technically hosted on the platform.

## Trust and verification

Verification is risk-based and asynchronous. Organization creation remains self-service. Higher-risk capabilities can remain disabled until the required KYB/KYC/license/authority evidence is verified.

Examples:

- clinic: legal entity/owner and regulated-service evidence as required;
- diagnostic center: center identity, responsible persons and applicable authorization;
- laboratory: legal identity, responsible persons and applicable authorization;
- supplier: legal identity, payment/tax information and product/commercial evidence;
- academy: organization/expert identity and commercial/payout evidence;
- employer: organization identity and recruiter authority;
- doctor: professional identity and credentials where required for regulated features;
- patient: minimum identity required for the requested workflow.

Verification state is explicit: `not_started`, `pending`, `verified`, `rejected`, `expired`, `suspended`.

## Audit and evidence

Legal, security and medical-data events require structured audit records. At minimum capture actor, organization context, action, object, timestamp, result and correlation/request identifier. Sensitive payloads should be minimized; audit logs must not become an accidental copy of medical records.

Important events include:

- account creation;
- organization creation;
- invitation creation/accept/revoke/expire;
- role/permission changes;
- contract generation/view/accept/sign/revoke;
- consent grant/withdrawal;
- data access grants;
- medical-file view/download/share;
- diagnostic/lab result release;
- financial approvals/refunds;
- verification decisions;
- security incidents;
- suspension/reactivation;
- termination/export/deletion requests.

## Automated lifecycle

The platform should automatically monitor:

- contract expiry and renewal;
- missing signatures;
- verification expiry;
- missing documents;
- license/credential expiry;
- payment/settlement obligations;
- privacy/consent changes;
- employee offboarding and permission revocation;
- organization suspension/termination.

When an event requires a human decision, route a concise task to the responsible organization/person rather than to the DentVision owner by default.

## Minimal-owner operating model

DentVision owner should normally see only exceptions:

- high-risk verification requiring review;
- fraud/security escalation;
- disputed contract;
- regulatory/legal escalation;
- failed automated signature/payment/integration;
- serious data incident;
- partner suspension/appeal.

Routine partner creation, document generation, invitation, signing, renewal reminders, role provisioning and audit capture are automated.

## Integration with Self-Service Organization OS

The legal lifecycle is a mandatory adapter of the existing:

`Welcome → Account → Participant Type → Organization → Profile → Team → Services/Products → Verification → Workspace`

Before a regulated or contractually protected workspace capability is activated, the server checks the legal/verification prerequisites. This does not block basic account creation or ordinary organization setup.

## Partner-type packages

### Clinic
`Platform/Clinic Agreement + DPA/Data Security Addendum + Privacy/consent configuration + optional NDA + billing terms`

### Diagnostic Center
`Diagnostics Agreement + DPA/Data Security Addendum + NDA where applicable + result responsibility/SLA terms`

### Dental Laboratory
`Laboratory Agreement + DPA/Data Security Addendum + production/QC/SLA terms + NDA where applicable`

### Supplier / Seller
`Marketplace/Supplier Agreement + commercial/commission terms + payout/settlement terms + NDA where applicable`

### Academy / Lecturer
`Academy Agreement or Lecturer Agreement + content/IP terms + payout terms + privacy terms`

### Employer
`Jobs/Employer Agreement + candidate-data/privacy terms + recruiter authority`

### Doctor
`Professional/Platform terms + privacy terms + clinic/organization-specific agreements when joining an organization`

### Patient / Buyer
`Terms of Service + Privacy Notice + required consents + transaction-specific terms`

## Multi-organization safety

A user may belong to multiple organizations. Legal status is contextual. A signature for Organization A must never imply acceptance or authority for Organization B. Switching workspace must switch the legal/permission context used for protected actions.

Employee invitation acceptance creates membership only; it does not transfer ownership or legal authority from the inviter.

## Termination

Termination must automatically:

1. stop new protected operations;
2. revoke affected permissions/tokens;
3. preserve required legal/audit evidence;
4. handle active orders/payments/clinical workflows safely;
5. initiate data export/retention/deletion rules according to applicable obligations;
6. create termination evidence;
7. notify affected parties.

Deletion must never erase records that must legally be retained; retention policy determines what remains and for how long.

## Definition of Done

Legal & Trust OS is complete only when:

- every supported participant type has an explicit legal package;
- documents are generated from versioned approved templates;
- required documents are automatically created during onboarding;
- signatures/acceptances are evidence-backed and reproducible;
- legal status gates protected capabilities server-side;
- medical/personal data access is separately authorized;
- responsibility boundaries are explicit;
- audit events are structured and tenant-aware;
- renewals, expiry and offboarding are automated;
- DentVision owner handles exceptions, not routine partner administration;
- existing multi-organization contexts remain isolated;
- executed documents cannot be silently rewritten;
- production tests cover signing, versioning, withdrawal, expiry, tenant isolation and termination.

## Legal note

This is a product/technical control architecture, not a substitute for Kazakhstan-specific legal review. Published templates and regulated signature/consent flows must be approved for the actual DentVision legal entity, counterparties, data flows and applicable law before commercial production use.