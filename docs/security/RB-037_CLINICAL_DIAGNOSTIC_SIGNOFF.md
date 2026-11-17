# RB-037 — Clinical diagnostic confirmation and signing authorization

**Status:** RESOLVED in code and exact-head CI/E2E  
**Merged implementation:** PR #341, merge commit `21641389dafcd478aef6ff79be55177ec4b51016`  
**Current main snapshot reviewed:** `4bbd61a339d5f3c4d40d1d5990f633a7b9a87864` (2026-11-13)  
**Scope:** clinic-side AI result confirmation and patient-chart signing, with partner signer separation.

## Former finding

The historical audit found that operational clinic roles could confirm AI diagnostic drafts or sign results as though they were clinical authors. That finding was valid for the old audited source revision; it is not the current implementation state.

## Current authorization contract

Clinic-side confirmation and signing call the shared `assertClinicDoctorSignoff` boundary. It verifies the caller's current organization-scoped DOCTOR role, active clinic/branch access, and assigned-referral constraints. The Master Spec's compound `OWNER + DOCTOR` case is preserved only when the user independently holds the scoped DOCTOR capability.

Operational OWNER, ADMIN, DIRECTOR, MANAGER, ASSISTANT and CASHIER roles do not gain clinical authorship from their operational rights. SUPERADMIN platform authority alone is not clinical assignment and does not permit clinic-side confirmation/signing.

Diagnostic-center and medical-laboratory signing remain distinct. The caller must hold a specific organization-scoped partner signer role (`radiologist`, `medical_lab_validator` or `medical_lab_doctor`) in the referral's destination organization. Partner signing does not create a clinic Visit or attribute the result to a clinic doctor.

## Implementation evidence

- `dentvision-backend/src/modules/diagnostics/clinicalSignoffAuthorization.ts` — canonical clinic-doctor signoff guard.
- `dentvision-backend/src/modules/diagnostics/clinicalSignoffAuthorization.test.ts` — role, assignment, branch, archived organization, missing context and legacy compatibility tests.
- `dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts` — guard applied to AI confirmation and clinic-side result signing.
- `dentvision-backend/src/modules/diagnostics/signingAuthorization.ts` — separately scoped partner signer roles.
- `e2e/tests/partner-lifecycle.spec.ts` — RB-037 end-to-end negative and positive journeys. Rejected callers are checked for no signature, no referral completion and no Visit insertion.

## Verification evidence

- Merged PR #341 exact-head CI: [42374982404](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/42374982404).
- Merged PR #341 Quality Gate: [42374982372](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/42374982372).
- Current main exact-head CI: [43496476996](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/43496476996).
- Current main Quality Gate: [43496477034](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/43496477034).

All four runs are reported successful by GitHub. The implementation is not permission to loosen future checks; any change to clinical signer policy must retain the same canonical service boundary and both positive and negative tests.

## Reopen criteria

Reopen RB-037 only if a new source review or regression shows one of these conditions: a non-doctor clinic role can confirm/sign; a doctor from another clinic/branch can sign; an unassigned doctor can sign; a platform admin can sign without clinical assignment; a partner signer can create a clinic Visit; or a denied request mutates the diagnostic result/referral/chart.
