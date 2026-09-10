# DentVision — Route Security & UX State Matrix

Date: 2026-09-10
Status: Active product contract

## Objective

DentVision must behave as a public-first super-app while keeping private clinical, financial, tenant and operational data behind a verified authentication and IAM boundary.

## Entry contract

| State | Expected destination |
|---|---|
| Anonymous `/` | Public Welcome |
| Authenticated `/` | AI Workspace `/ai` |
| Anonymous public route | Render public experience without account |
| Anonymous protected route | Contextual `/login` and preserve destination |
| Authenticated protected route | IAM page check before render |
| Expired/invalid session | Stop private render, re-authenticate |
| Guest AI | General/safe AI only; no private context |
| Successful registration | AI Workspace |

## Public experience

The public layer includes the Welcome entry plus intentionally public discovery experiences such as Shop, School/Academy, Jobs, Community, Demo, Pricing, legal pages, public booking, document signing and public treatment presentation where their individual security model permits it.

The public route table is the authority for public access. A guest capability token is never an authorization bypass for a protected page.

## Protected experience

CRM, clinic management, patient records, clinical documents, treatment plans, dental chart, staff, finance, billing, private diagnostics workspaces, supplier workspace, administrative controls and other tenant-scoped operations require verified authentication and the appropriate IAM page permission.

Routes outside `IntelligenceLayout` must enforce their own boundary. `MyClinics` now does this explicitly because it can access clinic memberships and switch tenant context.

## Deep-link invariant

When a user opens a protected URL while anonymous, the original pathname/search must survive authentication so the user returns to the requested destination instead of being dropped at a generic home screen.

## Guest AI invariant

`/ai` may be publicly reachable for the guest experience, but guest requests must not receive patient, clinic, finance, workspace or other private context. Durable conversation/proactive private context is restored only for authenticated users.

## Figma source of truth

Figma file: `DentVision — Premium Mobile Design System — UX`

Key nodes:
- `6:4` — Public Welcome / Mobile
- `6:33` — Contextual Login / Mobile
- `6:52` — AI Workspace / Mobile
- `6:83` — Mobile Design Tokens
- `13:8` — UX State Contract / Release QA

The UX State Contract defines the product-level states that must remain visually and behaviorally aligned with production: public entry, auth boundary, private workspace, guest AI, session expiry and mobile parity.

## Release gate

A route is not complete because it renders. It is complete only after navigation, refresh, anonymous state, authenticated state, role access, deep-link restoration, mobile layout, error/expired-session behavior and production telemetry are verified.

## Current release note

The latest clinic-workspace security change is committed to `main` as `eaaaa9f3be5da4b537345e647c601ccaef852ff4`. Render API auto-deployment is processing this commit. Vercel's GitHub status is currently blocked by the account build/deployment rate limit; no forced deployment is claimed until that gate clears.
