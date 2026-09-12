# DentVision Economics — 2026-09-12 Progress

## Completed in this slice

- Verified Vercel production deployment for `c52067a03f6dd381201fb5f28bae3189c6c5dfc6` is `success`.
- Added a Prisma Referral persistence guard in `dentvision-backend/src/lib/prisma.ts` so writes that move a Referral to `ACCEPTED` or `IN_PROGRESS` resolve `platformFee` from the canonical Partner Economics Engine before persistence.
- The guard applies to all Prisma `Referral.update` callers, not only the HTTP route, and therefore closes the remaining service-level path where the legacy 10% value could be persisted.
- Client-supplied `platformFee` remains excluded by the diagnostics status route; the persistence guard provides the final server-side normalization boundary.
- Existing asynchronous reconciliation remains in place as a consistency backstop, while durable `partner_economics` ledger entries continue to be created at settlement rather than at referral status changes.

## Current lifecycle contract

`ACCEPTED / IN_PROGRESS` → canonical referral fee persisted → `paid` claimed atomically → settlement generated from canonical economics → immutable `partner_economics` snapshot → settlement payment callback marks settlement paid idempotently.

Diagnostic center referrals use `DIAGNOSTIC_3D`; laboratory referrals use `MEDICAL_ANALYSIS`.

## Explicit boundaries

- No duplicate medical-analysis order/settlement model is introduced.
- Dental-lab economics remains recognized at `delivered` until an existing real payment callback/reconciliation path is identified.
- Historical economics transactions are never recalculated with current rules.
- Platform BI remains protected by `bi.platform`.

## Next execution slice

1. Verify accepted → paid → settled rule-version immutability with concurrent settlement/payment callbacks.
2. Identify and wire the existing medical-analysis payment/settlement callback if one exists in the current `Laboratory` / `LaboratoryTest` / Referral workflow.
3. Connect the existing Partner/Finance UI to `/api/bi/partner-economics` without weakening authorization.
4. Only after a real payment callback exists, move dental-lab recognition from `delivered` to the appropriate paid/settled state.
