# Changelog

All notable changes to DentVision are documented in this file.

## [Unreleased] — 2026-09-16

### Documentation / Product Direction

- Consolidated the active Product/System direction into `docs/DENTVISION_MASTER_SPEC.md` version 4.0.
- Merged the current North Star, progressive-disclosure UX rules, public Welcome direction, first-class partner model and Dental Laboratory requirements into the Master Spec.
- Established `docs/DENTVISION_MASTER_SPEC.md` as the single normative Product/System source of truth; Product DNA remains the constitutional quality law, while execution/state/evidence/economics remain separate bounded sources.
- Explicitly preserved ecosystem parity: clinics, diagnostic centers, medical laboratories, dental laboratories, suppliers, academies, professionals, patients/buyers, jobs and community are first-class participant types according to the implemented domain model.
- Updated `README.md`, `ARCHITECTURE.md`, `DENTVISION_CONTEXT.md` and `DENTVISION_OPERATING_DIRECTIVE.md` to use the consolidated hierarchy and ecosystem-first model.

### Removed as superseded/redundant

- `docs/DENTVISION_V2_INTEGRATION_PLAN.md` — obsolete implementation baseline superseded by current IAM/economics/partner work.
- `docs/MODULE_STATUS.md` — stale 2026-07-17 status snapshot; current state belongs in `DENTVISION_CONTEXT.md` and generated system facts.
- `DENTVISION_SUPERAPP_MASTER_PLAN.md` — duplicated visual/product planning now incorporated into Product DNA + Master Spec.
- `docs/DENTVISION_EXECUTION_NORTH_STAR.md` — merged into Master Spec.
- `docs/DENTVISION_EXECUTION_NORTH_STAR_ADDENDUM_LAB_AND_WELCOME.md` — merged into Master Spec.
- `docs/DENTVISION_EXECUTION_NORTH_STAR_LABORATORY.md` — merged into Master Spec.
- `docs/DENTVISION_EXECUTION_NORTH_STAR_LAB_WELCOME_ADDENDUM_2026-09-11.md` — superseded after consolidation.

## [2.0.0] — 2026-07-21

### Added

- **Ecosystem phases 0–11**: Event Bus, IAM permissions, Supplier governance, Academy & Lecturer governance, Finance Core (double-entry ledger), Kaspi QR payments, Compliance gate (KZ), Developer Platform (API keys, webhooks), Workflow Studio, Data Intelligence, Partner Program.
- **Supplier Workspace**: self-service cabinet for marketplace sellers (`/api/supplier/*`, frontend `/supplier`).
- **School Workspace**: self-service cabinet for lecturers (`/api/lecturer/*`, frontend `/school-workspace`).
- **Online booking**: public patient booking page (`/book/:clinicId`) with clinic settings toggle `onlineBookingEnabled`.
- **AI Governance**: quality control and supplier/course agents (Phase 6).
- **IAM context switching**: `POST /api/iam/switch-context` for CLINIC / SUPPLIER / LECTURER scopes.
- **CI pipeline**: GitHub Actions for frontend lint/build/test and backend TypeScript build.

### Fixed

- Backend `app.ts`: missing route imports (`suppliersRouter`, `ecosystemRouter`, `complianceRouter`, `publicRouter`) that caused runtime crash on startup.
- Prisma schema drift: added Phase 4–11 models (Wallet, Transaction, Payment, Subscription, Workflow, Partner, etc.) and `SupplierMember`.
- Frontend `lecturerWs` API client for School Workspace.
- React Hooks violation in `ProactiveAlertsDisplay`.
- CRM Schedule runtime crash (bookings destructuring, #61).

### Security

- See `docs/SECURITY_REPORT.md` for remaining items. Pre-release: `.env` is gitignored; no secrets in repo.

### Deployment

- **Frontend**: Vercel (`npm run build` → `dist/`)
- **Backend**: Render (`dentvision-backend`, `npx prisma generate && npx prisma db push`, health at `/api/health`)
- **Database**: PostgreSQL (Neon). Run migrations via `prisma db push` on Render build (see `render.yaml`).
