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

## PHASE 5: REACT QUERY MIGRATION (Week 5-6)

### 5.1 Migrate useData to React Query
- [ ] Replace useData for patients → usePatients query
- [ ] Replace useData for appointments → useAppointments query
- [ ] Replace useData for receipts → useReceipts query
- [ ] Replace useData for inventory → useInventory query
- [ ] Replace useData for lab orders → useLabOrders query
- [ ] Replace useData for documents → useDocuments query

### 5.2 Add Optimistic Updates
- [ ] Patient CRUD mutations
- [ ] Appointment CRUD mutations
- [ ] Receipt mutations
- [ ] Document mutations

### 5.3 Add Prefetching
- [ ] Prefetch patient list on CRM nav hover
- [ ] Prefetch schedule on calendar nav hover
- [ ] Prefetch shop products on shop nav hover

---

## PHASE 6: WEBSOCKET INTEGRATION (Week 7)

### 6.1 Server
- [ ] Add socket.io to server/index.js
- [ ] Emit events on CRM mutations (patient.created, appointment.updated, etc.)
- [ ] Emit events on shop mutations (order.created, product.updated, etc.)
- [ ] Emit events on notification creation

### 6.2 Client
- [ ] Add handlers for remaining 7 WebSocket events in SocketProvider
- [ ] Invalidate React Query cache on relevant events
- [ ] Show real-time toast notifications for important events

---

## PHASE 7: AI WORKSPACE EVOLUTION (Week 8-9)

### 7.1 Command Workspace
- [ ] Transform AIWorkspaceIndex from chat to command palette
- [ ] Add quick actions (⌘K style)
- [ ] Add context-aware suggestions
- [ ] Integrate with CRM actions (create appointment, search patient)

### 7.2 AI Backend
- [ ] Deploy new AI backend alongside legacy
- [ ] Add LLM integration (OpenAI/Claude)
- [ ] Implement tool/function calling loop
- [ ] Add streaming support (SSE)

---

## PHASE 8: MOBILE RESPONSIVENESS (Week 10)

- [ ] Add responsive breakpoints to all pages
- [ ] Implement bottom navigation for mobile
- [ ] Add touch gestures to swipeable components
- [ ] Handle safe area insets
- [ ] Test on iOS Safari and Android Chrome

---

## PHASE 9: CODE QUALITY (Week 11)

- [ ] Fix ESLint to cover TS/TSX files
- [ ] Add Prettier configuration
- [ ] Enable `noUnusedLocals: true` in tsconfig
- [ ] Add pre-commit hooks (husky + lint-staged)
- [ ] Remove Prisma from frontend dependencies
- [ ] Add error boundaries around routes

---

## PHASE 10: PERFORMANCE (Week 12)

- [ ] Add route-level code splitting per service
- [ ] Add virtualization for large lists
- [ ] Replace Framer Motion with CSS where possible
- [ ] Add React.memo to list item components
- [ ] Configure Neon connection pooling
- [ ] Add Web Vitals monitoring

---

## PHASE 11: TESTING (Week 13)

- [ ] Add Vitest configuration
- [ ] Write unit tests for AI intent engine
- [ ] Write unit tests for RBAC middleware
- [ ] Write integration tests for auth flow
- [ ] Write component tests for DS components

---

## PHASE 12: DOCUMENTATION (Week 14)

- [ ] Update README.md
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add component storybook for DS
- [ ] Add deployment guide
- [ ] Add contributing guide

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
