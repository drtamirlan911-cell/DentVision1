# DentVision Public-First Entry Architecture

Date: 2026-09-10

## Decision

Authentication is not the first screen for a new user. The application entry point (`/`) is a public-first experience.

### Entry states

1. New / anonymous user: `/` → public DentVision Welcome.
2. Authenticated user: `/` → `/ai` AI Workspace.
3. Direct deep link: preserve the requested public route; authentication is requested only when the requested action requires an account.
4. Protected application routes remain behind the existing authorization/role gates.

## Welcome experience

The public entry introduces DentVision as an AI Operating System for Dentistry and presents contextual intents:

- Doctor
- Patient / buyer
- Clinic owner
- Administrator
- Learning / Academy
- Shopping / Marketplace
- Finding a dentist
- Ask DentVision AI

The anonymous user can enter the guest/public experience without creating an account.

## Architecture boundary

Authentication and application entry are separate concerns. `RequirePage` owns the special dashboard entry decision: anonymous users render `Welcome`; authenticated users are redirected to `/ai`.

The existing guest session infrastructure remains responsible for anonymous capabilities and registration gates.

## Implemented commits

- `539aabd05debc2d39f716f8e6721e0e75def4990` — added `src/pages/Welcome.tsx`.
- `059bc77395e7432ee8407d56521448c1a039b9f6` — changed dashboard entry behavior in `RequirePage`.
- `2314e24897f29be8ac9ec79314ace84867fade34` — cleaned the final Welcome implementation.

## Release verification

CI and Quality Gate are triggered on `main` for the resulting commit. Production deployment is subject to the existing Vercel Hobby deployment-rate limit and must be visually verified once deployment capacity is available.
