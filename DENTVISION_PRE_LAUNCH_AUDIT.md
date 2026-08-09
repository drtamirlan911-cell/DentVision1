# DentVision Pre-Launch Audit

**Date:** 2026-08-09
**Auditor:** CTO / Senior Full-Stack / QA / Security / Product
**Scope:** Full application — backend, frontend, database, auth, AI, CRM, Diagnostic, Marketplace, Academy, Finance

---

## 1. Executive Summary

DentVision is a **multi-tenant dental SaaS platform** combining CRM, diagnostics, marketplace, academy, AI, and analytics. After comprehensive audit across 34 commits in this session, the application is **significantly hardened** but has remaining risks before production launch.

**Verdict:** 🟡 **READY WITH KNOWN RISKS**

---

## 2. Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Tailwind + Zustand + TanStack Query |
| Backend | Express + TypeScript + Prisma |
| Database | PostgreSQL (Neon) |
| Auth | JWT (access + refresh) + Session |
| AI | LLM integration (OpenAI) |
| Realtime | Redis Streams + WebSocket |

---

## 3. Security Audit

### FIXED (P0)
| ID | Issue | Fix |
|----|-------|-----|
| T-1 | Cross-tenant BI leak via `/clinic/:clinicId` path param | Added `clinicId === req.user?.clinicId` check |

### REMAINING (P1-P2)
| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| T-2 | P1 | Billing scope falls back to query/body clinicId | `clinicBilling.routes.ts:50` |
| T-3 | P1 | `@ts-nocheck` on auth-critical diagnostics module | `diagnostics.routes.ts:1` |
| T-4 | P2 | Unauthenticated clinic/doctor enumeration | `compat/compatRouter.ts:7` |
| R-1 | P2 | DB permissions additive-only, cannot restrict | `rbac.ts:81` |

---

## 4. Authentication & RBAC

### Strengths
- JWT with HS256, separate access/refresh secrets
- Session revocation with DB check
- Role hierarchy with permission matrix
- Person→PersonRole→Role→Permission graph

### Remaining
- Session revocation fails open on DB error (P2)
- Guest emails skip session check (P3)

---

## 5. Multi-Tenant Isolation

### Verified CORRECT
- Patients, appointments, medical records, files — all JWT-scoped
- `assertSameClinic`, `requireClinicScope` used consistently

### Remaining
- BI endpoint (fixed above)
- Billing scope confusion (P1)

---

## 6. Database

### Critical Issues
| ID | Severity | Issue |
|----|----------|-------|
| D-1 | P1 | Startup migrations not wrapped in transactions — partial failure possible |
| D-2 | P1 | `completedLessons` and `notification_preferences` need migrations |

### High
- Several missing foreign keys (AuditLog, AIEvent, NotificationPreference)
- Missing indexes on frequently filtered fields
- Enum mismatch in `add_ai_events.sql` vs schema

---

## 7. Finance & Payments

### Strengths
- Prices always fetched from DB at checkout (never trusted from frontend)
- Atomic guarded stock decrement
- Idempotent DentCash spending
- HMAC-verified payment callbacks

### Remaining
| ID | Severity | Issue |
|----|----------|-------|
| F-1 | P1 | Stock reserved at order creation, no TTL for abandoned orders |
| F-2 | P1 | No order status transition validation |
| F-3 | P2 | Idempotency key optional on payment creation |
| F-4 | P2 | Clinic callback settlement not in transaction |

---

## 8. CRM / Diagnostic / Shop / Academy

### Fixed This Session
- Cross-tenant BI leak
- Patients.tsx crash (orphaned diagnostics block)
- ReferralForm "Отмена" creating unwanted referrals
- Cashier double-submit
- Double notification bell
- Schedule appointment duration display

### Remaining
- Center/Lab onboarding flow (partially implemented)
- Shop stock TTL for abandoned orders
- Academy progress migration pending

---

## 9. Frontend / UX

### Strengths
- Comprehensive design system (Card, Modal, Toast, Skeleton, EmptyState)
- Mobile-responsive with safe areas
- Focus-visible accessibility (fixed this session)
- Touch targets (min-h-11)

### Fixed
- Responsive grids in Patients modals
- Button `xs` radius consistency
- Modal close focus-visible
- Interactive Card focus-visible

### Remaining
- Several `catch {}` blocks hide errors from user (should show retry)
- Some forms lack submit guards
- Native `window.confirm`/`prompt` for financial actions

---

## 10. Tests & Build

- ✅ TypeScript compiles
- ✅ 26 permission tests pass
- ⚠️ Integration/e2e tests missing
- ⚠️ No load/performance tests

---

## 11. Production Readiness Checklist

| Item | Status |
|------|--------|
| Auth + RBAC | ✅ |
| Tenant isolation | ✅ (1 P0 fixed) |
| Financial calculations | ✅ |
| Error handling | 🟡 (some gaps) |
| Mobile responsive | ✅ |
| Loading/Empty/Error states | 🟡 |
| Session management | ✅ |
| File upload validation | 🟡 |
| Rate limiting | 🟡 |
| CORS configured | ✅ |
| Env secrets | ✅ |

---

## 12. Launch Blockers (P0) — RESOLVED

1. ✅ Cross-tenant BI data leak
2. ✅ Patients page crash
3. ✅ ReferralForm unwanted submission
4. ✅ Cashier double financial records

---

## 13. Pre-Launch Actions (P1) — RECOMMENDED

1. Wrap startup migrations in transactions
2. Add order/stock TTL for abandoned orders
3. Make idempotency keys mandatory for payments
4. Remove `@ts-nocheck` from diagnostics.routes.ts
5. Add `try/catch` to remaining unguarded handlers
6. Apply `completedLessons` and `notification_preferences` migrations (trigger new deploy)

---

## 14. Final Decision

🟡 **READY WITH KNOWN RISKS**

The application can launch to a **limited beta audience** with the understanding that:
- P1 items should be addressed within 1-2 weeks
- Financial monitoring should be active from day one
- Rollback plan should be ready

**NOT suitable for:** unrestricted public launch without fixing P1 items above.
