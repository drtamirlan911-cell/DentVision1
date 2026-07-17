# DentVision V2 — Frontend Report

**Date:** 2026-07-17

---

## FILE STRUCTURE

```
DentVision1/src/
├── app/providers/          (2 files) — Provider wrappers
├── components/
│   ├── ai/                 (6 files) — AI workspace components
│   ├── intelligence/       (15 files) — Intelligence layout components
│   ├── ui/ds/              (20 files) — Design system
│   ├── ui/motion/          (1 file) — Animation utilities
│   ├── DentVisionIntelligence.tsx  — DEAD
│   ├── ErrorBoundary.tsx
│   ├── NotificationCenter.tsx
│   ├── Odontogram3D.tsx
│   └── ProtectedRoute.tsx  — DEAD
├── context/                (3 files) — React Context providers
├── hooks/                  (1 file) — useData (monolithic)
├── layouts/                (6 files) — Layouts (4 DEAD)
├── lib/                    (3 files) — Utilities + constants + actionRegistry (DEAD)
├── pages/                  (28 files) — Page components
├── queries/                (11 files) — React Query hooks
├── services/
│   ├── api/                (2 files) — ApiClient wrapper
│   └── websocket/          (4 files) — Socket.io client
├── store/                  (6 files) — Zustand stores
├── stores/                 (2 files) — Duplicate Zustand stores
├── styles/                 (1 file) — global.css
├── utils/                  (7 files) — Utilities
├── index.tsx               — Router + entry
└── types.ts                — Centralized types
```

**Total: 131 files** (88 .tsx, 42 .ts, 1 .css)

---

## ROUTING

All 38 routes use `IntelligenceLayout` as sole layout. No route-level layout variation.

| Category | Routes | Layout |
|---|---|---|
| Public (4) | /login, /forgot-password, /book/:id, /sign/:token | None |
| Workspace (1) | /my-clinics | None |
| Intelligence (33) | /, /dashboard, /ai, /analytics, /settings, /admin, /audit, /backup, /profile, /jobs, /community, /crm/* (11), /shop/* (6), /school/* (2), /shop/admin, /school/admin | IntelligenceLayout |

**Issue:** No dedicated layouts for CRM, Shop, School. All pages share the same sidebar/topbar regardless of context.

---

## DESIGN SYSTEM STATUS

### Implemented (19 components)
Button, Input/Textarea/Select, Card, GlassCard, Avatar, Badge, Modal, Drawer, BottomSheet, Toast, Tooltip, Dropdown, Skeleton, StatCard, Progress, Tabs/Separator/Switch, EmptyState, SignaturePad, BottomNav

### Missing (8 components)
DatePicker, DataTable, Accordion, Pagination, Breadcrumb (inline in layout), CommandPalette, Toast (DS version conflicts with useData version), Popover

### Issues
- BottomNav exported but never imported (each layout builds own)
- Two useToast implementations (DS context vs useData self-contained)
- Input.tsx at 300 lines (limit is 300)

---

## STATE MANAGEMENT CHAOS

Three overlapping systems:

1. **Zustand** (6 stores in `store/` + 2 in `stores/`)
2. **React Context** (3 providers: Auth, Cart, Notifications)
3. **React Query** (10 query files, 29 hooks)

### Conflicts
- Auth managed by both Zustand (`auth.store.ts`) AND Context (`AuthContext.tsx`)
- Notifications managed by both Zustand (`notification.store.ts`) AND Context (`NotificationsContext.tsx`)
- Clinics managed by both Zustand (`clinic.store.ts`) AND React Query (`clinic.query.ts`)
- Two Zustand directories (`store/` and `stores/`) with overlapping concerns

### Dual API Pattern
- `utils/api.ts` (525L) — standalone functions, used by `useData`
- `services/api/client.ts` (177L) — class wrapper, used by React Query hooks

---

## FILES OVER LIMIT (300 lines)

| File | Lines | Category |
|---|---|---|
| Documents.tsx | 767 | Page |
| Cashier.tsx | 650 | Page |
| Patients.tsx | 646 | Page |
| IntelligenceLayout.tsx | 598 | Layout |
| Staff.tsx | 561 | Page |
| Odontogram3D.tsx | 548 | Component |
| constants.ts | 510 | Utility |
| Schedule.tsx | 486 | Page |
| Shop.tsx | 466 | Page |
| WelcomeAnimation.tsx | 457 | Component |
| useData.ts | 442 | Hook |
| api.ts | 438 | Utility |
| ServiceHub.tsx | 395 | Page (DEAD) |
| SchoolAdmin.tsx | 376 | Page |
| Profile.tsx | 377 | Page |
| ShopAdmin.tsx | 352 | Page |
| MedicalCard.tsx | 350 | Page |
| SchoolCourse.tsx | 344 | Page |
| AITeam.tsx | 343 | Page |
| actionRegistry.ts | 344 | Utility (DEAD) |
| AIServiceCards.tsx | 348 | Component |
| types.ts | 353 | Types |
| ServiceLayout.tsx | 336 | Layout (DEAD) |
| Dashboard.tsx | 334 | Page |
| ShopProduct.tsx | 334 | Page |
| PlatformLayout.tsx | 320 | Layout (DEAD) |
| AIWorkspaceIndex.tsx | 312 | Component |
| Input.tsx | 300 | DS Component |
| Lab.tsx | 305 | Page |
| SuperAdmin.tsx | 306 | Page |

**30 files exceed 300 lines** (5 are dead code)

---

## DEAD CODE SUMMARY

### Dead Files (15)
- PlatformLayout.tsx, ServiceLayout.tsx, CrmLayout.tsx, ShopLayout.tsx, SchoolLayout.tsx
- ServiceHub.tsx, DentVisionIntelligence.tsx, ProtectedRoute.tsx
- BottomNav.tsx, actionRegistry.ts, lib/constants.ts
- services/index.ts, queries/index.ts, store/workspace.store.ts, store/clinic.store.ts

### Dead Exports (6 in useData.ts)
- useCloudTable, useClinicData, useSubscription, usePhotoProtocol, useLabOrders, useAppointmentsWithReminders

---

## MOCK DATA PAGES
- **Jobs.tsx** — MOCK_VACANCIES hardcoded
- **Community.tsx** — MOCK_POSTS hardcoded

---

## TYPESCRIPT ISSUES
- `@lib/*` alias missing from tsconfig.json (only in vite.config.js)
- `noUnusedLocals: false` — dead code not caught at compile time
- `noUnusedParameters: false`
- Prisma packages in frontend dependencies (should be backend only)
