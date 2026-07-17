# DentVision V2 — Security Report

**Date:** 2026-07-17

---

## CRITICAL (Fix Immediately)

| # | Issue | Location | Impact |
|---|---|---|---|
| C1 | **JWT fallback secret** derived from DATABASE_URL (`'dv-' + DATABASE_URL.slice(-32)`) | `server/middleware/auth.js:6` | Anyone with DB URL can forge tokens |
| C2 | **Unauthenticated document signing** (`PUT /api/medical/documents/:id/sign`) | `server/routes/medical.js` | Anyone can sign legal documents |
| C3 | **Unauthenticated shop product modification** (bridge PATCH) | `server/index.js` | Any user can modify any product |
| C4 | **`.env` committed** with production DATABASE_URL, JWT_SECRET | `dentvision-backend/.env` | Full database access exposed |
| C5 | **Malformed `.gitignore`** (wrapped in backticks) | Root `.gitignore` | .env files may be tracked |
| C6 | **Hardcoded passwords** in `dentvision-saas.jsx` | Root file | Credentials in source code |
| C7 | **Base64 body bypass** (`x-dv-data` header replaces req.body) | `server/index.js:50-59` | Bypasses all validation, rate limiting, WAF |

## HIGH (Fix Soon)

| # | Issue | Location |
|---|---|---|
| H1 | No refresh token rotation or revocation | Both backends |
| H2 | No server-side logout (tokens remain valid after "logout") | Both backends |
| H3 | `Math.random()` for password reset tokens | `server/routes/auth.js:251` |
| H4 | CORS wildcard `*` in production | `render.yaml` + `dentvision-backend/app.ts` |
| H5 | Bridge routes bypass RBAC (audit, shop, files) | `server/index.js` |
| H6 | AES-CBC encryption without HMAC (padding oracle risk) | `server/routes/crm.js` |
| H7 | Random encryption key on restart (data loss) | `server/routes/crm.js:29` |
| H8 | Audit bridge exposes all logs without clinic scoping | `server/index.js:499` |
| H9 | Error messages leaked in production | `server/index.js:560` |
| H10 | Generic upsert endpoint with raw SQL table interpolation | `server/routes/clinic.js:121` |

## MEDIUM (Plan to Fix)

| # | Issue | Location |
|---|---|---|
| M1 | Bcrypt 10 rounds (should be 12+) | `server/routes/auth.js` |
| M2 | No password length validation on new backend | `dentvision-backend/auth.routes.ts` |
| M3 | Frontend login accepts 4-char passwords | `src/pages/auth/Login.tsx` |
| M4 | No per-user rate limiting | All |
| M5 | No refresh endpoint rate limiting | `server/routes/auth.js` |
| M6 | 10MB body limit on new backend | `dentvision-backend/app.ts` |
| M7 | Invitation codes: 32-bit entropy (brute-forceable) | `server/routes/auth.js:219` |
| M8 | Seed passwords in source code | Multiple files |
| M9 | Forgot/reset password stubs in new backend | `dentvision-backend/auth.routes.ts` |

---

## AUDIT LOG COVERAGE

| Event | Logged? |
|---|---|
| CRM resource upserts | YES |
| CRM resource deletes | YES |
| Backup operations | YES |
| Medical card changes | YES |
| Visit creation | YES |
| Document changes | YES |
| **Login/logout** | **NO** |
| **Failed login attempts** | **NO** |
| **Token refresh** | **NO** |
| **Role changes** | **NO** |
| **Clinic creation** | **NO** |
| **Invitation creation** | **NO** |
| **User creation** | **NO** |
| **Permission denied** | **NO** |

---

## RECOMMENDATIONS

1. **Require JWT_SECRET env var** — remove fallback, crash on startup if missing
2. **Add auth to document signing** — require authenticate + ownership check
3. **Add RBAC to bridge routes** — wrap with requirePermission/requireSuperadmin
4. **Fix .gitignore** — remove backtick wrapping, verify .env is excluded
5. **Implement refresh token rotation** — invalidate old token on use
6. **Add server-side logout** — blacklist refresh tokens in DB
7. **Replace Math.random** with crypto.randomBytes for reset tokens
8. **Use AES-GCM** instead of AES-CBC for authenticated encryption
9. **Store encryption key** in env var with proper key management
10. **Add login/failed-login audit events**
11. **Remove base64 body bypass middleware** or secure it with HMAC validation
12. **Fix CORS** — whitelist specific origins only
