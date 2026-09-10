# DentVision — Entry/Auth Release Checklist (2026-09-10)

## Decision
Authentication is not the application home. `/` is a public-first application entry point.

## Implemented on `main`

- Anonymous `/` renders the DentVision public Welcome experience after a short branded Splash.
- Authenticated `/` enters `/ai` directly.
- Contextual login modes are supported by `/login?role=doctor|patient|owner|admin`.
- Public browsing remains available for Shop, School, Jobs, Community, Demo, Pricing and legal pages.
- Guest sessions no longer bypass `RequirePage`; a guest token is an anonymous capability token, not authorization for CRM/platform pages.
- Protected CRM/platform routes redirect unauthenticated users to `/login` with the original location in router state.
- Existing role/page authorization remains enforced after authentication.
- The Welcome screen exposes AI, Academy, Marketplace, Jobs and role-specific entry points without requiring immediate registration.

## Required route contract

### Public
`/`, `/ai`, `/shop`, `/shop/:id`, `/school`, `/school/course/:id`, `/jobs`, `/community`, `/demo`, `/pricing`, `/terms`, `/privacy`, public booking/signing/patient portal routes.

### Authentication
`/login`, `/forgot-password` and registration flow. Authentication screens must never be used as the default home for anonymous users.

### Protected
CRM, analytics, settings, admin, BI, security, audit, backup, profile, clinic management, supplier and other role-gated operational routes.

## Entry scenarios

1. New user: Splash → Welcome → guest browsing/AI → action requiring account → contextual Auth → personalized private experience.
2. Existing session: Splash/boot → AI Workspace.
3. Deep link: Splash/boot → requested public page. If an action requires identity, show contextual Auth at the action boundary.
4. Logout: private experience must end in public entry, never a stale protected screen.
5. Expired JWT: protected API/session state must fail closed and return to authentication rather than treating expiry as guest authorization.
6. Clinic context: after authentication, clinic selection/membership remains a separate concern from application entry.

## Security invariant

Never use `isGuest` as an authorization bypass for a route that is protected by `RequirePage`. Public access must be granted by the route table itself; private access must require authentication plus IAM page permission.

## Next verification gate

- CI and Quality Gate on the final commit.
- Browser verification of `/`, `/ai`, `/shop`, `/school`, `/jobs`, `/login?role=doctor`, protected CRM routes, refresh and deep links.
- Verify logout, expired JWT, role denial and clinic-context behavior.
- Android entry flow must mirror the same public/private contract.
- Only after route/auth gate passes: continue the mobile visual hardening pass.
