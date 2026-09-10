# DentVision — Figma Mobile Design Contract

Date: 2026-09-10

## Source of truth

Figma file: DentVision — Premium Mobile Design System — UX

The Figma file is the visual/UX source for the mobile-first entry experience. Production behavior remains governed by the React application, auth store, IAM, and security contracts.

## Screens established

- Public Welcome / Mobile
- Contextual Login / Mobile
- AI Workspace / Mobile
- DentVision Mobile Design Tokens

## UX contract

1. `/` is a public product entry point.
2. Authenticated users should enter the AI Workspace rather than a generic login/dashboard page.
3. Intent selection carries context into authentication.
4. Registration preserves role context and returns the user to the AI Workspace.
5. Guest access must never bypass authorization for CRM/platform data.
6. Public browsing and authenticated actions remain separate.
7. Mobile controls use a minimum 44pt touch target.
8. Visual hierarchy uses restrained surfaces, premium gold accent, high contrast text, and 4pt spacing rhythm.
9. New screens should reuse the DentVision Mobile variables before introducing new hardcoded visual values.
10. Every major UX change must be reflected in both Figma and production code when it changes the shared contract.

## Current implementation checkpoint

- `src/pages/Welcome.tsx`: public-first branded entry.
- `src/pages/auth/Login.tsx`: contextual authentication and AI Workspace post-auth routing.
- `src/pages/auth/Register.tsx`: role-aware registration and AI Workspace post-registration routing.
- `src/components/auth/RequirePage.tsx`: fail-closed protected-route authorization.

## Release gate

Before calling the entry experience production-ready, verify:

- fresh visitor → `/` → intent → auth → AI Workspace
- authenticated visitor → `/` → AI Workspace
- protected deep link → contextual auth → original destination
- refresh on every public and authenticated entry route
- expired/invalid token fails closed
- guest cannot access CRM data
- doctor/owner/admin contexts remain distinct
- mobile viewport has no overflow or clipped primary actions
- Vercel production deployment matches the latest `main` commit
- no new runtime errors
