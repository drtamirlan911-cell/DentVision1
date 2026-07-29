# DentVision1 — Аудит соответствия Blueprint

**Дата:** 2026-07-17  
**Репозиторий:** `drtamirlan911-cell/DentVision1`  
**Аудитор:** Devin  
**Основание:** `BLUEPRINT.md` / `UX_BLUEPRINT.md` пользователя

---

## 1. Общий вывод

Проект не является AI-first платформой в понимании Blueprint. Это **CRM-first SuperApp с AI-чатом**, прикрученным к существующим экранам. Большинство backend-механизмов (аутентификация, multi-tenancy, маршрутизация, WebSocket) работают на базовом уровне, но AI-слой остаётся правилом на регулярках, а продуктовая структура интерфейса по-прежнему ведёт пользователя в CRM (`/crm/*`, боковое меню с пунктом "CRM", Dashboard с метриками клиники).

**Ключевые цифры:**
- `npm run build` — успешно (3.54s), bundle ~224 kB / 61 kB gzip.
- `npm run test` — 36/36 тестов проходят.
- `npm run typecheck` — **374 ошибки TypeScript**.
- `npm run lint` — **630 замечаний, 1 error** (`src/components/ai/ProactiveAlertsDisplay.tsx` — условный вызов хука).
- Активный backend: `server/` (JS, Express, Prisma, PostgreSQL).
- Новый backend `dentvision-backend/` (TS) — **не интегрирован и не развёрнут**, содержит только auth, RBAC, AI-заготовки и файловый upload-заглушку.

---

## 2. Compliance Matrix — Blueprint vs код

| # | Требование Blueprint | Статус | Что реализовано / что не так |
|---|----------------------|--------|------------------------------|
| 1 | **DentVision — AI-экосистема, CRM — сервис** | 🔴 Не соответствует | Главная точка входа `/` ведёт в `AIWorkspaceIndex`, но он **chat-centric**. После выбора организации пользователь бросается в `/crm/schedule`. В боковом меню (`src/layouts/Sidebar.tsx`) присутствует пункт **"CRM"** и 11 CRM-подразделов. Marketplace = `/shop`, Academy = `/school`, Jobs/Community = заглушки. |
| 2 | **Платформенные слои: Intelligence / Core / Services / DB** | 🟡 Частично | Intelligence: `server/ai/` имеет Intent Engine, Command Bus, Knowledge Orchestrator, Memory, Proactive Alerts, но **без LLM**, planning, reasoning, streaming, context graph. Core: Identity, Organizations, Membership, Roles, Notifications, Audit — реализованы. **Search отсутствует** как сервис. Events: WebSocket есть, но нет центральной шины с подписчиками. |
| 3 | **Information Architecture** | 🟡 Частично | Есть `/`, `/my-clinics`, `/profile`, `/shop`, `/school`, `/jobs`, `/community`, `/settings`. Нет маршрутов `/marketplace`, `/academy` (используются `/shop`, `/school`). **"Workspace"** как top-level раздел отсутствует — вместо него CRM. |
| 4 | **User Journey (Splash → AI Greeting → Service Cards → Animation → AI Workspace)** | 🔴 Не реализован | Экран Splash отсутствует. `WelcomeAnimation` и `AIServiceCards` есть в коде, но **нигде не импортированы** и не используются. Второй запуск не отличается от первого. |
| 5 | **AI Workspace (AI в центре, Smart Command Bar, Context Panel)** | 🟡 Частично | AI-чат занимает центр, но это всё ещё **чат, не command workspace**. `CommandPalette` (`src/components/CommandPalette.tsx`) работает как навигационный поиск разделов, а не как единый интеллектуальный ввод. Context Panel существует (`src/components/intelligence/ContextPanel.tsx`), 3 вкладки. |
| 6 | **Workspace Flow** | 🟡 Частично | `/my-clinics` → выбор организации → `/crm/schedule`. Создание клиники не обязательно — работает. Но после выбора org пользователь попадает в CRM, а не в абстрактный **Workspace**. |
| 7 | **Registration Flow** | 🟢 В основном | Регистрация (`/login` → Register) → `/my-clinics` (персональный профиль). AI Onboarding, Marketplace/Academy/Community как шаги onboarding — отсутствуют. |
| 8 | **Organization Flow (Create / Join / Demo)** | 🟡 Частично | `/my-clinics` имеет вкладки list/create/join/demo. Demo показывает `toast` "скоро будет доступен" — заглушка. |
| 9 | **Multi-Organization** | 🟢 Да | `Membership` + `clinic` в схеме. `switchClinic` реализован. `MyClinics` список организаций. |
| 10 | **AI Request Flow (Intent → Context → Permission → Knowledge → Planner → Bus → Registry → Service → DB → Response)** | 🟡 Частично | Intent и Context реализованы regex. Permission check есть в `commandBus.js`. **Command Planner отсутствует** — действия жёстко привязаны к намерениям. Knowledge Router статический. **LLM отсутствует**. |
| 11 | **Knowledge Flow (DentVision Data → Academy → Marketplace → Research → Internet → Merge)** | 🟡 Частично | `knowledge/orchestrator.js` объединяет DB, Knowledge Base, School, Shop. **Research/Internet нет**, Merge — просто приоритизация массива. |
| 12 | **Marketplace Logic (консультация → исследование → рекомендация → товар → покупка)** | 🔴 Нет | `/shop` — классический каталог товаров с фильтрами. Нет AI-консультации перед предложением товара. `createShopReview` — заглушка. |
| 13 | **Academy Logic (Determine Skill → Find Courses → Articles → Learning Path → Progress)** | 🔴 Нет | `/school` — каталог курсов. Нет определения skill, learning path, progress, clinical cases/library. |
| 14 | **Context Engine (User, Org, Patient, Screen, Memory, Role, Permissions)** | 🟡 Частично | Контекст передаётся в `/api/ai/chat` и `processMessage`. Context Panel показывает user/org, но **Current Patient / Current Screen / Conversation Memory** не централизованы. |
| 15 | **Command Execution ("Запиши пациента" → Form → Fill → Confirm → Save → Notify → Analytics)** | 🟡 Частично | 30 actions в `server/ai/actions.js`, но UI подтверждения действий реализован слабо. Формы открываются через навигацию, AI не заполняет поля. |
| 16 | **Event Bus** | 🟡 Частично | `server/ws.js` + `SocketProvider` обрабатывают 9 событий и инвалидируют React Query. Нет центрального **Event Bus** с подписчиками всех сервисов. |
| 17 | **Permission Model (Platform → User → Membership → Org → Role → Permissions)** | 🟡 Частично | Роль живёт на `Membership` (`server/routes/auth.js`, Prisma). `requirePermission` и `requireSuperadmin` есть. `requireSameClinic` **пропускает запросы без `clinic_id`** — tenant isolation bypass. |
| 18 | **AI Memory (Conversation, Patient, Org, Personal, Learning, Shopping)** | 🔴 Нет | Только `memory/conversation.js` in-memory с TTL 30 мин. **Persistent memory** отсутствует. |
| 19 | **Search (единый поиск)** | 🔴 Отсутствует | Command Palette — навигация по разделам, не поиск по пациентам/товарам/курсам/документам. |
| 20 | **Mobile Blueprint (AI почти на весь экран, Bottom Nav)** | 🟡 Частично | BottomNav, safe-area inset, мобильный sidebar-оверлей есть. AI не занимает почти весь экран — центральный чат сжат между sidebar и context panel. |
| 21 | **Design System (единая библиотека, Lucide, Framer Motion, SVG, light/dark, responsive)** | 🟡 Частично | 22 компонента в `src/components/ui/ds/`, Lucide, Framer Motion. **Только тёмная тема**: `index.html` `<html class="dark">`, `global.css` `color-scheme: dark`, переключателя светлой темы нет. |
| 22 | **Product Principles** | 🟡/🔴 | AI First, Platform-not-CRM, Action Driven, Transparent Recommendations — **не выполнены**. User First, Workspace Based, Modular, Event Driven — частично. |

---

## 3. Критические проблемы (блокеры)

### 3.1 TypeScript и качество кода
- **`npm run typecheck` показывает 374 ошибки.** Приложение собирается Vite (он не проводит typecheck), но runtime-типы не защищены.
- **`npm run lint` — 1 error**, `630 warnings`. Error: `React Hook "useAIExecutor" is called conditionally` в `src/components/ai/ProactiveAlertsDisplay.tsx:49` (ранний `return null` до хука). Это ломает правила React.
- **Файлы-гиганты:** `Documents.tsx` 880 строк, `Patients.tsx` 694, `Cashier.tsx` 688, `api.ts` 600, `Staff.tsx` 600, `Odontogram3D.tsx` 573. Нарушает модульность и масштабируемость.

### 3.2 Безопасность
- **Подпись документов без авторизации:** `server/routes/medical.js:173` `router.put('/documents/:id/sign', ...)` не использует `authenticate`. Внутренняя ветка `if (!req.user)` никогда не сработает, т.к. `req.user` не устанавливается.
- **Cross-tenant leak в medical visits:** `server/routes/medical.js:68-84` GET `/api/medical/visits` проверяет `clinic_id` только если он передан в query. При запросе по `patient_id` без `clinic_id` tenant-изоляция не срабатывает.
- **`requireSameClinic` fail-open:** `server/middleware/rbac.js:96` `if (!clinicId) return next();` — любой маршрут без `clinicId` автоматически проходит.
- **Токены сброса пароля:** `server/routes/auth.js:251` `Math.random().toString(36) + Date.now()` — предсказуемо. Нужно `crypto.randomBytes`.
- **Хранение секретов в коде:** `dentvision-saas.jsx` содержит `SUPABASE_URL`, `SUPABASE_KEY` (anon key) и логику SUPER_ADMIN без поля `password`. Файл отслеживается Git, не используется основным приложением, но остаётся утечкой.
- **Bcrypt 10 rounds** — рекомендуется 12+.
- **Нет server-side logout / refresh token rotation / blacklist.**

### 3.3 База данных
- **Все `@id` имеют `@default("")`** в `prisma/schema.prisma` (36 моделей, 45 полей). Если backend код не передаст `id`, запись получит пустую строку, что ломает уникальность иforeign keys.
- **Нет soft deletes** (`deletedAt`) на клинических/финансовых сущностях.
- **Два divergent backend-а:** `server/` использует `prisma/schema.prisma` (878 строк, 36 моделей), `dentvision-backend/` использует свой `dentvision-backend/prisma/schema.prisma` (555 строк, enums, другая модель). Это приведёт к рассинхронизации.

### 3.4 AI / Продукт
- **AI не first-class.** Это regex-чат с 30 захардкоженными действиями. Нет LLM, planning, streaming, multi-modal, persistent memory, context graph.
- **CRM доминирует.** Маршруты, навигация, dashboard, analytics — всё вокруг клиники, а не вокруг AI-помощника.
- **Onboarding-поток отсутствует.** Splash, Service Orbit, Welcome Animation — мёртвый код.
- **Marketplace / Academy / Jobs / Community не работают как полноценные сервисы.** Jobs и Community используют MOCK-данные. Academy без learning path. Marketplace без консультативного AI-флоу.

---

## 4. Функциональные пробелы

| Модуль | Статус | Комментарий |
|--------|--------|-------------|
| **Analytics** | 🔴 Заглушка | `src/pages/Analytics.tsx` — 89 строк, считает доход из receipts, график `Math.random()`. |
| **Jobs** | 🔴 MOCK | `src/pages/Jobs.tsx` — `MOCK_VACANCIES`. Backend — нет модели. |
| **Community** | 🔴 MOCK | `src/pages/Community.tsx` — `MOCK_POSTS`. Backend — нет модели. |
| **Academy (School)** | 🟡 Частично | Курсы и enrollments есть, но нет clinical cases, library, certificates, learning path. |
| **Marketplace (Shop)** | 🟡 Частично | Каталог, корзина, заказы, избранное — работают, но без AI-консультации и реальных рекомендаций. |
| **Laboratory** | 🟡 Внутри CRM | Только `src/pages/crm/Lab.tsx`, нет отдельного сервиса. |
| **Finance** | 🟡 Внутри CRM | Только `src/pages/crm/Cashier.tsx`, нет отдельного сервиса. |
| **Unified Search** | 🔴 Отсутствует | Только per-page фильтры. |
| **Notifications** | 🟡 Частично | CRUD есть, но toast-интеграция с WS-событиями слабая. |
| **File Storage** | 🔴 Заглушка | `dentvision-backend/src/modules/files` — Multer пишет в `/mock-storage`, не на диск/S3. |

---

## 5. Архитектурный и технический долг

1. **`src/utils/api.ts` (600 строк)** — ~15 функций-заглушек возвращают `Promise.resolve([])` (lab orders, expenses, promotions, bookings, documents, treatments, waiting list, school clinical cases/library/certificates, service access, profile, shop review).
2. **`src/queries/useDataQuery.ts` (354 строки)** — монолитный хук, загружает 17 сущностей разом. Хотя использует React Query, структура осталась "god hook".
3. **`src/types.ts` (411 строк)** — `User` не содержит `platformRole`/`memberships`/`activeMembership`, что вызывает десятки TS-ошибок в `auth.store.ts`, `aiExecutor.ts`, страницах.
4. **Два API backend-а:** `server/` (работает) vs `dentvision-backend/` (черновик). Нужно либо удалить второй, либо заморозить `server/` и довести TS-версию.
5. **Design System:** компоненты есть, но `Input.tsx` 323 строки, тема только тёмная, нет design tokens как отдельного конфига.
6. **Mobile:** BottomNav с 5 табами (`Workspace`, `Shop`, `AI`, `School`, `Analytics`) — частично соответствует Blueprint, но AI не на весь экран.

---

## 6. Что работает

- **Аутентификация и multi-tenancy:** регистрация, логин, refresh, switch-clinic, memberships, `/my-clinics`.
- **RBAC:** 11 org-ролей, permission matrix, superadmin.
- **CRM CRUD:** 14 ресурсов через generic router `server/routes/crm.js`.
- **WebSocket:** JWT-аутентификация, clinic-scoped broadcast, 9 событий в `SocketProvider` с инвалидацией кэша.
- **React Query интеграция:** prefetch на наведение в sidebar, optimistic updates для patient/appointment/receipt/document.
- **Design System:** 22 компонента, Lucide, Framer Motion, Tailwind, responsive breakpoints.
- **Build & tests:** production build проходит, 36 unit-тестов зелёные.

---

## 7. Рекомендации (приоритеты)

### P0 — критично, мешает использованию
1. Исправить 374 TS-ошибки и lint error в `ProactiveAlertsDisplay.tsx`.
2. Починить `requireSameClinic` — fail-closed, explicit bypass.
3. Добавить `authenticate` на `PUT /api/medical/documents/:id/sign`.
4. Удалить или заархивировать `dentvision-saas.jsx` с хардкодом.
5. Заменить `@default("")` на `@default(uuid())` во всех Prisma-моделях.
6. Добавить soft deletes (`deletedAt`) на Patient, Appointment, Invoice, Order, Visit, TreatmentPlan, User.
7. Заменить `Math.random()` в сбросе пароля на `crypto.randomBytes`.
8. Добавить server-side logout / refresh token rotation.

### P1 — продуктовый разрыв с Blueprint
9. Внедрить LLM-хук (OpenAI/Claude) в `server/ai/` — сделать AI действительно first-class.
10. Переименовать маршруты/навигацию: `/crm/*` → `/workspace/*`, `/shop` → `/marketplace`, `/school` → `/academy`.
11. Реализовать Splash + AI Greeting + Service Cards + Welcome Animation как первый запуск.
12. Сделать настоящий **Command Workspace**: AI понимает "Запиши пациента", открывает форму, заполняет поля, просит подтверждение.
13. Построить настоящую Analytics (графики, реальные метрики, не random).
14. Реализовать backend для Jobs и Community (модели, API, CRUD).
15. Добавить Academy learning path, clinical cases, library.
16. Сделать Marketplace consult-first flow с AI-рекомендациями.

### P2 — масштабируемость и качество
17. Разбить файлы >300 строк (Documents, Patients, Cashier, api.ts, Staff, Odontogram3D).
18. Вынести `useDataQuery` в доменные хуки.
19. Внедрить единый unified search.
20. Добавить светлую тему и тематический переключатель.
21. Создать центральный Event Bus (Redis / in-memory pub-sub) для cross-service events.
22. Перевести AI Memory в persistent storage (Prisma / Redis).
23. Решить, какой backend оставить: довести `dentvision-backend` до полноты и мигрировать, либо удалить его.

### P3 — будущее
24. Planning engine, reasoning layer, streaming SSE, multi-modal (рентген), RAG, voice.

---

## 8. Заключение

Репозиторий находится в состоянии **"работающего CRM с AI-чатом"**, но не соответствует Blueprint **"AI-first dental platform"**. Базовая инфраструктура (auth, multi-tenancy, WebSocket, React Query, design system) уже на месте, однако ключевые продуктовые элементы Blueprint либо отсутствуют (Splash, Service Orbit, unified search, persistent AI memory, LLM), либо реализованы как заглушки (Analytics, Jobs, Community, Academy learning path). Критические баги безопасности и 374 TypeScript-ошибки делают код неготовым к масштабированию и production-нагрузке.

Первым шагом рекомендуется закрыть P0 (безопасность + TS + database defaults), а затем переключиться на P1 — реальный AI-first user experience.
