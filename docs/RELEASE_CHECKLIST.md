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

1. `GET /api/health` → `{ ok: true }` (warm Render 30–60s first — cold start recovery)
2. Open `/` as guest → Jarvis guest greeting (not clinic «выручка/долги»)
3. Chip **«Открыть демо-клинику»** → schedule loads (spinner, then data)
4. **Mobile:** bottom nav CRM → same demo path (`/crm/schedule?demo=1`)
5. Ask Jarvis: «что умеешь», «открой прайс» — guest AI counter decreases
6. Guest → «Создать аккаунт» (RegistrationModal) → `POST /api/guest/convert` works
7. Trial copy everywhere says **30 дней** (Login / Pricing / Demo)
8. Shop: guests see catalog + city filter; no «Кабинет продавца» / «Мой кэшбэк»
9. Sidebar: photo, alert bell (no noisy guest notification fetch), clinic switcher after login
10. Favicon + `/robots.txt` + OG image present

### Demo script (stage)

1. Pre-warm API 30–60s before going live
2. Prefer `/` → demo chip over cold CRM deep-link
3. Stay on DEMO clinic for AI (starter plans correctly gate paid AI)
4. Avoid Register mid-demo unless showing onboarding convert
5. If guest session fails: banner «Повторить» — do not hard-refresh mid-pitch

---

## 3. Security

| Priority | Item | Status |
|----------|------|--------|
| P0 | No committed `.env` / secrets | Verify |
| P0 | CORS not `*` alone in production | Set `CORS_ORIGIN` |
| P1 | `DEMO_USER_PASSWORD` set in prod | Required for one-tap demo |
| P1 | Guest convert only upgrades `@guest.local` users | Shipped |

Full clinic Kaspi guide: [`docs/KASPI_CLINIC_SETUP.md`](./KASPI_CLINIC_SETUP.md).
