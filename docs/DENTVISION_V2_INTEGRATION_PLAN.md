# DentVision Platform V2 — План интеграции

## Chapters: Ecosystem Marketplace & Education Governance · Finance & Payment Architecture · Identity & Access Management (IAM)

**Version:** 1.0
**Status:** Mandatory Architecture Component
**Область:** превращение DentVision из CRM в **Dental Super App = CRM + Marketplace + Education + Finance + AI Governance + Professional Network**

Документ описывает, **как именно** внедрить три обязательные главы Blueprint в текущую кодовую базу (`dentvision-backend` на TypeScript/Express/Prisma + фронтенд React/Vite/Zustand). План привязан к реальным файлам и моделям, содержит целевую схему данных, порядок работ по фазам и стратегию миграции без ломки существующего функционала.

> Ключевой принцип последовательности (из запроса): **IAM внедряется первым**, до расширения backend, потому что все домены (Shop, School, Finance) опираются на роли, контексты и права доступа.

---

## 0. TL;DR — порядок внедрения

| Фаза | Блок | Зависит от | Результат |
|------|------|-----------|-----------|
| **0** | Подготовка: Event Bus, слой `Money`, feature-flags, расширение аудита | — | инфраструктура для остальных фаз |
| **1** | **IAM Core** (Principal + scoped Membership + Permissions) | Фаза 0 | единая система ролей и прав для всех доменов |
| **2** | **Shop Governance** (Supplier, верификация, карточка товара, рейтинги) | IAM | кабинет поставщика |
| **3** | **School Governance** (Lecturer, Academy, авторство курсов, верификация) | IAM | кабинеты лектора и академии |
| **4** | **Finance Core** (Wallet, Ledger, Transaction, комиссии) | IAM, Shop, School | внутренние кошельки и учёт |
| **5** | **Payments** (Payment Gateway, Kaspi QR, Subscriptions, Payouts, Disputes) | Finance Core | реальные платежи и выплаты |
| **6** | **AI Governance** (Supplier/Course/Finance/Quality/Compliance агенты) | все домены | ИИ-агенты и контроль качества |
| **7** | **Compliance РК** + Ecosystem Analytics | все домены | соответствие законодательству и дашборд экосистемы |

Каждая фаза — самостоятельно поставляемый инкремент (расширение Prisma-схемы аддитивное, старые API не ломаются).

---

## 1. Текущее состояние кодовой базы (baseline)

### 1.1 Данные (`dentvision-backend/prisma/schema.prisma`)
- `User` — плоское поле `role: UserRole` (enum `OWNER … SUPERADMIN`). Аккаунт и роль смешаны.
- `Clinic`, `ClinicMember` (тоже несёт `role`), `ClinicInvitation` — модель организаций и членства.
- CRM: `Patient`, `Appointment`, `Visit`, `Tooth`, `TreatmentPlan`, `PatientImage`, `Document`, `LabOrder`, `Invoice`, `InventoryItem`.
- Marketplace: `Product` (есть `supplierId String?`, но **нет модели `Supplier`**), `Order`, `Favorite`.
- School: `Course` (есть `author String?` как строка, **нет модели `Lecturer`/`Academy`**), `Lesson`, `SchoolEnrollment`.
- AI: `AISession`, `AIAction`, `AIAlert`, `AIMessage`, `AIMemory`.
- Прочее: `Notification`, `AuditLog`, `ICD10Code`.

### 1.2 IAM сегодня
- `src/middleware/auth.ts` — `authenticate` / `optionalAuth`; JWT несёт `sub`, `email`, `role`, **один** `clinicId`, `isGuest`.
- `src/middleware/rbac.ts` — плоская иерархия `ROLE_HIERARCHY` (SUPERADMIN=5 … STUDENT=1), функции `requireRole`, `requireMinRole`, `requireSuperadmin`.
- Фронтенд `src/store/auth.store.ts` — уже содержит развёрнутые `ORG_ROLES` и `PLATFORM_ROLES` с массивами `pages` и флагами прав (это будущий словарь прав, который нужно перенести на backend как источник истины).

### 1.3 Ключевые расхождения с Blueprint
1. **Роль на `User`, а не на членстве** — противоречит принципу Blueprint §17 «Роль принадлежит Membership, а не User».
2. **Один контекст доступа (clinicId)** — нет поддержки контекстов Supplier / Academy / Platform.
3. **Права зашиты в код фронтенда** — нет серверного, проверяемого словаря permissions.
4. Нет доменов Supplier / Lecturer / Academy, финансов, платежей, рейтингов, верификации, compliance.

Эти четыре пункта — обоснование того, почему **IAM идёт первым**.

---

## 2. Gap-анализ по главам

### 2.1 Ecosystem (Shop + School Governance)
| Требование Blueprint | Есть сейчас | Нужно добавить |
|---|---|---|
| Роли Supplier/Manufacturer/Distributor/Brand Rep | нет | scope `SUPPLIER` в IAM + модель `Supplier` |
| Supplier Workspace + статусы (Pending→…→Official Partner) | нет | модель `Supplier` + `SupplierVerification` |
| Богатая карточка товара (сертификаты, срок годности, совместимость, страна) | `Product` минимальный | расширение `Product` + `ProductCertificate` |
| Роли Lecturer/Course Author/Academy Owner/Admin/Student | частично (`STUDENT`) | scope `ACADEMY` + модели `Lecturer`, `Academy` |
| Верификация экспертов (New→…→International Speaker) | нет | `ExpertVerification` |
| Рейтинги Supplier/Lecturer | `Product.rating` (число) | модели `Review`, агрегаты рейтинга |
| AI Supplier/Course/Quality агенты | нет | новые агенты в `modules/ai` |

### 2.2 Finance & Payment
| Требование | Есть сейчас | Нужно добавить |
|---|---|---|
| Кошельки (Clinic/Supplier/Lecturer/Partner) | нет | `Wallet`, `WalletEntry` |
| Двойная запись/учёт | нет | `LedgerAccount`, `LedgerEntry`, `Transaction` |
| Подписки (Free/Starter/Pro/Enterprise) | `ClinicPlan` enum | `Subscription`, `Plan`, биллинг-цикл |
| Платёжный шлюз + Kaspi QR | нет | `PaymentProvider` абстракция + `Payment` |
| Комиссионная модель (5–15%, 70/30, 50/30/20) | нет | `CommissionRule` + движок распределения |
| Выплаты/вывод | нет | `Payout` |
| Возвраты/споры | `InvoiceStatus.REFUND` (только флаг) | `Dispute`, `Refund` |
| AI Finance / Anti-fraud | нет | агенты + `FraudSignal` |

### 2.3 IAM
| Требование | Есть сейчас | Нужно добавить |
|---|---|---|
| Роль на membership, а не на user | роль на обоих | нормализация: роль только на членстве |
| Мульти-контекст (clinic/supplier/academy/platform) | только clinic | `Membership.scopeType` + `scopeId` |
| Гранулярные права | иерархия чисел | `Permission` + `RolePermission` + `requirePermission` |
| Переключение активного контекста | switch-clinic | обобщённый `switch-context` |
| Платформенные роли (Compliance/Finance/Moderator/AI Governance) | только SUPERADMIN | платформенные роли в scope `PLATFORM` |

---

## 3. Целевая архитектура интеграции

```text
                         DentVision AI Core
                               │
          ┌──────────┬─────────┼──────────┬───────────┐
         CRM        SHOP      SCHOOL     FINANCE    COMMUNITY
          │          │          │           │
       Clinics   Suppliers   Lecturers   Payments
          │          │          │           │
       Patients   Products    Courses     Wallets
          │          │          │           │
          └──────────┴────┬─────┴───────────┘
                          │
                    IAM (scoped RBAC)   ← фундамент, единый для всех доменов
                          │
                  Event Bus + Audit
                          │
                 Compliance AI Layer (РК)
```

**Инварианты интеграции:**
1. Любой домен обращается к правам только через IAM (`requirePermission`), а не через локальные проверки роли.
2. Любая денежная операция проходит через Finance Core (двойная запись), домены не двигают деньги напрямую.
3. Любое значимое действие публикует событие в Event Bus (основа для нотификаций, аналитики, аудита, AI, compliance) — реализует принцип Blueprint §16.
4. Схема Prisma расширяется **аддитивно**; существующие поля (`User.role`, `Product.supplierId`, `Course.author`) сохраняются на переходный период и удаляются только после миграции данных.

---

## 4. Chapter A — IAM (фундамент, Фаза 1)

### 4.1 Целевая модель ролей и контекстов

Разделяем три сущности: **Principal (аккаунт)** → **Membership (членство в контексте с ролью)** → **Permissions (права роли)**.

**Контексты (scopes):**
- `PLATFORM` — вся платформа (Super Admin, Compliance Manager, Finance Manager, Content Moderator, AI Governance).
- `CLINIC` — организация-клиника (Owner, Director, Doctor, Assistant, Administrator, Cashier, Lab, Manager).
- `SUPPLIER` — компания-поставщик (Owner, Manager, Warehouse Manager, Brand Representative).
- `ACADEMY` — учебная организация (Academy Owner, Academy Admin, Lecturer, Reviewer).
- Индивидуальные роли без организации: `Lecturer` (частный), `Student`, `Supplier`-одиночка — как membership со `scopeType` соответствующего типа и `scopeId = self`.

### 4.2 Prisma (новые/изменённые модели)

```prisma
enum ScopeType { PLATFORM CLINIC SUPPLIER ACADEMY }

model Membership {
  id         String    @id @default(uuid())
  userId     String
  scopeType  ScopeType
  scopeId    String                    // clinicId | supplierId | academyId | "PLATFORM"
  roleKey    String                    // ключ роли: "clinic.owner", "supplier.manager", "platform.compliance"
  status     String    @default("active") // active | suspended | pending
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, scopeType, scopeId, roleKey])
  @@index([scopeType, scopeId])
  @@map("memberships")
}

model Role {
  key         String  @id                // "clinic.owner"
  scopeType   ScopeType
  label       String
  isSystem    Boolean @default(true)
  permissions RolePermission[]
  @@map("roles")
}

model Permission {
  key   String @id                       // "shop.product.create", "finance.payout.approve"
  label String
  domain String                          // crm | shop | school | finance | platform
  roles RolePermission[]
  @@map("permissions")
}

model RolePermission {
  roleKey       String
  permissionKey String
  role       Role       @relation(fields: [roleKey], references: [key], onDelete: Cascade)
  permission Permission @relation(fields: [permissionKey], references: [key], onDelete: Cascade)
  @@id([roleKey, permissionKey])
  @@map("role_permissions")
}
```

`ClinicMember` остаётся как есть на переходный период; на Фазе 1 добавляем `Membership` и синхронизируем существующие связи (см. §4.6). Существующий `ClinicMember` можно позже сделать view/legacy.

### 4.3 JWT и активный контекст

Расширяем payload токена (`src/lib/jwt.ts`) полем активного контекста вместо одиночного `clinicId`:

```jsonc
{
  "sub": "<userId>",
  "email": "...",
  "ctx": { "scopeType": "CLINIC", "scopeId": "<id>", "roleKey": "clinic.owner" },
  "isGuest": false
}
```

Обратная совместимость: если в токене старый `clinicId`, middleware трактует его как `ctx = { CLINIC, clinicId, <role из User> }`.

### 4.4 Middleware (замена `rbac.ts`)

Добавляем **разрешение контекста** и **проверку прав**:

```ts
// resolveContext: заполняет req.membership по req.user + активному ctx из токена
// requirePermission("shop.product.create"): грузит permissions роли из RolePermission
//   (с кэшем в памяти/Redis) и проверяет наличие.
export function requirePermission(...keys: string[]) { /* ... */ }
export function requireScope(scopeType: ScopeType) { /* ... */ }
```

`requireRole`/`requireMinRole`/`requireSuperadmin` остаются как тонкие адаптеры поверх `requirePermission` (для существующих маршрутов), чтобы не переписывать всё сразу.

### 4.5 Новый модуль `modules/iam`
- `POST /api/iam/switch-context` — переключение активного контекста (обобщение текущего `switch-clinic`).
- `GET /api/iam/me/contexts` — список всех членств пользователя (клиники, поставщики, академии, платформа).
- `GET /api/iam/permissions` — эффективные права в активном контексте (фронт использует вместо зашитых `ORG_ROLES`).
- CRUD ролей/прав для `platform.superadmin`.

### 4.6 Стратегия миграции IAM (без простоя)
1. Добавить новые таблицы (`memberships`, `roles`, `permissions`, `role_permissions`) — аддитивно.
2. Сид системных ролей/прав из фронтового словаря `ORG_ROLES`/`PLATFORM_ROLES` (`src/store/auth.store.ts`) → серверный источник истины.
3. Бэкфилл: для каждого `ClinicMember` создать `Membership(scopeType=CLINIC, scopeId=clinicId, roleKey="clinic.<role>")`; для `User.role=SUPERADMIN` — `Membership(PLATFORM, "PLATFORM", "platform.superadmin")`.
4. Включить `requirePermission` на новых маршрутах; постепенно мигрировать старые.
5. После полной миграции — депрекация `User.role` и `ClinicMember.role`.

**Критерий приёмки Фазы 1:** существующие CRM-маршруты работают без изменений поведения; новый пользователь-поставщик может иметь членство SUPPLIER без клиники.

---

## 5. Chapter B — Ecosystem Marketplace & Education Governance

### 5.1 Shop Governance (Фаза 2)

**Модели:**
```prisma
enum SupplierStatus { PENDING DOCUMENTS_REVIEW VERIFIED OFFICIAL_PARTNER SUSPENDED }
enum SupplierKind   { MANUFACTURER DISTRIBUTOR SUPPLIER BRAND_REPRESENTATIVE }

model Supplier {
  id            String         @id @default(uuid())
  name          String
  kind          SupplierKind   @default(SUPPLIER)
  bin           String?        // БИН
  legalAddress  String?
  contactPerson String?
  status        SupplierStatus @default(PENDING)
  walletId      String?        // связь с Finance Core
  createdAt     DateTime       @default(now())
  products      Product[]
  documents     SupplierDocument[]
  @@map("suppliers")
}

model SupplierDocument {
  id         String   @id @default(uuid())
  supplierId String
  type       String   // license | certificate | contract | registration
  url        String
  verified   Boolean  @default(false)
  supplier   Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  @@map("supplier_documents")
}

model ProductCertificate {
  id        String  @id @default(uuid())
  productId String
  name      String
  url       String
  issuedBy  String?
  expiresAt DateTime?
  @@map("product_certificates")
}
```

**Расширение `Product`** (аддитивно): `manufacturer String?`, `country String?`, `expiryDate DateTime?`, `compatibility String?`, `supplierId` → внешний ключ на `Supplier`. Существующий `rating: Float?` заменяется агрегатом из `Review` (см. §5.3).

**API-модуль `modules/suppliers`:** профиль компании, загрузка документов, каталог, цены, остатки, аналитика продаж, обработка заказов. Все маршруты — под `requireScope(SUPPLIER)` + `requirePermission("shop.product.*")`.

**Verification pipeline:** конечный автомат `PENDING → DOCUMENTS_REVIEW → VERIFIED → OFFICIAL_PARTNER`; переходы выполняет `platform.compliance` / `platform.moderator`; каждое изменение — событие + запись в `AuditLog`.

### 5.2 School Governance (Фаза 3)

```prisma
enum ExpertLevel { NEW VERIFIED EXPERT INTERNATIONAL_SPEAKER }

model Lecturer {
  id          String       @id @default(uuid())
  userId      String       @unique
  level       ExpertLevel  @default(NEW)
  bio         String?
  academyId   String?      // null = частный лектор
  createdAt   DateTime     @default(now())
  @@map("lecturers")
}

model Academy {
  id        String   @id @default(uuid())
  name      String
  ownerId   String
  walletId  String?
  createdAt DateTime @default(now())
  @@map("academies")
}

model ExpertVerification {
  id         String   @id @default(uuid())
  lecturerId String
  type       String   // diploma | certificate | experience | publication | clinical_case
  url        String?
  verified   Boolean  @default(false)
  @@map("expert_verifications")
}
```

**Расширение `Course`:** `lecturerId String?` и `academyId String?` (постепенно заменяют строковый `author`), `level ExpertLevel`, `category` → enum направлений (Имплантация/Ортопедия/Хирургия/Терапия/Детская/Цифровая).

**API-модуль `modules/academy`:** кабинет лектора (создание курса, загрузка видео, вебинары, продажа, ученики), кабинет академии (лекторы/курсы/студенты/сертификаты/финансы/аналитика). Права: `school.course.*`, `school.lecturer.*` в scope `ACADEMY`.

### 5.3 Rating & Trust (общая для Shop и School)

```prisma
model Review {
  id         String   @id @default(uuid())
  authorId   String
  targetType String   // supplier | lecturer | product | course
  targetId   String
  rating     Int      // 1..5
  criteria   Json     // {quality, delivery, docs} | {expertise, practicality}
  comment    String?
  createdAt  DateTime @default(now())
  @@index([targetType, targetId])
  @@map("reviews")
}
```
Агрегаты рейтинга кэшируются на сущностях (материализованное поле `ratingAvg`, пересчёт по событию `review.created`).

### 5.4 AI-агенты экосистемы (Фаза 6)
- **AI Supplier Agent** — генерация описаний, проверка категории, поиск ошибок, сравнение рыночных цен, рекомендации продвижения и Verified Badge. Реализуется как новая функция-агент в `modules/ai/agents` + `modules/ai/functions/supplier.functions.ts`.
- **AI Course Builder** — структура курса, учебный план, тесты, презентации, субтитры, перевод. `modules/ai/functions/course.functions.ts`.
- Интеграция в главный AI Workspace через существующий `intent.engine.ts` (новые интенты `CREATE_PRODUCT`, `CREATE_COURSE`, `FIND_COURSE`, `FIND_PRODUCT`).

---

## 6. Chapter C — Finance & Payment Architecture

### 6.1 Finance Core (Фаза 4) — учёт через двойную запись

```prisma
enum WalletOwnerType { CLINIC SUPPLIER ACADEMY LECTURER PARTNER PLATFORM }
enum TxStatus { PENDING COMPLETED FAILED REVERSED }

model Wallet {
  id         String          @id @default(uuid())
  ownerType  WalletOwnerType
  ownerId    String
  currency   String          @default("KZT")
  balance    BigInt          @default(0)   // в тиынах (минорные единицы!)
  createdAt  DateTime        @default(now())
  @@unique([ownerType, ownerId, currency])
  @@map("wallets")
}

model Transaction {
  id         String   @id @default(uuid())
  type       String   // purchase | course_sale | subscription | commission | payout | refund
  status     TxStatus @default(PENDING)
  amount     BigInt                        // минорные единицы
  currency   String   @default("KZT")
  refType    String?  // order | course | subscription | dispute
  refId      String?
  meta       Json?
  createdAt  DateTime @default(now())
  entries    LedgerEntry[]
  @@index([refType, refId])
  @@map("transactions")
}

model LedgerEntry {
  id            String   @id @default(uuid())
  transactionId String
  walletId      String
  direction     String   // debit | credit
  amount        BigInt
  transaction Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  @@index([walletId])
  @@map("ledger_entries")
}
```

**Правило:** для каждой `Transaction` сумма `debit == credit`. Домены (Shop/School) вызывают Finance API (`финансовый сервис`), а не создают записи напрямую. Все суммы хранятся в **минорных единицах (тиын)** — устраняет ошибки округления комиссий.

### 6.2 Commission Engine

```prisma
model CommissionRule {
  id         String  @id @default(uuid())
  domain     String  // shop | school | academy
  scopeId    String? // null = глобальное правило, иначе supplier/academy override
  percentBps Int     // базисные пункты: 1000 = 10%
  splitJson  Json?   // {"author":7000,"academy":0,"platform":3000} для school
  @@map("commission_rules")
}
```
Движок распределения при продаже создаёт `Transaction` с записями: покупатель → эскроу → (поставщик/лектор/академия + платформа) по правилу (Shop 5–15%; School 70/30; Academy 50/30/20).

### 6.3 Payments, Subscriptions, Payouts, Disputes (Фаза 5)

```prisma
model Payment {
  id         String   @id @default(uuid())
  provider   String   // kaspi_qr | card | wallet
  externalId String?
  amount     BigInt
  status     String   @default("created") // created | pending | paid | failed | expired
  refType    String?  // order | subscription | enrollment
  refId      String?
  createdAt  DateTime @default(now())
  @@map("payments")
}

model Subscription {
  id        String   @id @default(uuid())
  ownerType WalletOwnerType
  ownerId   String
  plan      String   // free | starter | professional | enterprise
  status    String   @default("active")
  periodEnd DateTime?
  @@map("subscriptions")
}

model Payout {
  id        String   @id @default(uuid())
  walletId  String
  amount    BigInt
  status    String   @default("requested") // requested | approved | paid | rejected
  createdAt DateTime @default(now())
  @@map("payouts")
}

model Dispute {
  id        String   @id @default(uuid())
  refType   String   // order | enrollment
  refId     String
  reason    String
  status    String   @default("open") // open | review | resolved | rejected
  createdAt DateTime @default(now())
  @@map("disputes")
}
```

**Payment Gateway абстракция** (`modules/finance/providers/`): интерфейс `PaymentProvider { createPayment, getStatus, handleCallback }`; первая реализация — `KaspiQrProvider` (создание QR, callback-эндпоинт `POST /api/finance/callbacks/kaspi`, идемпотентность по `externalId`). Карты/банковский API — последующие реализации того же интерфейса.

**Подписки** заменяют текущий `Clinic.plan` (enum остаётся как денормализованная витрина; источник истины — `Subscription`).

### 6.4 AI Finance / Anti-fraud (Фаза 6)
- **AI Finance Agent** — аналитика дохода/расхода/маржи для клиники, прогноз продаж для поставщика, конверсия курса для лектора. Читает из Ledger/Transaction.
- **Anti-Fraud Agent** — `FraudSignal` по подозрительным платежам, массовым возвратам, аномалиям; блокировка через IAM (`status=suspended`).

---

## 7. Сквозные слои

### 7.1 Event Bus (Фаза 0)
Лёгкая шина событий (in-process EventEmitter → при росте вынести в очередь/Redis Streams). Каждое доменное действие публикует событие; подписчики: Notifications, Analytics, Audit, AI, Compliance. Реализует Blueprint §16 и снимает прямые зависимости между модулями.

### 7.2 Compliance AI Layer РК (Фаза 7)
Единый сервис проверок для всех участников: законодательство РК, медицинские требования, защита перс. данных, правила рекламы медуслуг, требования к учебному контенту, налоговые/чековые требования (электронные чеки). Compliance-агент подписан на события `product.created`, `course.published`, `payment.paid` и выставляет вердикт (`approved`/`blocked`/`needs_review`) до публикации/выплаты.

### 7.3 Ecosystem Analytics (Фаза 7)
Дашборд платформы (`platform.superadmin`/`finance`/`compliance`): число клиник/врачей/поставщиков/курсов, оборот Marketplace, продажи обучения, рейтинги, жалобы, риски compliance. Строится на агрегатах Event Bus + Ledger. Расширяет существующий модуль `modules/analytics`.

### 7.4 Интеграция с AI Workspace
Рекомендательный сценарий («нужен курс по имплантации Straumann» → курс + товары) реализуется как оркестрация: intent → Knowledge Router → School + Shop сервисы → merge → ответ с действиями (Blueprint §11–12). Используем существующий `ai.service.ts`/`agent.router.ts`.

---

## 8. Дорожная карта (dependency-ordered)

| Фаза | Новые Prisma-модели | Новые/изменённые модули | Готовность определяется |
|------|--------------------|------------------------|-------------------------|
| 0 | — | `lib/events`, `lib/money`, расширение `AuditLog` | события публикуются, суммы в тиынах |
| 1 | `Membership`, `Role`, `Permission`, `RolePermission`, enum `ScopeType` | `modules/iam`, переписан `middleware/rbac.ts`, `lib/jwt.ts` | CRM работает; поставщик без клиники возможен |
| 2 | `Supplier`, `SupplierDocument`, `ProductCertificate`, расширение `Product` | `modules/suppliers` | кабинет поставщика + верификация |
| 3 | `Lecturer`, `Academy`, `ExpertVerification`, расширение `Course` | `modules/academy` | кабинеты лектора/академии |
| 4 | `Wallet`, `Transaction`, `LedgerEntry`, `CommissionRule` | `modules/finance` (core) | двойная запись сходится; комиссии считаются |
| 5 | `Payment`, `Subscription`, `Payout`, `Dispute` | `modules/finance` (payments), `providers/kaspi` | оплата Kaspi QR + выплаты + споры |
| 6 | `FraudSignal`, `Review` (если не раньше) | `modules/ai` (supplier/course/finance/quality агенты) | AI-агенты и контроль качества |
| 7 | `ComplianceCheck` | `modules/compliance`, расширение `modules/analytics` | вердикты РК + дашборд экосистемы |

Каждая фаза = отдельный PR с миграцией Prisma (`prisma migrate`), обновлением сида и тестами.

---

## 9. Стратегия миграции БД

1. **Только аддитивные изменения** до полной миграции данных. Новые таблицы и nullable-колонки — сначала, backfill — потом, удаление старых полей — в самом конце.
2. Каждая фаза сопровождается backfill-скриптом (по образцу `prisma/seed.ts`).
3. Переходные «двойные» поля (`User.role` ↔ `Membership`, `Product.supplierId` строка ↔ FK, `Course.author` ↔ `lecturerId`) синхронизируются, пока весь код не переключён на новую модель.
4. Денежные поля — сразу `BigInt` в минорных единицах; конвертация витрин на фронте.
5. Использовать `prisma migrate dev`/`deploy` (в репозитории уже есть `db:migrate`), а не только `db push`, чтобы иметь версионируемые миграции для продакшена.

---

## 10. Тестирование и критерии приёмки

- **IAM:** unit-тесты матрицы прав (роль × permission × scope); интеграционные — что старые CRM-эндпоинты не изменили поведение; негатив — доступ поставщика к чужой клинике запрещён.
- **Finance:** property-тест «debit == credit» для любой транзакции; тесты движка комиссий на всех схемах (5–15%, 70/30, 50/30/20); идемпотентность платёжных callback’ов.
- **Ecosystem:** конечные автоматы верификации (переходы и запрет недопустимых переходов); pipeline публикации товара/курса с блокировкой Compliance.
- **E2E:** сценарий из Blueprint §11 (запрос врача → курс + товары), покупка через Kaspi QR (мок-провайдер) → распределение по кошелькам → запрос выплаты.
- Существующий стек тестов (`vitest`) на фронте расширяется; на backend добавляется тестовый раннер (сейчас отсутствует — это отдельная подзадача Фазы 0).

---

## 11. Риски и решения

| Риск | Решение |
|------|---------|
| Ломающая миграция ролей | аддитивная схема + адаптеры `requireRole` поверх `requirePermission` + backfill |
| Ошибки округления денег/комиссий | хранение в минорных единицах (тиын) `BigInt`, распределение остатка по правилу |
| Двойное списание при платёжных callback | идемпотентность по `externalId`, статусная машина `Payment` |
| Рост связности модулей | Event Bus вместо прямых вызовов (Blueprint §16) |
| Compliance РК (медреклама, чеки, перс. данные) | Compliance AI как обязательный шлюз перед публикацией и выплатой |
| Мошенничество | Anti-Fraud Agent + приостановка членства через IAM |
| Взрывной объём фич | строгая фазировка; каждый инкремент самостоятелен и поставляем |

---

## 12. Следующий шаг

Начать с **Фазы 0 + Фазы 1 (IAM)**: это разблокирует все последующие домены. Рекомендуемый первый PR: инфраструктура Event Bus/Money + IAM-модели, сид ролей/прав из `ORG_ROLES`/`PLATFORM_ROLES`, `requirePermission`, обобщённый `switch-context`, backfill из `ClinicMember`, без изменения поведения существующих CRM-маршрутов.

> Этот документ — часть **DentVision Platform V2 Blueprint** и является обязательным ориентиром при разработке backend экосистемы, финансов и IAM.
