# Changelog

All notable changes to DentVision V2 are documented in this file.

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
