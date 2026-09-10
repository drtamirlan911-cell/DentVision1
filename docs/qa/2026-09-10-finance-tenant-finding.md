# QA: Finance owner-type isolation finding — 2026-09-10

## Confirmed on `main` (`03b77825f279586244770b94edb282f588b40c5c`)

`dentvision-backend/src/modules/finance/finance.routes.ts` has an owner authorization guard that checks `supplierId` and `organizationId` without constraining `ownerType`.

A non-superadmin request can therefore pass the guard for a non-CLINIC owner type when the requested owner ID equals the user's supplier/organization ID. The same file's `/transactions` filter also scopes non-superadmins by `ownerId` only, not `(ownerType, ownerId)`.

This is an authorization-boundary defect. The hardening work in PR #247 contains the intended typed-owner fix, but that PR is currently diverged from `main` and is not mergeable.

## Required fix

Use typed ownership pairs for all finance reads:

- `CLINIC` → `req.user.clinicId`
- `SUPPLIER` → `req.user.supplierId`
- platform-wide owner types → SUPERADMIN-only unless a dedicated authorization model exists

Transactions must filter through ledger wallet ownership using both `ownerType` and `ownerId`.

## Release impact

Blocks finance tenant-boundary release verification until the corrected code is rebased onto current `main` and integration-tested.
