# DentVision release audit — 2026-09-10

## Current release blockers

1. Finance owner-type isolation on `main` requires the typed-owner hardening from PR #247 to be integrated and verified.
2. Web auth refresh has a production-risk localhost fallback tracked in issue #257.
3. Production bundle has a ~700 KB main chunk tracked in issue #258.
4. `main` lacks an effective required-CI branch protection gate; tracked in issue #259.
5. PR #247 is diverged from `main` and must not be merged as-is.

## Passing signals

- Current Vercel production deployment is READY at commit `03b77825f279586244770b94edb282f588b40c5c`.
- Vercel runtime checks showed no recent error/warning cluster.
- PostHog error tracking showed no active issues in the checked window.
- Public production `/login` and `/shop` returned HTTP 200.
- CI run `34449695308` passed e2e, lint-test, backend-lint and frontend-lint on the current production commit.

## Important limitation

Authenticated production browser E2E has not yet been completed with a controlled test account. Static/live public scraping does not prove authenticated mutations, session refresh, tenant isolation, or role enforcement.
