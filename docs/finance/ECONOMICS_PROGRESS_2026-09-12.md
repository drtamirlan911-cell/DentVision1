# DentVision Economics — 2026-09-12 Progress

## Completed in this slice

- Verified Vercel production deployment for `c52067a03f6dd381201fb5f28bae3189c6c5dfc6` is `success`.
- Added a Prisma Referral persistence guard in `dentvision-backend/src/lib/prisma.ts` so writes that move a Referral to `ACCEPTED` or `IN_PROGRESS` resolve `platformFee` from the canonical Partner Economics Engine before persistence.
- Extended that guard to atomic `Referral.updateMany` payment writes. This is required because the existing `claimReferralPaid()` concurrency path uses `updateMany`; without the extension, legacy cashier/mark-paid fee values could bypass the canonical rule at the payment boundary.
- The guard uses the write's `cost` when supplied (cashier collection) and otherwise the persisted referral cost, while resolving the vertical from the existing center/lab assignment.
- Added regression coverage proving atomic paid writes cannot persist the legacy fee and that cashier-style writes pass through canonical normalization.
- Client-supplied `platformFee` remains excluded by the diagnostics status/create routes; the persistence guard provides the final server-side normalization boundary.
- Existing asynchronous reconciliation remains in place as a consistency backstop, while durable `partner_economics` ledger entries continue to be created at settlement rather than at referral status changes.

## Current lifecycle contract

`ACCEPTED / IN_PROGRESS` → canonical referral fee persisted → `paid` claimed atomically → canonical fee enforced on the atomic payment write → settlement generated → immutable `partner_economics` snapshot → settlement payment callback marks settlement paid idempotently.

Diagnostic center referrals use `DIAGNOSTIC_3D`; laboratory referrals use `MEDICAL_ANALYSIS`.

## Explicit boundaries

- No duplicate medical-analysis order/settlement model is introduced.
- Dental-lab economics remains recognized at `delivered` until an existing real payment callback/reconciliation path is identified.
- Historical economics transactions are never recalculated with current rules.
- Platform BI remains protected by `bi.platform`.

## Verification state

- Vercel: `success` for `c52067a03f6dd381201fb5f28bae3189c6c5dfc6`.
- New commits `d78952c2ea7b0061dc0239730af8a74d0fc2fe81` and `f09b446d97f4351f5d96949cdd105eb06e4965fb` are on `main`; GitHub status is pending/not yet reported for the latest test commit at documentation time.

## Next execution slice

1. Verify accepted → paid → settled rule-version immutability with concurrent settlement/payment callbacks.
2. Identify and wire the existing medical-analysis payment/settlement callback if one exists in the current `Laboratory` / `LaboratoryTest` / Referral workflow.
3. Connect the existing Partner/Finance UI to `/api/bi/partner-economics` without weakening authorization.
4. Only after a real payment callback exists, move dental-lab recognition from `delivered` to the appropriate paid/settled state.
