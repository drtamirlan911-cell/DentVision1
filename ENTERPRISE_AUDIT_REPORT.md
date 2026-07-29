# 🏥 DentVision Enterprise Human-Like Audit Report

**Date:** 2026-07-29  
**Codebase:** DentVision Platform v2.0.0  
**Scope:** Full-stack audit (frontend, backend, AI, infrastructure, UX, security, commercial readiness)

---

## Executive Summary

DentVision is an ambitious AI-first dental ecosystem for Kazakhstan — combining CRM, Marketplace, Academy, Diagnostics, Finance, Legal Engine, and an AI Workspace with 13 specialized agents. The codebase shows strong architectural vision (Event Bus, Redis Streams, RBAC, SaaS plan gating) and significant engineering effort (41 backend modules, 88 AI files, 28+ frontend pages, 34 lib utilities).

**However, the product is NOT ready for commercial release.** The previous pre-release audit (2026-07-24) scored 46/100 with 38 critical issues. Based on this audit, approximately 15 critical issues remain unaddressed, and several new architectural concerns were discovered.

**Critical blockers:**
1. **No e2e payment flow** — Kaspi QR integration is partial; subscription auto-billing doesn't exist
2. **AI prompt injection surface** — User text flows into LLM prompts without PII scrubbing in several paths
3. **No SQL injection guardrails** — 40+ endpoints spread `req.body` without whitelisting
4. **Two conflicting AI stores** — `ai.store.ts` and `workspace.store.ts` maintain duplicate state
5. **Zero backend test coverage** — Only 5 backend test files exist for 41 modules
6. **Giant monolithic data query** — `useDataQuery()` loads 15+ collections in one hook
7. **Security: JWT uses HS256** (symmetric), no RS256/rotation
8. **File storage** — Only in-memory data URLs (5MB cap), no S3 configured despite env vars

---

## 1. Critical Issues

### C1. 🔴 No end-to-end payment flow
**Problem:** Kaspi QR integration exists (`paymentQr.ts`, `PaymentQrPanel.tsx`) but:
- No idempotency key on confirm endpoint
- Cashback calculated outside transactions
- Payout system sketched but never wired
- Subscription auto-billing doesn't exist (subscriptionCron only sends warnings, doesn't charge)
- `KASPI_CALLBACK_SECRET` is optional in config — payment webhooks can't be verified

**Impact:** Financial operations are not atomic. A clinic cannot collect money through the platform.

**Fix:** Implement idempotent payment confirmation, wrap cashback in DB transactions, wire Kaspi callback verification to `planEntitlements.ts`.

### C2. 🔴 AI prompt injection / PII leak surface
**Problem:** `ai.routes.ts` passes user message text directly to LLM prompts. The `piiScrubber.ts` exists but is not uniformly applied across all agent prompts. SSE stream (`/api/ai/notifications/stream`) has no per-user auth — any authenticated user can read any clinic's stream.

**Impact:** Patient PII (name, phone, IIN, address) can leak through AI responses. Prompt injection can hijack agent behavior.

**Fix:** Apply `piiScrubber.ts` to ALL inputs before LLM calls. Add clinic-scoped auth to SSE endpoint.

### C3. 🔴 Mass assignment / No input whitelist on 40+ endpoints
**Problem:** `patients.routes.ts` POST handler spreads `req.body` with `const body = req.body || {}` and passes fields to Prisma create/update without whitelisting. Pattern repeats across `clinics`, `appointments`, `shop`, `inventory`, `lab` routes.

**Impact:** An attacker can set arbitrary fields (e.g., `role: 'SUPERADMIN'`) on creation/update.

**Fix:** Apply Zod schemas (already imported in `validate.ts` middleware) to ALL mutation endpoints. Never spread `req.body`.

### C4. 🔴 Two conflicting AI stores
**Problem:** `ai.store.ts` (177 lines) and `workspace.store.ts` (226 lines) both manage AI state — `status`, `messages`, `suggestions`, `proactiveAlerts`, `sessionId`. Components use both inconsistently.

**Impact:** Race conditions, stale state, duplicated API calls. AI Workspace shows wrong status when both stores disagree.

**Fix:** Merge into single `ai.store.ts`. Deprecate `workspace.store.ts` AI fields. Migrate consumers.

### C5. 🔴 Zero backend test coverage
**Problem:** Out of 41 backend modules, only 5 test files exist: `dentcash/*.test.ts` (2), `ai/lib/*.test.ts` (3), `clinicLoadPlan.test.ts`, `payroll.test.ts`, `planEntitlements.test.ts`. Core modules (auth, patients, appointments, billing, payments, legal) have zero tests.

**Impact:** Every deployment is a gamble. Refactoring is dangerous.

**Fix:** Add integration tests for auth flow, patient CRUD, appointment creation, payment confirmation, and AI query. Target 40% coverage before release.

---

## 2. High Issues

### H1. 🟠 JWT uses HS256 (symmetric)
**Problem:** `jwt.ts` signs with `HS256` using a shared secret. No key rotation. No RS256 support.

**Fix:** Migrate to RS256 with key pair. Implement key rotation endpoint.

### H2. 🟠 CRM monolithic data hook
**Problem:** `useDataQuery()` at 396 lines fetches all CRM collections (patients, appointments, receipts, labOrders, expenses, inventory, doctors, etc.) in one hook. No granular loading.

**Impact:** A clinic with 10k patients loads everything on every route change. Mobile suffers.

**Fix:** Implement per-page queries with pagination. `usePatients()` loads only list. `usePatient(id)` loads details.

### H3. 🟠 Guest AI quota resets on every deploy
**Problem:** `guestAiQuota.ts` uses in-memory `Map`. Resets on server restart. No persistence.

**Impact:** Guests get 20 free AI calls per deploy (not per day). Render auto-deploys reset quotas.

**Fix:** Add Redis-backed quota or DB-backed counter.

### H4. 🟠 CSRF cookie is `httpOnly: false`
**Problem:** `csrf.ts` sets CSRF cookie as `httpOnly: false` with `sameSite: 'none'` in production. JS-accessible.

**Impact:** XSS can read CSRF token and forge state-changing requests.

**Fix:** Set `httpOnly: true`. Use double-submit cookie pattern or skip JS-accessible token.

### H5. 🟠 In-memory login guard
**Problem:** `loginGuard.ts` uses in-memory `Map` for brute-force protection. Resets on server restart.

**Impact:** Attacker can spam login after server restart. Multi-instance (Render) means each instance has independent counters.

**Fix:** Use Redis-backed attempt tracking.

### H6. 🟠 Diagnostics module is 90% placeholder
**Problem:** `DIAGNOSTICS-REMAINING.md` confirms only Prisma schema + API endpoints exist. Frontend pages (CenterList, LabList, Calendar, Statistics, Settings) are placeholders. File upload, tooth selector, notifications, AI integration not done.

**Impact:** Cannot ship Diagnostics as advertised.

### H7. 🟠 ESLint allows 10,000 warnings
**Problem:** `package.json` lint script: `"lint": "eslint src/ --max-warnings 10000"`. Effectively disables lint enforcement.

**Impact:** `no-explicit-any`, `no-console`, `unused-vars` warnings accumulate silently. Code quality degrades.

---

## 3. Medium Issues

### M1. 🟡 41 backend modules — many are tiny
`compatRouter.ts` (23 lines), `legal.export.ts` (19 lines), `legal.number.ts` (35 lines), `dentcash.routes.ts` — many modules could be merged. Every module adds boilerplate (imports, middleware, error handling).

### M2. 🟡 9 Zustand stores — potential for consolidation
Stores: auth, ai, ui, patient, cart, workspace, guest, notification, ui. `ai.store` and `workspace.store` overlap. `cart.store` duplicates localStorage read/write in every action.

### M3. 🟡 No S3 storage configured
`config.ts` has `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` but they're all optional. `image-upload.ts` only supports data URLs (5MB max). Files are stored as JSON blobs in DB.

### M4. 🟡 Prisma enum vs frontend string duplication
Prisma enums (`UserRole`, `AppointmentStatus`, `InvoiceStatus`) are duplicated as string constants in frontend `constants.ts` and `types.ts`. When schema changes, frontend breaks silently.

### M5. 🟡 No proper error boundaries per page
Only one `ErrorBoundary.tsx` wraps the entire app. A crash in any component takes down the whole UI.

### M6. 🟡 i18n has 3 languages but most strings are hardcoded in Russian
`ru.json`, `kz.json`, `en.json` exist but `useTranslation()` is rarely used. Most UI text is hardcoded Russian strings.

### M7. 🟡 `noUnusedLocals` and `noUnusedParameters` are false
Backend `tsconfig.json` has both set to `false`. Dead code accumulates silently.

### M8. 🟡 Git history shows committed `.env` with live credentials
Previous audit found `.env` committed. Need to verify `git filter-branch` was run to purge from history.

---

## 4. Low Issues

### L1. 🔵 Framer Motion import in every page
Most pages import `motion` from `framer-motion` even for static layouts. Increases bundle size.

### L2. 🔵 `console.error` in production code
Many catch blocks use `console.error` instead of structured logging. Production logs are noise.

### L3. 🔵 Magic strings for permissions
Permissions like `'patient.read'` are hardcoded strings in `rbac.ts`. No TypeScript safety if typo'd.

### L4. 🔵 No automated visual regression tests
0 visual tests. UI changes (Tailwind theme, component refactors) can break layouts silently.

### L5. 🔵 Render plan is `free` in `render.yaml`
Production infra pinned to Render free tier. Cold starts take 30+ seconds. No autoscaling.

---

## 5. UX Improvements

### UX1. First-run experience is too complex
5-phase onboarding (greeting → docking → docked → collapsed → done) with 15s auto-collapse. Users are confused. **Simplify:** Show sidebar immediately expanded, let user collapse manually.

### UX2. Guest flow requires 2 modals
Guest hits a page → sees `GuestCRMModal` → then may see `RegistrationModal`. Two overlapping modals. **Fix:** Single modal with tab: "Try demo" / "Register" / "Login".

### UX3. 17 CRM tabs is overwhelming
Schedule, Patients, Medical Card, Cashier, Pricelist, Lab, Inventory, Promotions, Staff, ICD-10, Visits, Documents, Reminders, Dental Chart, Treatment Plans, Finance, Clinic Settings. **Fix:** Merge ICD-10 into Medical Card. Merge Reminders into Schedule. Collapse rarely-used tabs under "More".

### UX4. No shortcut for common actions
Every new appointment requires: click time → modal opens → select patient → select doctor → select service → select time → submit. **Fix:** Quick-add bar: type patient name + service → one-click create.

### UX5. Mobile bottom nav has 4 items
Only Schedule, Patients, Cashier, AI are visible. Everything else requires hamburger menu. **Fix:** Let users customize bottom nav.

---

## 6. UI Improvements

### UI1. Loading states are inconsistent
Some pages use `Skeleton`, some use `PageLoader`, some use nothing. **Fix:** Uniform `Skeleton` pattern for every data-dependent view.

### UI2. Empty states are inconsistent
`EmptyState` component exists but many pages render blank divs when no data. **Fix:** Every list page must render `EmptyState`.

### UI3. Form validation is inline and repetitive
Every form has inline `if (!form.name.trim()) { showToast(...) }`. **Fix:** Create `useFormValidation()` hook or use Zod on frontend.

### UI4. No dark/light preview in settings
Users can toggle dark mode but can't preview before applying.

---

## 7. Performance Improvements

### P1. Giant bundle — vendor chunk 135 kB gzipped
`vendor-react-s` chunk is 163 kB (464 kB raw). **Fix:** Code-split by route (already lazy imports exist but vendor chunks aren't split enough).

### P2. `useDataQuery` re-fetches everything on clinic switch
Changing clinic triggers 15+ parallel API calls. **Fix:** Granular query keys per collection.

### P3. Framer Motion animate on every route change
`IntelligenceLayout.tsx` wraps `<Outlet>` in `<motion.div>` with `animate={{ opacity: 1 }}`. Every route transition triggers animation. **Fix:** Skip animation for programmatic navigation.

### P4. No virtualization for long lists
Patients list renders all rows in DOM. 10k patients = 10k DOM nodes. **Fix:** Use `react-virtual` or `react-window`.

---

## 8. Security Improvements

### S1. No rate limit on file upload
File upload endpoint has no size limit beyond Express `10mb` JSON limit. **Fix:** Add multer limits + file type validation.

### S2. CORS allows all Vercel preview deployments
`cors.ts` uses lenient hostname check: `if (host.includes('dent-vision') || host.includes('dentvision'))`. Any Vercel preview with "dentvision" in name is allowed.

### S3. No audit log for admin actions
`events/subscribers.ts` only logs `patient.created`, `patient.deleted`, `appointment.created`. Admin actions (clinic delete, user role change) are not audited.

### S4. API keys in client-side code
The frontend `api.ts` calls backend directly. No API key scoping or rate limiting per API key.

---

## 9. Architecture Improvements

### A1. Monolithic backend with no domain boundaries
41 modules with shared Prisma client, shared middleware, shared types. No microservice boundaries. A bug in `patients.routes.ts` can crash the entire server.

### A2. Frontend path aliases are duplicated
`tsconfig.json`, `vite.config.js`, and `vitest.config.ts` all define the same path aliases (`@/`, `@components/`, etc.). Single source of truth needed.

### A3. No API versioning
All routes are under `/api/` with no version prefix (`/api/v1/`, `/api/v2/`). Breaking changes affect all clients.

### A4. Seed data in production bundle
`seed-data.ts` (195 lines) with realistic patient names, phone numbers, addresses is compiled into production frontend. PII exposure risk.

---

## 10. Backend Improvements

### B1. No request logging middleware
Error handler logs errors but no request/response logging for debugging.

### B2. `try/catch` without specific error types
Most routes use generic `catch (error)` and return 500. No differentiation between validation error (400), not found (404), conflict (409).

### B3. Missing database indexes on common queries
Prisma schema has `@@index` on some models but `patients` table has no index on `phone`, `email`, or `iin` (just added).

### B4. No database migration strategy
`start` script uses `prisma db push --accept-data-loss` — destructive on production. `render.yaml` uses `prisma migrate deploy` but no migration files exist in repo (SQL files in `prisma/migrations/`).

---

## 11. Frontend Improvements

### F1. Component library is both custom and Radix
`components/ui/ds/` has 23+ custom components but also imports `@radix-ui/*` for Dialog, Dropdown, Tabs, Tooltip. Two design systems fighting.

### F2. No component storybook
23+ design system components have no isolated preview. Hard to develop and test.

### F3. `any` types everywhere
Despite TypeScript strict mode, many components use `as any` casts. `useDataQuery` returns `any` for many collections.

### F4. No form library
Forms use manual `useState` + `onChange`. No `react-hook-form` or `formik`. Validation is inline and duplicated.

---

## 12. AI Improvements

### AI1. Agent system has no monitoring dashboard
13 agents run but no UI to see: which agent handled what, token cost, latency, failure rate.

### AI2. No prompt versioning
System prompts in `prompts/system.prompts.ts` mutate directly. No version tracking. A bad prompt deploy breaks all agents.

### AI3. Token budgets are soft
`OPENAI_DAILY_MINI_TOKENS` and `OPENAI_DAILY_FULL_TOKENS` are counted in-process. On multi-instance, each instance has independent counters.

### AI4. No caching for common queries
Repeated questions ("What is my schedule today?") hit LLM every time. No response caching.

---

## 13. Database Improvements

### DB1. No read replica configuration
Single Neon instance handles all reads and writes. No connection pooling configuration in Prisma.

### DB2. No soft delete policy
Some models have `deletedAt`, most don't. `patients` has it, but `appointments`, `receipts`, `documents` don't.

### DB3. JSONB fields without validation
`medicalHistory` is `Json?` in schema — any arbitrary JSON can be stored. No schema validation at DB level.

---

## 14. DevOps Improvements

### D1. Docker compose has no volume mounts
PostgreSQL is not in docker-compose (relies on Neon). Local dev requires external DB connection.

### D2. No staging environment
Only production (Render) and localhost. Changes go directly to prod. No canary or blue-green.

### D3. CI doesn't run backend tests
GitHub CI only runs frontend lint/build/test + backend build. Backend tests (which exist for 5 files) are not executed.

---

## 15. Compliance Improvements

### CP1. No GDPR / KZ Personal Data Law compliance
Patient PII (name, phone, IIN, address, medical history) stored without consent logging, data export, or deletion API.

### CP2. No retention policy
Old patient data, visits, receipts stored forever. No archival/cold storage mechanism.

### CP3. No cookie consent banner
Application sets `accessToken`, `refreshToken` cookies without user consent.

---

## 16. Legal Improvements

### L1. Legal Engine is new and untested
Legal module (`legal.routes.ts`, `legal.partner.routes.ts`) was recently added. No tests, no production data, no signature verification beyond email.

### L2. Document templates hardcoded in frontend
`Documents.tsx` has inline template strings for consent forms. Changing a template requires frontend deploy.

---

## 17. Code Simplification

### What can be removed without losing functionality:

| Item | Reason |
|------|--------|
| `workspace.store.ts` | Merged into `ai.store.ts` |
| `compatRouter.ts` (23 lines) | Single endpoint, can be inline |
| `seed-data.ts` from frontend | Production doesn't need demo data |
| `legal.export.ts` (19 lines) | Single function, can be in legal service |
| `legal.number.ts` (35 lines) | Inline in legal service |
| `kz-cities.ts` frontend copy | Duplicated in backend `kzCities.ts` |
| `dentcash.ts` frontend lib (53 lines) | Only used by `DentCashHeaderChip` |
| `field-mappings.ts` (36 lines) | No longer used (migration to Prisma complete) |
| `image-upload.ts` (26 lines) | Only used in Photos component |
| `jobsAiQuery.ts` (105 lines) | Experimental, no active UI |
| `supplier.agent.ts` / `owner.agent.ts` | Duplicated agent logic |
| 17 CRM tabs → 12 | Merge ICD-10, Reminders, Finance |
| `eslint.config.mjs` (44 lines) | Duplicated by `eslint.config.js` |

### What can be merged:

| Items | Merge into |
|-------|-----------|
| `auth.store.ts` + `guest.store.ts` | Single auth store |
| `ai.store.ts` + `workspace.store.ts.ai` | Single AI store |
| `cart.store.ts` | Merge with workspace store |
| `Sidebar.tsx` + `BottomNav.tsx` + `AlertDropdown.tsx` | Shared nav components |
| `legal.routes.ts` + `legal.partner.routes.ts` | Single legal router |
| `clinic.query.ts` + `patient.query.ts` + `schedule.query.ts` + `appointment.query.ts` | Single CRM query file |
| `analytics.query.ts` + `ai.query.ts` + `notification.query.ts` | Single platform query file |

---

## 18. Automation Opportunities

### What AI can fully automate:

1. **Appointment reminders** — Already done via `reminderCron.ts` (WhatsApp/SMS)
2. **Patient follow-ups** — Post-treatment check-in via AI followup agent
3. **Inventory restock suggestions** — `inventory-shop-match.ts` matches low stock to marketplace
4. **Treatment plan generation** — `odontogram-plan-sync.ts` converts dental chart to treatment plan
5. **Document generation** — Legal templates auto-fill from patient/partner data
6. **Subscription renewal warnings** — Already done via `subscriptionCron.ts`
7. **Duplicate patient detection** — `recall.ts` has `findDuplicatePatients`
8. **AI CFO briefing** — `cfo` agent generates daily financial summary
9. **Clinical note drafting** — Post-visit SOAP note generation from voice/text
10. **Radiology report triage** — `radiology` agent prioritizes urgent findings

### Missing automation:
- **Auto-scheduling** — No AI that suggests optimal appointment slots based on doctor history
- **Insurance claims** — No automated submission to KZ insurance providers
- **Patient intake** — No self-service kiosk / QR check-in
- **Lab order tracking** — No status tracking from clinic → lab → results
- **Multi-language auto-translate** — AI could translate UI/text between RU/KZ/EN

---

## 19. Final Scores

| Category | Score (0-100) | Grade | Assessment |
|----------|---------------|-------|------------|
| **Architecture** | 58/100 | D | Ambitious but fragmented (dual AI stores, monolithic data hook) |
| **UX** | 52/100 | D | First-run confusing, 17 CRM tabs overwhelming, guest flow broken |
| **UI** | 60/100 | D | Good design system, inconsistent loading/empty states |
| **Backend** | 54/100 | D | 41 modules, good security middleware, but no tests, mass assignment risks |
| **Frontend** | 55/100 | D | Strong component library, but redundant stores, any-types, no form lib |
| **Security** | 38/100 | F | HS256 JWT, in-memory guards, no input whitelist, PII in AI prompts |
| **Performance** | 45/100 | F | Giant bundle, monolithic query, no virtualization, no code splitting |
| **Scalability** | 42/100 | F | In-memory quotas, no read replicas, Render free plan |
| **Medical Logic** | 50/100 | D | Strong odontogram/treatment plan, Diagnostics 90% placeholder |
| **SaaS Readiness** | 40/100 | F | No payment flow, no onboarding, pricing page exists but no billing |
| **Enterprise Readiness** | 35/100 | F | No audit trail, no SSO, no RBAC audit, no compliance |
| **AI Readiness** | 55/100 | D | 13 agents, event bus, Redis memory, but no monitoring, no prompt versioning |
| **Commercial Readiness** | 35/100 | F | No revenue path, no payment processing, no subscription billing |
| | | | |
| **OVERALL** | **47/100** | **F** | |

---

## 20. GO / NO GO

# 🛑 NO GO

**Do not release to production.**

### Critical blockers to resolve before release:

| # | Blocker | Effort | Owner |
|---|---------|--------|-------|
| 1 | Implement end-to-end Kaspi payment flow with idempotency | 2 weeks | Backend |
| 2 | Apply PII scrubbing to all AI inputs + SSE auth | 1 week | AI team |
| 3 | Add Zod validation to all 40+ mutation endpoints | 2 weeks | Backend |
| 4 | Merge `ai.store.ts` and `workspace.store.ts` | 2 days | Frontend |
| 5 | Add integration tests for auth, patients, appointments, payments | 3 weeks | QA |
| 6 | Migrate JWT to RS256 with key rotation | 3 days | Backend |
| 7 | Implement DB-backed login guard and AI quota | 2 days | Backend |
| 8 | Replace `useDataQuery` with per-page granular queries | 1 week | Frontend |
| 9 | Add request logging, structured error handling | 3 days | Backend |
| 10 | Remove seed data from production build | 1 day | Frontend |

### Estimated time to fix all blockers: **8-10 weeks** with a team of 3 engineers.

---

## Final Verdict

DentVision V2 is an **impressive technical prototype** with strong architectural foundations and genuine innovation in AI-first dental workflow design. The 13-agent system, Redis-backed event bus, odontogram-to-treatment-plan pipeline, and legal engine demonstrate real engineering capability.

**However**, the product in its current state would:
- **Lose money** — No payment processing means no revenue
- **Lose patients** — PII leaks via AI would destroy trust
- **Lose clinics** — Data loss from un-atomic payments would cause churn
- **Lose to competitors** — Diagnostics (key USP) is 90% placeholder
- **Fail audit** — No compliance, no audit trail, no data retention

The gap between "working prototype" and "commercial SaaS" is approximately **8-10 weeks of focused engineering** on the critical blockers above. The architecture is sound enough to scale once these are addressed.

**Recommendation:** Fix blockers, add payment flow, harden security, write tests. Target re-assessment in Q4 2026.

---

*Report generated by DentVision Enterprise Audit Commission (CEO, Product Owner, UX Researcher, UI Designer, Senior React Developer, Senior Backend Engineer, Software Architect, Security Engineer, QA Lead, DevOps Engineer, Database Architect, AI Architect, Dentist, Orthopedist, Clinic Administrator, Assistant, Patient, CFO, Lawyer, Investor)*
