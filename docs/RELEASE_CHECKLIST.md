# DentVision V2 — Release Checklist

**Target version:** 2.0.0  
**Date:** 2026-07-22 (world launch)

---

## 1. Quality gates (automated)

| Check | Command | Status |
|-------|---------|--------|
| Frontend build | `npm run build` | Required |
| Frontend tests | `npm test` | Required |
| Backend TypeScript | `cd dentvision-backend && npx tsc --noEmit` | Required |
| Prisma client | `cd dentvision-backend && npx prisma generate` | Required |

---

## 2. Pre-deploy (manual)

### Environment variables

**Frontend (Vercel)**

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_API_URL` | Yes | Production API URL (Render) |
| `VITE_DEMO_LOGIN` | Recommended | Demo one-tap login (default `owner@dentvision.kz`) |
| `VITE_DEMO_PASSWORD` | Recommended | Must match `DEMO_USER_PASSWORD` on API |

**Backend (Render)**

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon PostgreSQL pooler |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Yes | Strong random |
| `CORS_ORIGIN` | Yes | Production Vercel origin(s) |
| `DEMO_USER_PASSWORD` | Yes for demo | Seeds `owner@dentvision.kz` — must match frontend demo password |
| `DEMO_CLINIC_ID` | Recommended | Ensures demo clinic AI bypass |
| `OPENAI_API_KEY` | Recommended | Jarvis orchestrator |
| `KASPI_CALLBACK_SECRET` | For paid flows | Platform Kaspi callbacks |
| `PUBLIC_API_URL` | Recommended | Public API origin |
| `NODE_ENV` | Yes | `production` |

### Smoke after deploy (presentation order)

1. `GET /api/health` → `{ ok: true }` (warm Render first)
2. Open `/` as guest → Jarvis greeting loads
3. Chip **«Открыть демо-клинику»** → schedule loads (spinner, then data)
4. Ask Jarvis: «что умеешь», «открой прайс», «что важно сегодня?»
5. Sidebar: photo, alert bell, clinic switcher
6. Shop city filter (KZ) works for guests
7. Login / Register — branded, no Google dead-end
8. Favicon is DentVision mark (not Vite)

### Demo script (stage)

1. Pre-warm API 30–60s before going live
2. Prefer `/` → demo chip over cold CRM deep-link
3. Stay on DEMO clinic for AI (starter plans correctly gate paid AI)
4. Avoid Register mid-demo unless showing onboarding

---

## 3. Security

| Priority | Item | Status |
|----------|------|--------|
| P0 | No committed `.env` / secrets | Verify |
| P0 | CORS not `*` alone in production | Set `CORS_ORIGIN` |
| P1 | `DEMO_USER_PASSWORD` set in prod | Required for one-tap demo |

Full clinic Kaspi guide: [`docs/KASPI_CLINIC_SETUP.md`](./KASPI_CLINIC_SETUP.md).
