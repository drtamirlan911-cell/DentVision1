# DentVision V2 — Release Checklist

**Target version:** 2.0.0  
**Date:** 2026-07-21

---

## 1. Quality gates (automated)

| Check | Command | Status |
|-------|---------|--------|
| Frontend lint (0 errors) | `npm run lint` | Required |
| Frontend build | `npm run build` | Required |
| Frontend tests | `npm test` | Required (39 tests) |
| Backend TypeScript | `cd dentvision-backend && npm run build` | Required |
| Prisma client | `cd dentvision-backend && npx prisma generate` | Required |

CI runs all of the above on push/PR (`.github/workflows/ci.yml`).

---

## 2. Pre-deploy (manual)

### Environment variables

**Frontend (Vercel)**

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_API_URL` | Yes | Production API URL (Render) |

**Backend (Render)**

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon PostgreSQL pooler |
| `JWT_SECRET` | Yes | Strong random string |
| `JWT_REFRESH_SECRET` | Yes | Strong random string |
| `CORS_ORIGIN` | Yes | Set to frontend domain(s), not `*` in production |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto | Render sets to 10000 |

### Database

```bash
cd dentvision-backend
npx prisma generate
npx prisma db push   # against production DATABASE_URL — never use --accept-data-loss
```

⚠️ See `render.yaml` warning: `db push --accept-data-loss` dropped live tables on 2026-07-20.

### Smoke tests after deploy

1. `GET /api/health` → `{ ok: true }`
2. Login → JWT issued
3. CRM Schedule loads without crash
4. `/book/:clinicId` public booking (if `onlineBookingEnabled`)
5. Supplier Workspace: switch-context → `/api/supplier/me`
6. School Workspace: switch-context → `/api/lecturer/me`

---

## 3. Security (before public release)

From `docs/SECURITY_REPORT.md` — address or accept risk:

| Priority | Item | Status |
|----------|------|--------|
| P0 | No committed `.env` / secrets | ✅ Verified |
| P0 | CORS not `*` in production | ⚠️ Set `CORS_ORIGIN` on Render |
| P1 | JWT_SECRET required (no fallback) | Verify `dentvision-backend/src/config.ts` |
| P1 | Document signing auth | Legacy `server/` — new backend uses RBAC |
| P2 | Refresh token rotation | Planned |

---

## 4. Known limitations (2.0.0)

- **TypeScript**: frontend `typecheck` has non-blocking errors; production build via Vite succeeds.
- **Legacy `server/`**: still in repo; production uses `dentvision-backend/`.
- **Analytics / Jobs / Community**: partial implementations; not release blockers for CRM core.
- **AI multi-agent (TS backend)**: deployed via `dentvision-backend`; LLM integration optional.

---

## 5. Release steps

1. Merge release branch to `main`
2. Tag: `git tag v2.0.0 && git push origin v2.0.0`
3. Vercel: auto-deploy from `main`
4. Render: auto-deploy from `main` (or manual trigger)
5. Verify smoke tests (§2)
6. Monitor `/api/health` and error logs for 24h

---

## 6. Rollback

- **Frontend**: Vercel → previous deployment
- **Backend**: Render → previous deploy; DB schema is forward-only (avoid destructive migrations)
- **Database**: Neon point-in-time restore if needed
