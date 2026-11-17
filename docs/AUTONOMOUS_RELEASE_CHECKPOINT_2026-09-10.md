# DentVision autonomous release checkpoint — 2026-09-10

> **Historical release snapshot — 2026-09-10.** The deployment branch, Vercel rate-limit state, issues #258/#266 and open gates below belong to September 10 and are not verified current conditions. Do not infer current deployment status or blockers from this file. Current exact-SHA CI, Quality Gate and system reconciliation are recorded in `DENTVISION_CONTEXT.md`, `docs/RELEASE_BLOCKERS.md` and `docs/SYSTEM_AUDIT.md`.


## Source of truth
- `main` is the canonical release branch.
- Stale PR work is not merged unless it is based on current `main` and passes validation.

## Completed hardening
- Browser API origin is centralized in `src/utils/apiOrigin.ts`.
- Auth token refresh uses the centralized browser API origin.
- AI workspace is lazy-loaded from the application entry route.
- Public/legal and patient-facing direct browser fetches use the centralized API origin where applicable.
- Mobile bottom navigation hardening is present on `main`.

## Release gates still open
- Production deployment must reach the current `main` SHA before performance issue #258 is considered resolved.
- Browser-level authenticated E2E still needs representative production validation.
- Mobile UX issue #266 remains open until 360/390/430-width validation and web/Android parity checks are evidenced.

## Safety note
- Do not close performance or UX issues based only on source inspection. Require production/runtime evidence.
