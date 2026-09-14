# P0 — Clinical diagnostic sign-off authorization

Status: **OPEN — code fix required before release**

Detected on `main` at `50a8513d93e1ae92ac49b89d7af2ba1b909caa12`.

## Finding 1 — AI result confirmation escalation

Endpoint:

`POST /referrals/:id/confirm-ai-result`

Files:

- `dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts`
- `dentvision-backend/src/modules/diagnostics/diagnostics.service.ts`

The route uses `requireReferralAccess()`, which permits clinic organization members with operational referral access. The service then accepts `OWNER`, `ADMIN`, or `DOCTOR` clinic roles:

```ts
role: { in: ['OWNER', 'ADMIN', 'DOCTOR'] }
```

This is inconsistent with the endpoint contract `requiresDoctorConfirmation: true` and with clinical sign-off semantics.

Required policy: **final AI diagnostic confirmation must be restricted to a doctor** with valid clinic + branch access, or the assigned referral doctor. SUPERADMIN must not bypass the clinical sign-off rule merely by virtue of platform administration.

## Finding 2 — Signed diagnostic result escalation

Endpoint:

`POST /referrals/:id/results/sign`

The route uses `requireReferralAccess()` and passes `req.user!.id` as `doctorId` to `saveAndSignResult()`.

`saveAndSignResult()` then:

1. writes `signedBy` / `signedAt`;
2. marks the referral `COMPLETED`;
3. creates a `visit` for the patient;
4. writes the diagnostic report into the patient's medical record;
5. records `RESULT_SIGNED` audit data.

Because `requireReferralAccess()` also permits clinic Owner/Admin access, an Owner/Admin can potentially perform a clinical signing operation under their own identity even though they are not a doctor.

Required policy: **result signing and patient medical-record insertion must be doctor-only**, with clinic + branch isolation enforced. Operational access for Owner/Admin must remain available for non-clinical referral management but must not confer clinical authorship.

## Required regression coverage

Add negative authorization tests proving:

- OWNER cannot confirm an AI diagnostic result;
- ADMIN cannot confirm an AI diagnostic result;
- MANAGER cannot confirm an AI diagnostic result;
- ASSISTANT cannot confirm an AI diagnostic result;
- OWNER cannot sign a diagnostic result into the patient record;
- ADMIN cannot sign a diagnostic result into the patient record;
- MANAGER cannot sign a diagnostic result into the patient record;
- ASSISTANT cannot sign a diagnostic result into the patient record;
- a DOCTOR with correct clinic/branch access can confirm/sign;
- a doctor from another branch is denied;
- a doctor from another clinic is denied;
- SUPERADMIN does not bypass the clinical-author role requirement.

## Release gate

This document is a release-blocking P0 until code and regression tests prove the policy above. Do not mark the affected diagnostic workflows `DONE` based on route availability alone.
