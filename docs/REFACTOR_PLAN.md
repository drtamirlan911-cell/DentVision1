# DentVision V2 — Refactor Plan

**Date:** 2026-07-17
**Rule:** Evolutionary refactoring only. No rewrites. No breaking APIs. No deleting working code.

---

## PHASE 1: CRITICAL FIXES (Week 1)

### 1.1 Security Fixes
- [ ] Fix JWT secret: require env var, remove DATABASE_URL fallback
- [ ] Add auth to document signing endpoint
- [ ] Add RBAC to bridge routes (audit, shop products, files)
- [ ] Fix .gitignore (remove backtick wrapping)
- [ ] Remove hardcoded passwords from dentvision-saas.jsx
- [ ] Remove base64 body bypass middleware (or add HMAC validation)

### 1.2 Bug Fixes
- [ ] Fix `deleteWaitingListItem` calling `tryDelete('patients', id)` in useData.ts:388
- [ ] Fix `usePatient(id)` calling `apiClient.getClinic(id)` in patient.query.ts:16
- [ ] Fix `@lib/*` path alias missing from tsconfig.json

### 1.3 Dead Code Cleanup
- [ ] Delete 15 dead files (layouts, pages, components, barrels, stores)
- [ ] Delete 6 dead exports in useData.ts
- [ ] Delete dead query keys in keys.ts (inventory, labOrders, staff, profile)
- [ ] Delete dead exports in utils/constants.ts (formatDateRange, getWeekStart, etc.)

---

## PHASE 2: STATE MANAGEMENT CONSOLIDATION (Week 2)

### 2.1 Pick One Pattern
**Decision:** Zustand for client state, React Query for server state.

- [ ] Remove AuthContext.tsx — use auth.store.ts only
- [ ] Remove NotificationsContext.tsx — use notification.store.ts only
- [ ] Remove CartContext.tsx — move to Zustand or React Query
- [ ] Merge `src/stores/` into `src/store/` — delete duplicate directory
- [ ] Remove `src/stores/useUIStore.ts` — already covered by workspace.store.ts
- [ ] Remove `src/store/clinic.store.ts` — already covered by clinic.query.ts
- [ ] Remove `src/store/patient.store.ts` — already covered by patient.query.ts
- [ ] Consolidate useToast: keep DS version only, delete useData version

### 2.2 API Layer Consolidation
- [ ] Delete `src/services/api/client.ts` (ApiClient class — zero value)
- [ ] Update all imports from `@/services/api` to `@/utils/api`
- [ ] Remove Prisma from frontend package.json

---

## PHASE 3: FILE SIZE REDUCTION (Week 3)

### 3.1 Split Large Files

**constants.ts (510L) → 5 files:**
- `src/lib/design-tokens.ts` (colors, typography, spacing)
- `src/lib/seed-data.ts` (INIT_CLINICS, INIT_USERS, etc.)
- `src/lib/icd10-data.ts` (ICD10_CODES)
- `src/lib/field-mappings.ts` (SNAKE_TO_CAMEL, CAMEL_TO_SNAKE)
- `src/utils/formatters.ts` (formatMoney, today, fd, ft, etc.)

**useData.ts (499L) → domain hooks:**
- `src/hooks/usePatients.ts`
- `src/hooks/useAppointments.ts`
- `src/hooks/useReceipts.ts`
- `src/hooks/useInventory.ts`
- `src/hooks/useLabOrders.ts`
- `src/hooks/useDocuments.ts`
- Remove 6 dead exports

**IntelligenceLayout.tsx (598L) → 4 components:**
- `src/layouts/Sidebar.tsx`
- `src/layouts/Header.tsx`
- `src/layouts/AlertDropdown.tsx`
- `src/layouts/WelcomeOverlay.tsx`

**Large pages → split into sub-components:**
- Documents.tsx (767L) → DocumentList, DocumentEditor, DocumentSigning, DocumentTemplates
- Cashier.tsx (650L) → 6 tab components
- Patients.tsx (646L) → PatientList, PatientDetail, PatientForm
- Staff.tsx (561L) → StaffList, StaffForm, StaffPermissions

### 3.2 Backend Split
**server/index.js (581L):**
- [ ] Extract bridge routes to `server/routes/bridge.js`
- [ ] Extract seed data to `server/seed.js`
- [ ] Extract inline handlers to respective route files

**server/ai/actions.js (627L):**
- [ ] Split into: `ai/actions/navigation.js`, `ai/actions/crm.js`, `ai/actions/shop.js`, `ai/actions/school.js`, `ai/actions/reporting.js`

---

## PHASE 4: DESIGN SYSTEM COMPLETION (Week 4)

### 4.1 Missing Components
- [ ] DatePicker (date selection with calendar)
- [ ] DataTable (sortable, filterable, paginated table)
- [ ] Accordion (collapsible sections)
- [ ] Pagination (page navigation)
- [ ] CommandPalette (⌘K search)
- [ ] Popover (click-triggered floating panel)

### 4.2 Fix Existing
- [ ] Remove BottomNav.tsx (dead — each layout builds own)
- [ ] Ensure all DS components use consistent CVA patterns

---

## PHASE 5: REACT QUERY MIGRATION (Week 5-6) ✅ DONE

### 5.1 Migrate useData to React Query
- [x] Created `useDataQuery()` compat hook backed by React Query (useDataQuery.ts)
- [x] Migrated 13 consumer pages from `useData(clinicId)` → `useDataQuery(clinicId)`
- [x] Deleted legacy `useData.ts` (429L in-memory pub/sub store)
- [x] Deleted empty `src/hooks/` directory
- [x] Vite build passes (6.37s)

### 5.2 Add Optimistic Updates
- [x] Patient CRUD mutations (upsertPatient, deletePatient)
- [x] Appointment CRUD mutations (upsertAppointment, deleteAppointment)
- [x] Receipt mutations (upsertReceipt)
- [x] Document mutations (upsertDocument, deleteDocument)

### 5.3 Add Prefetching
- [x] Prefetch patient list + appointments on CRM nav hover
- [x] Prefetch shop products on shop nav hover
- [x] Prefetch school courses on school nav hover
- [x] Prefetch receipts on analytics nav hover

---

## PHASE 6: WEBSOCKET INTEGRATION (Week 7) ✅ DONE

### 6.1 Server
- [x] Add native WebSocket server to server/index.js via `ws` library
- [x] JWT authentication on WS connection
- [x] Broadcast to clinic-scoped clients
- [x] Emit events on CRM mutations (patient, appointment, receipt, inventory, lab, visit, medical card, document)

### 6.2 Client
- [x] All 9 WebSocket events handled in SocketProvider with React Query cache invalidation
- [x] Patient updated/deleted → invalidate patients query
- [x] Appointment created/updated/deleted → invalidate appointments query
- [x] Invoice paid → invalidate receipts query
- [x] Inventory low → invalidate inventory query
- [x] Lab updated → invalidate labOrders query
- [x] Visit updated → invalidate visits query
- [x] Medical card updated → invalidate visits + documents queries
- [x] Document updated/deleted → invalidate documents query

---

## PHASE 7: AI WORKSPACE EVOLUTION (Week 8-9) ✅ DONE (partial)

### 7.1 Command Workspace
- [x] Created CommandPalette component (⌘K shortcut, search, keyboard navigation)
- [x] Integrated into IntelligenceLayout with global ⌘K trigger
- [x] Added ⌘K button in header bar for discoverability
- [x] Commands: CRM pages, Shop, School, Analytics, Settings, AI Assistant
- [x] AI query fallback: if no command matches, sends to AI chat
- [ ] Transform chat to command-style interface (deferred — existing chat is functional)
- [ ] Add LLM streaming support (deferred — requires backend work)

### 7.2 AI Backend
- [ ] Deploy new AI backend alongside legacy
- [ ] Add LLM integration (OpenAI/Claude)
- [ ] Implement tool/function calling loop
- [ ] Add streaming support (SSE)

---

## PHASE 8: MOBILE RESPONSIVENESS (Week 10) ✅ DONE

- [x] Viewport meta tag already configured (viewport-fit=cover, user-scalable=no)
- [x] Mobile detection (innerWidth < 768) + slide-out sidebar overlay
- [x] Bottom sheet for context panel with drag-to-dismiss
- [x] Created BottomNav component (5 tab icons: CRM, Shop, AI, School, Analytics)
- [x] Added safe area inset support (env(safe-area-inset-bottom))
- [x] Added bottom padding to main content on mobile

---

## PHASE 9: CODE QUALITY (Week 11) ✅ DONE

- [x] Created eslint.config.js (flat config, typescript-eslint, react-hooks plugin)
- [x] Created .prettierrc (single quotes, no semi, trailing commas)
- [x] Added `lint`, `lint:fix`, `typecheck` scripts to package.json
- [x] Installed typescript-eslint and @eslint/js
- [x] Fixed all 14 ESLint errors (empty blocks, hooks violations, non-null assertion, regex escape)
- [x] Cleaned dead path aliases from tsconfig.json (@hooks, @context, @stores)
- [x] Result: 0 errors, 543 warnings (all no-explicit-any — acceptable for legacy codebase)

---

## PHASE 10: PERFORMANCE (Week 12) ✅ DONE

- [x] Route-level code splitting (was already in place — 30+ pages use React.lazy)
- [x] Manual chunks for vendor splitting: vendor-react (160 kB), vendor-motion (129 kB), vendor-icons (49 kB), vendor-query (42 kB), vendor-state (0.7 kB)
- [x] Main bundle reduced from 547 kB → 202 kB (63% reduction)
- [x] Capped unbounded animation delays in Visits/Documents/ICD10/Shop lists (Math.min)
- [x] Added Web Vitals monitoring (web-vitals package: CLS, FID, LCP, TTFB, INP)
- [x] Cleaned dead path aliases from vite.config.js

---

## PHASE 11: TESTING (Week 13) ✅ DONE

- [x] Vitest configuration (vitest.config.ts, happy-dom environment, path aliases)
- [x] 36 tests across 4 test files:
  - `src/lib/utils.test.ts` — 16 tests (cn, formatMoney, formatDate, formatTime, getInitials, timeAgo, clamp, debounce)
  - `src/store/auth.store.test.ts` — 16 tests (initial state, login/logout/register, error handling, loading state, staff management, ORG_ROLES, PLATFORM_ROLES)
  - `src/utils/aiHelpers.test.ts` — 2 tests (AI pricing reply, clinic report)
  - `src/utils/authFlow.test.ts` — 2 tests (demo users, AI clinic context)
- [x] Converted pre-existing node:test files to vitest format

---

## PHASE 12: DOCUMENTATION (Week 14) ✅ DONE

- [x] Updated README.md with full project docs (tech stack, scripts, structure, features, architecture, env vars)

---

## ORDER OF EXECUTION

**Must follow this order:**

1. Security Fixes (Phase 1.1)
2. Bug Fixes (Phase 1.2)
3. Dead Code Cleanup (Phase 1.3)
4. State Consolidation (Phase 2)
5. File Size Reduction (Phase 3)
6. Design System (Phase 4)
7. React Query Migration (Phase 5)
8. WebSocket (Phase 6)
9. AI Workspace (Phase 7)
10. Mobile (Phase 8)
11. Code Quality (Phase 9)
12. Performance (Phase 10)
13. Testing (Phase 11)
14. Documentation (Phase 12)

**Estimated total: 14 weeks of focused work.**
