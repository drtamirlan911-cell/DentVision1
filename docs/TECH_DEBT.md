# DentVision V2 — Technical Debt

**Date:** 2026-07-17

---

## CRITICAL DEBT

| # | Debt | Location | Effort |
|---|---|---|---|
| D1 | Triple state management (Zustand + Context + React Query) | src/store/, src/context/, src/queries/ | HIGH |
| D2 | Monolithic useData hook (499L, 8 exports, 6 dead) | src/hooks/useData.ts | HIGH |
| D3 | 15 dead files never imported | Various | LOW |
| D4 | Two API client patterns (functions vs class) | src/utils/api.ts vs src/services/api/client.ts | MEDIUM |
| D5 | ESLint only lints JS/JSX, not TS/TSX | eslint.config.mjs | LOW |
| D6 | No Prettier configured | Project root | LOW |
| D7 | Prisma packages in frontend dependencies | package.json | LOW |
| D8 | Two Zustand directories (store/ and stores/) | src/store/ + src/stores/ | LOW |
| D9 | Two useToast implementations | useData.ts vs ds/Toast.tsx | MEDIUM |
| D10 | Duplicate formatMoney/today in lib/utils vs utils/constants | lib/utils.ts + utils/constants.ts | LOW |

---

## FILE SIZE DEBT

| File | Lines | Limit | Over By |
|---|---|---|---|
| Documents.tsx | 767 | 300 | +467 |
| Cashier.tsx | 650 | 300 | +350 |
| Patients.tsx | 646 | 300 | +346 |
| IntelligenceLayout.tsx | 598 | 300 | +298 |
| Staff.tsx | 561 | 300 | +261 |
| Odontogram3D.tsx | 548 | 300 | +248 |
| constants.ts | 510 | 100 | +410 |
| Schedule.tsx | 486 | 300 | +186 |
| Shop.tsx | 466 | 300 | +166 |
| WelcomeAnimation.tsx | 457 | 300 | +157 |
| useData.ts | 442 | 150 | +292 |
| api.ts | 438 | 250 | +188 |
| actionRegistry.ts | 344 | 100 | +244 (DEAD) |
| types.ts | 353 | — | Centralized, acceptable |
| server/ai/actions.js | 627 | 300 | +327 |
| server/index.js | 581 | — | Entry point, needs splitting |
| server/ai/intentEngine.js | 412 | 300 | +112 |

---

## STUB/PLACEHOLDER DEBT

### API Stubs (return empty data silently)
- getLabOrders, getExpenses, getPromotions, getBookings
- getDocuments, getTreatments, getWaitingList
- getSchoolClinicalCases, getSchoolLibrary, getSchoolCertificates
- getServiceAccess, setServiceAccess, setServiceAccessBulk
- getPublicServiceAccess
- getMyProfile, getPublicProfile, updateMyProfile
- All skill/certificate/achievement/portfolio/case CRUD
- createShopReview

### Mock Data Pages
- Jobs.tsx — MOCK_VACANCIES
- Community.tsx — MOCK_POSTS

---

## ARCHITECTURE DEBT

| Debt | Impact |
|---|---|
| No dedicated layouts per service (CRM, Shop, School all use IntelligenceLayout) | Cannot customize navigation per service |
| All CRM pages in IntelligenceLayout (no nested routing) | Massive sidebar with 30+ items |
| No error boundaries around routes | Unhandled errors crash entire app |
| No React Query prefetching | Every navigation triggers fresh fetch |
| No optimistic updates | Perceived latency on all mutations |
| 5/9 WebSocket events have no handlers | No real-time updates for most entities |
| Backend has no WebSocket support | Cannot add real-time without server changes |

---

## SECURITY DEBT

See SECURITY_REPORT.md for full list. Key items:
- JWT fallback secret
- Unauthed document signing
- Unauthed shop product modification
- No refresh token rotation
- No server-side logout
- Base64 body bypass middleware
