# DentVision V2 — Architectural Audit Report

**Date:** 2026-07-17
**Status:** Complete

---

## 1. WHAT IS ALREADY IMPLEMENTED

### Frontend

| Module | Status | Details |
|---|---|---|
| **IntelligenceLayout** | 🟡 Partial | Sole active layout, 598 lines (too large). Sidebar, breadcrumbs, context panel, alert dropdown. |
| **AI Workspace** | 🟡 Partial | AIWorkspaceIndex (312 lines), ChatInput, ChatMessage, AIInputArea, ServiceOrbitCards, ContextPanel with 3 tabs. Not a command workspace yet — still chat-centric. |
| **Design System** | 🟡 Partial | 19 components (Button, Input, Card, GlassCard, Avatar, Badge, Modal, Drawer, BottomSheet, Toast, Tooltip, Dropdown, Skeleton, StatCard, Progress, Tabs, EmptyState, SignaturePad, BottomNav). Missing: DatePicker, DataTable, Accordion, Pagination. |
| **Auth** | ✅ Ready | Login, Register, ForgotPassword, PublicBooking, DocumentSign. JWT + refresh flow. |
| **CRM Pages** | 🟡 Partial | Schedule (486L), Patients (646L), Cashier (650L), Staff (561L), Lab (305L), MedicalCard (350L), Visits (223L), Documents (767L), PriceList, Promotions, Inventory, ICD10. All over-size. |
| **Shop** | 🟡 Partial | Shop (466L), ShopProduct (334L), Checkout, Orders, Favorites, Suppliers. Products use mock data for some fields. |
| **School** | 🟡 Partial | School (296L), SchoolCourse (344L). Working but no clinical cases or library. |
| **Notifications** | 🟡 Partial | NotificationCenter (155L), notification store, React Query hooks. No toast integration with server events. |
| **WebSocket** | 🟡 Partial | SocketProvider, WebSocketClient, events defined. Only 2/9 events have handlers. No real-time cache invalidation. |
| **Analytics** | 🔴 Missing | Page exists (82L) but uses receipt data as analytics. No charting library, no real metrics. |
| **Jobs** | 🔴 Missing | Mock data only (MOCK_VACANCIES). Not connected to backend. |
| **Community** | 🔴 Missing | Mock data only (MOCK_POSTS). Not connected to backend. |
| **Mobile** | 🟡 Partial | BottomSheet, BottomNav exist. No touch gestures, no safe area handling, no responsive breakpoints on most pages. |
| **Error Boundaries** | 🟡 Partial | ErrorBoundary component exists (60L) but not wrapped around routes. |
| **Lazy Loading** | ✅ Ready | Most page-level components use React.lazy + Suspense. |

### Backend (server/)

| Module | Status | Details |
|---|---|---|
| **Auth** | 🟡 Partial | Login, register, refresh, password reset, clinic switch. No server-side logout. Password reset uses Math.random(). |
| **RBAC** | ✅ Ready | 5 roles (superadmin, director, admin, doctor, assistant). Permission matrix. requireSameClinic. |
| **CRM** | ✅ Ready | 14 resources × 3 CRUD methods = 44 endpoints. Generic router. |
| **Medical** | ✅ Ready | ICD-10, medical cards, visits, documents, digital signatures. |
| **Shop** | ✅ Ready | Products, orders, reviews, favorites, categories, suppliers, CMS. |
| **School** | ✅ Ready | Courses, enrollments, clinical cases, library, certificates, CMS. |
| **AI** | 🟡 Partial | Full rule-based system (13 files). No LLM integration. Regex intent classification. 30 actions. Knowledge base. Digital twin. Proactive alerts. Conversation memory. |
| **Notifications** | ✅ Ready | CRUD, unread count, mark read. Notification helper. |
| **Audit** | ✅ Ready | Audit log CRUD. Backup endpoint. Bridge routes missing RBAC. |
| **Profile** | ✅ Ready | LinkedIn-style professional profile. Skills, certs, achievements, portfolio, cases. |
| **Service Access** | ✅ Ready | Per-clinic feature toggles. In-memory cache. |
| **WebSocket** | 🔴 Missing | No socket.io or WebSocket in server/. |
| **Rate Limiting** | ✅ Ready | Global (200/15min), Auth (20/15min), Public (30/15min). |

### Backend (dentvision-backend/ — TS rewrite)

| Module | Status | Details |
|---|---|---|
| **Auth** | 🟡 Partial | JWT with separate secrets. Zod validation. Password reset is a stub. |
| **RBAC** | ✅ Ready | 9 roles with hierarchy. MinRole middleware. |
| **AI** | 🟡 Partial | Multi-agent types defined. Intent engine. Agent router. Memory engine. Functions. Prompts. Routes. Not deployed. |
| **Files** | 🔴 Missing | Multer upload to /mock-storage (fake). Never writes to disk. |
| **Validation** | 🟡 Partial | Zod middleware exists but unused in routes. |

### Database

| Aspect | Status | Details |
|---|---|---|
| **Legacy Schema** | ✅ Ready | 47 models, extensive @map, @db.VarChar, decimal precision. |
| **New Schema** | 🟡 Partial | 27 models, lost 20 models (43%). Better indexes. No soft deletes. All IDs use @default(""). |
| **Migrations** | 🔴 Missing | No migration directory. Only db push used. |
| **Seed Data** | ✅ Ready | 284-line seed for new backend. Legacy has inline seed. |

---

## 2. WHAT IS IMPLEMENTED WRONG

| File | Problem | Why It's Bad | Fix |
|---|---|---|---|
| `src/hooks/useData.ts` (499L) | Monolithic data hook with 8 exports, 6 dead. Module-level mutable store. | God object. Mixing concerns. 6 dead exports. Bug in deleteWaitingListItem. | Split into domain hooks. Remove dead exports. Fix bug. Migrate to React Query. |
| `src/utils/constants.ts` (568L) | Design tokens + seed data + utility functions + ICD-10 codes + field mappings in one file. | Unmaintainable. 568 lines of mixed concerns. | Split into: design-tokens.ts, seed-data.ts, icd10.ts, field-mappings.ts, formatters.ts |
| `src/utils/api.ts` (525L) | 80+ functions, many are stubs returning empty data. | False confidence. Stubs silently return empty arrays instead of errors. | Implement stubs or remove them. Add proper error throwing. |
| `src/services/api/client.ts` (177L) | ApiClient class that wraps api.ts with zero added value. | Unnecessary abstraction. Confusing dual import paths. | Remove ApiClient class. Use api.ts functions directly. |
| `src/store/` + `src/stores/` | Two separate Zustand store directories with overlapping concerns. | Confusion. clinic.store.ts + clinic.query.ts = dual source of truth. | Consolidate to single `store/` directory. Remove duplicates. |
| `src/context/AuthContext.tsx` + `src/store/auth.store.ts` | Both manage auth state. Triple state management (Zustand + Context + React Query). | Synchronization bugs. Stale state. | Pick one: Zustand for auth, React Query for server state. Remove Context. |
| `server/ai/actions.js` (627L) | All 30 AI actions in a single file. | Unmaintainable. Hard to find/modify actions. | Split by domain: navigation.js, crm-actions.js, shop-actions.js, school-actions.js |
| `server/index.js` (581L) | Entry point with 25+ bridge routes, full seed data, inline handlers. | God file. Bridge routes should be in separate files. | Extract bridge routes to routes/bridge.js. Extract seed to seed.js. |
| `server/routes/clinic.js` | Table name interpolated into raw SQL ($queryRawUnsafe). | SQL injection risk despite whitelist. Fragile. | Use Prisma model methods instead of raw SQL. |
| `server/middleware/auth.js` | JWT fallback secret derived from DATABASE_URL. | Token forgery if DB URL is known. | Require JWT_SECRET env var. Remove fallback. |
| `server/middleware/rbac.js` | requireSameClinic silently passes if no clinic_id in request. | Tenant isolation bypass on routes without clinic_id param. | Fail closed: require clinic_id or explicit bypass flag. |
| `src/pages/crm/Documents.tsx` (767L) | Document CRUD + templates + signing + linking in one file. | Largest frontend file. Hard to maintain. | Split into: DocumentList, DocumentEditor, DocumentSigning, DocumentTemplates. |
| `src/pages/crm/Cashier.tsx` (650L) | 6-tab finance page with multiple modals. | Too large. Mixing 6 different views. | Split each tab into its own component. |
| `src/pages/crm/Patients.tsx` (646L) | Patient CRUD + odontogram + history + categories. | Too large. | Split into: PatientList, PatientDetail, PatientForm, PatientCategories. |
| `src/layouts/IntelligenceLayout.tsx` (598L) | Sidebar + header + context panel + alerts + welcome animation. | Too large for a layout. | Extract: Sidebar, Header, AlertDropdown, WelcomeOverlay into separate files. |

---

## 3. DUPLICATION

### Duplicate Stores
| Duplicate A | Duplicate B | Overlap |
|---|---|---|
| `src/store/clinic.store.ts` | `src/queries/clinic.query.ts` | Both fetch and cache clinic data |
| `src/store/notification.store.ts` | `src/queries/notification.query.ts` | Both fetch and cache notifications |
| `src/store/patient.store.ts` | `src/queries/patient.query.ts` | Both manage patient selection |
| `src/store/auth.store.ts` | `src/context/AuthContext.tsx` | Both manage auth state + tokens |
| `src/store/workspace.store.ts` | `src/stores/useUIStore.ts` | Both manage sidebar/context UI state |

### Duplicate Utilities
| Duplicate A | Duplicate B | Overlap |
|---|---|---|
| `src/utils/constants.ts` formatMoney() | `src/lib/utils.ts` formatMoney() | Money formatting (different signatures) |
| `src/utils/constants.ts` today() | `src/lib/utils.ts` today() | Date formatting |
| `src/hooks/useData.ts` useToast() | `src/components/ui/ds/Toast.tsx` useToast() | Toast notifications (different APIs) |

### Dead Files (not imported anywhere)
- `src/layouts/PlatformLayout.tsx` (320L)
- `src/layouts/ServiceLayout.tsx` (336L)
- `src/layouts/services/CrmLayout.tsx` (48L)
- `src/layouts/services/ShopLayout.tsx` (28L)
- `src/layouts/services/SchoolLayout.tsx` (28L)
- `src/pages/hub/ServiceHub.tsx` (395L)
- `src/components/DentVisionIntelligence.tsx` (292L)
- `src/components/ProtectedRoute.tsx` (27L)
- `src/components/ui/ds/BottomNav.tsx` (90L)
- `src/lib/actionRegistry.ts` (344L)
- `src/lib/constants.ts` (53L)
- `src/services/index.ts` (1L)
- `src/queries/index.ts` (11L)
- `src/store/workspace.store.ts` (28L)
- `src/store/clinic.store.ts` (34L)

### Dead Exports in useData.ts
- `useCloudTable`, `useClinicData`, `useSubscription`, `usePhotoProtocol`, `useLabOrders`, `useAppointmentsWithReminders`

---

## 4. PERFORMANCE

| Issue | Location | Impact |
|---|---|---|
| **No code splitting on CRM pages** | `src/index.tsx` | All CRM pages loaded as single lazy chunks. Cashier (650L) + Patients (646L) = huge initial load per section. |
| **useData fetches ALL clinic data on mount** | `src/hooks/useData.ts:189` | `loadData()` calls `getClinicData(clinicId)` which hits `GET /api/crm/:clinicId/data` returning 17 tables at once. |
| **Zero React Query prefetching** | `src/queries/` | No `prefetchQuery` or `prefetchInfiniteQuery` anywhere. Every navigation triggers a fresh fetch. |
| **Zero optimistic updates** | `src/queries/` | All 16 mutation hooks wait for server response before updating UI. Creates perceived latency. |
| **5 WebSocket events without handlers** | `src/services/websocket/SocketProvider.tsx` | appointment.*, patient.*, lab.*, invoice.*, inventory.* events are defined but not handled. No real-time updates. |
| **Module-level mutable store in useData** | `src/hooks/useData.ts:53` | Shared singleton store bypasses React rendering. Changes don't trigger re-renders reliably. |
| **Framer Motion on every component** | Multiple | Many components use `motion.div` for simple hover/focus effects. CSS transitions would be lighter. |
| **No image optimization** | Multiple pages | Product images, user avatars loaded without lazy loading, srcset, or WebP. |
| **N+1 risk in Patient queries** | Backend | Patient has 7 outbound relations. Listing patients with includes = potential 700 queries for 100 patients. |
| **No request deduplication** | `src/utils/api.ts` | Multiple components can trigger the same API call simultaneously. React Query handles this for queries but not for the useData hook. |
| **constants.ts (568L) imported everywhere** | `src/utils/constants.ts` | Entire file imported even when only one function is needed. Tree-shaking helps but the file is still large. |

---

## CRITICAL BUGS FOUND

| Bug | Location | Impact |
|---|---|---|
| `deleteWaitingListItem` calls `tryDelete('patients', id)` | `src/hooks/useData.ts:388` | Deletes a patient instead of a waiting list item |
| `usePatient(id)` calls `apiClient.getClinic(id)` | `src/queries/patient.query.ts:16` | Returns clinic data instead of patient data |
| Document signing has no auth | `server/routes/medical.js` PUT /:id/sign | Anyone can sign legal documents |
| Shop product PATCH has no RBAC | `server/index.js` bridge route | Any authenticated user can modify products |
| Audit bridge route has no RBAC | `server/index.js` bridge route | Any authenticated user can read all audit logs |
