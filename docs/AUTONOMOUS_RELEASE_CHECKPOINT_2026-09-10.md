# DentVision autonomous release checkpoint — 2026-09-10

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
