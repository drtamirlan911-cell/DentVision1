# RB-037 — Clinical diagnostic confirmation and signing authorization

**Status:** OPEN — P0  
**Audit base:** `main` at `2ff887f4944cb1eb8c0e05001fbcc44ef9abde09` (2026-11-07)  
**Scope:** source and authorization-contract review only. No clinical data, database, migration, deployment, or runtime behavior was changed.

## Finding

Clinical diagnostic confirmation and signing currently accept non-doctor clinic roles. This allows operational authority to be used as clinical authorship.

### AI result confirmation

Route: `POST /api/diagnostics/referrals/:id/confirm-ai-result`

- The route is guarded by `requireReferralAccess()`, which permits authorized clinic organization members.
- `confirmAiResult()` accepts organization-scoped role keys `owner`, `org_owner`, `admin`, `org_admin`, and `doctor`; when no canonical organization exists, it falls back to clinic membership.
- The action records the caller as confirmer and completes the referral.

### Signed diagnostic result

Route: `POST /api/diagnostics/referrals/:id/results/sign`

- Clinic referral access is broader than clinical signer authority.
- `saveAndSignResult()` accepts `DOCTOR`, `OWNER`, and `DIRECTOR` as clinic-side signers.
- A non-partner signer causes the referral to be completed and a Visit to be written into the patient's clinical chart.
- The current implementation therefore allows OWNER/DIRECTOR operational roles to perform a clinical-signing operation without proving that the caller has the DOCTOR role.

## Required authorization contract

1. Clinic-side confirmation and signing require an authenticated DOCTOR with current clinic and branch access.
2. Enforce assigned-referral and active clinical assignment constraints where applicable; an arbitrary clinic member must not sign.
3. OWNER, ADMIN, DIRECTOR, MANAGER, ASSISTANT, CASHIER and SUPERADMIN must not acquire clinical-signing authority solely from operational or platform privileges.
4. Diagnostic-center and medical-laboratory signers retain only their separately scoped signer roles. Partner signing must not create a clinic Visit or masquerade as a clinic doctor.
5. Every successful signature must retain the real authenticated signer identity and the existing audit event. Denied requests must not complete referrals, create diagnostic signatures or write Visit rows.

## Required regression matrix

- OWNER, ADMIN, DIRECTOR, MANAGER, ASSISTANT and CASHIER are denied on both clinic-side endpoints unless the authenticated clinical context independently resolves to DOCTOR under the canonical policy.
- Correctly assigned DOCTOR in the same clinic and branch can confirm/sign.
- DOCTOR from another clinic or branch is denied.
- SUPERADMIN without clinical assignment is denied.
- Partner signer roles continue to work only within their diagnostic-center/laboratory scope and do not write to the clinic patient chart.
- Negative cases assert no DiagnosticResult signature, no referral completion, no Visit creation and no false audit attribution.

## Release gate

RB-037 remains OPEN/P0 until the policy is implemented in the canonical service boundary and the exact-head unit/E2E role, clinic, branch and audit matrix passes. Master Spec §12 says AI diagnostic output is assistive until the required professional confirmation step; operational clinic membership alone is not clinical authorization.

