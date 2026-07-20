# DentVision Platform V2 — План интеграции (Platform Extensions)

## Chapters: Developer Platform · Workflow Studio · Data Intelligence · Partner Program

**Version:** 1.0
**Status:** Mandatory Architecture Component
**Продолжение:** [`docs/DENTVISION_V2_INTEGRATION_PLAN.md`](DENTVISION_V2_INTEGRATION_PLAN.md) (Ecosystem · Finance · IAM)

Документ описывает внедрение четырёх «платформенных» модулей, которые превращают DentVision из вертикального супер-приложения в **расширяемую платформу** (Platform-as-a-Product): открытый API и экосистема интеграций, визуальные автоматизации, единая аналитика и управляемая партнёрская программа.

> **Важно о зависимостях.** Эти четыре модуля — надстройка над фундаментом из первого плана. Их нельзя строить раньше базовых слоёв:
> - **IAM** (scoped RBAC, `Membership`/`Permission`) — нужен для API-ключей, OAuth-скоупов, ролей партнёров и прав на автоматизации.
> - **Event Bus** (Фаза 0 первого плана) — нужен для вебхуков, триггеров Workflow Studio и потока событий в Data Intelligence.
> - **Finance Core** (`Wallet`/`Ledger`/`CommissionRule`) — нужен для комиссионной модели Partner Program.
> - **Ecosystem** (`Supplier`/`Academy`) — Partner Program управляет именно этими сущностями.
> - **AI Core** (`ai.service.ts`, `intent.engine.ts`) — узлы-AI в Workflow Studio и AI-отчёты в Data Intelligence.

---

## 0. TL;DR — где эти модули в общей дорожной карте

Нумерация фаз продолжает первый план (там Фазы 0–7).

| Фаза | Модуль | Обязательные предпосылки |
|------|--------|--------------------------|
| **8** | **Developer Platform** (API v1, API-ключи, OAuth-приложения, вебхуки, sandbox) | IAM, Event Bus |
| **9** | **Workflow Studio** (визуальный конструктор, движок исполнения) | Event Bus, IAM, Action Registry (AI Core), Developer Platform (действия-коннекторы) |
| **10** | **Data Intelligence** (warehouse, ETL/CDC, BI, прогнозы, AI-отчёты) | Event Bus, все домены, AI Core |
| **11** | **Partner Program** (уровни, KPI, SLA, комиссии, co-marketing) | IAM, Finance Core, Ecosystem, Data Intelligence (для KPI) |
| **12** | **Integrations Marketplace** (публикация/установка сторонних приложений) | Developer Platform, Finance (биллинг приложений) |

Каждая фаза — самостоятельно поставляемый инкремент; расширение Prisma-схемы аддитивное.

---

## 1. Baseline и переиспользование

- Публичного API/SDK/вебхуков сегодня **нет** (проверено: в `dentvision-backend/src` нет упоминаний webhook/workflow/integration/api-key/oauth/partner).
- `modules/analytics/analytics.routes.ts` считает метрики **напрямую по OLTP** (Postgres) в разрезе одной клиники (`dashboard`, `revenue`, `doctors`, `patients-growth`). Data Intelligence обобщает и выносит это в отдельный аналитический слой.
- Rate limiting уже есть (`express-rate-limit` в `app.ts`) — переиспользуется для внешнего API с пер-ключевыми лимитами.
- AI-оркестрация (`modules/ai/core/*`) — переиспользуется как «узлы AI» и «AI-отчёты».

---

## 2. Developer Platform (Фаза 8)

### 2.1 Цель
Открыть DentVision как платформу для сторонних разработчиков: **версионированный публичный API, SDK, вебхуки, песочница (sandbox) и маркетплейс интеграций**.

### 2.2 Состав
- **Public API v1** — стабильный контракт `/api/v1/**` поверх существующих доменных сервисов (внутренние `/api/**` остаются для собственного фронта). Единый источник — **OpenAPI 3.1** спецификация.
- **Аутентификация приложений** — API-ключи (server-to-server) и **OAuth 2.0** (для приложений от имени пользователя). Скоупы = permissions из IAM (`shop.product.read`, `crm.patient.read` …).
- **Вебхуки** — подписка на события Event Bus; доставка с подписью (HMAC), ретраями и журналом доставки.
- **Sandbox** — изолированное окружение/организация с тестовыми данными и **тестовым платёжным провайдером** (мок Kaspi из Finance).
- **SDK** — автогенерация из OpenAPI (TypeScript/JS в первую очередь; Python — далее).

### 2.3 Prisma
```prisma
model DeveloperApp {
  id          String   @id @default(uuid())
  ownerUserId String
  name        String
  environment String   @default("sandbox") // sandbox | production
  oauthSecret String?
  redirectUris String[]
  scopes      String[]                     // ключи permissions из IAM
  createdAt   DateTime @default(now())
  keys        ApiKey[]
  webhooks    Webhook[]
  @@map("developer_apps")
}

model ApiKey {
  id         String   @id @default(uuid())
  appId      String
  prefix     String   @unique              // видимый префикс
  hash       String                        // хэш секрета (секрет не хранится)
  scopes     String[]
  rateLimit  Int      @default(200)        // запросов/мин
  revokedAt  DateTime?
  createdAt  DateTime @default(now())
  app DeveloperApp @relation(fields: [appId], references: [id], onDelete: Cascade)
  @@map("api_keys")
}

model Webhook {
  id         String   @id @default(uuid())
  appId      String
  url        String
  events     String[]                      // "appointment.created", "payment.paid" …
  secret     String                        // для HMAC-подписи
  active     Boolean  @default(true)
  app DeveloperApp @relation(fields: [appId], references: [id], onDelete: Cascade)
  @@map("webhooks")
}

model WebhookDelivery {
  id         String   @id @default(uuid())
  webhookId  String
  event      String
  payload    Json
  status     String   @default("pending")  // pending | delivered | failed
  attempts   Int      @default(0)
  lastError  String?
  createdAt  DateTime @default(now())
  @@index([webhookId, status])
  @@map("webhook_deliveries")
}
```

### 2.4 Модули и middleware
- `modules/developer` — CRUD приложений/ключей/вебхуков, OAuth-эндпоинты (`/oauth/authorize`, `/oauth/token`), просмотр журнала доставки.
- Новый middleware `authenticateApiKey` / `authenticateOAuth` — параллельно с `authenticate`; заполняет `req.user`/`req.membership` и **сужает права до `scopes`** (пересечение с правами субъекта в IAM).
- **Webhook dispatcher** — подписчик Event Bus: на каждое событие находит активные `Webhook` с этим событием, ставит `WebhookDelivery`, доставляет с экспоненциальными ретраями и HMAC-подписью.
- Per-key rate limiting (расширение существующего `express-rate-limit` ключом `ApiKey.prefix`).

### 2.5 Критерий приёмки
Стороннее приложение в sandbox создаёт запись на приём через `/api/v1/appointments`, получает вебхук `appointment.created` с валидной подписью, и не может выйти за пределы выданных скоупов.

---

## 3. Workflow Studio (Фаза 9)

### 3.1 Цель
Визуальный конструктор автоматизаций (аналог **n8n / Power Automate**): клиника собирает процессы «триггер → условия → действия» без кода.

### 3.2 Модель исполнения
- **Триггеры** — из Event Bus (`appointment.created`, `invoice.overdue`, `review.created` …), по расписанию (cron) или вебхуком/ручным запуском.
- **Узлы (nodes):** действия (вызовы Action Registry из AI Core / публичного API), условия/ветвления, задержки, узлы-AI (промпт к `ai.service.ts`), узлы-коннекторы (внешние интеграции через Developer Platform).
- **Движок** — интерпретатор графа с пер-узловым логом, ретраями и правами: workflow исполняется в контексте организации и **не может превысить права роли-владельца** (проверка через IAM `requirePermission` на каждом действии).

### 3.3 Prisma
```prisma
model Workflow {
  id         String   @id @default(uuid())
  scopeType  String                        // CLINIC | ACADEMY | SUPPLIER
  scopeId    String
  name       String
  status     String   @default("draft")    // draft | active | disabled
  graph      Json                          // {nodes:[...], edges:[...]}
  trigger    Json                          // {type:"event"|"cron"|"manual", ...}
  createdBy  String
  createdAt  DateTime @default(now())
  runs       WorkflowRun[]
  @@index([scopeType, scopeId])
  @@map("workflows")
}

model WorkflowRun {
  id          String   @id @default(uuid())
  workflowId  String
  status      String   @default("running") // running | success | failed | cancelled
  triggerData Json?
  steps       Json?                         // пер-узловые результаты/логи
  startedAt   DateTime @default(now())
  finishedAt  DateTime?
  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  @@index([workflowId, status])
  @@map("workflow_runs")
}
```

### 3.4 Модуль
- `modules/workflow` — CRUD workflow, запуск/останов, история `WorkflowRun`, тест-прогон.
- **Реестр узлов (Node Registry)** — расширяемый каталог типов узлов; действия переиспользуют **Action Registry** из Blueprint §15 (тот же реестр команд, что и у AI). Это ключевая экономия: одна команда «Создать приём» доступна и AI, и Workflow Studio, и публичному API.
- Планировщик cron-триггеров + подписка на Event Bus.

### 3.5 Критерий приёмки
Workflow «при `invoice.overdue` → узел-AI формирует напоминание → действие `notification.send` пациенту» создаётся визуально, активируется, и его прогон виден в истории с логами по шагам.

---

## 4. Data Intelligence (Фаза 10)

### 4.1 Цель
Единое хранилище данных, **BI-панели, прогнозная аналитика и AI-отчёты** поверх всех доменов (CRM/Shop/School/Finance/Partner).

### 4.2 Архитектура данных
- **Разделение OLTP/OLAP.** Текущая аналитика на живом Postgres не масштабируется. Вводим аналитический слой: на старте — **материализованные представления/агрегатные таблицы** в том же Postgres; при росте — отдельный warehouse (ClickHouse/BigQuery) с загрузкой через ETL.
- **Поток загрузки:** Event Bus → потребитель `analytics-ingest` → таблицы фактов/измерений (star schema). Плюс ночной батч-снимок для сверки.
- **Метрики как код:** реестр метрик (`Metric`) с определением (SQL/агрегатом), чтобы BI и AI-отчёты считали одинаково.
- **Прогнозы:** отдельные джобы (поток пациентов, спрос на товары, конверсия курсов) пишут `Prediction`; модели вызываются как сервис (в т.ч. через AI Core).
- **AI-отчёты:** `ai.service.ts` получает доступ к метрикам как к инструменту и генерирует нарративные отчёты («доход/расход/маржа за месяц + рекомендация») — переиспользует AI Finance Agent из первого плана.

### 4.3 Prisma (управляющие таблицы; сами факты — в аналитических таблицах/warehouse)
```prisma
model Dataset {
  id        String @id @default(uuid())
  key       String @unique                 // "appointments_fact"
  source    String                          // event | batch
  schema    Json
  @@map("datasets")
}

model Metric {
  id         String @id @default(uuid())
  key        String @unique                // "revenue_month", "chair_utilization"
  domain     String
  definition Json                           // выражение/SQL/агрегат
  @@map("metrics")
}

model Dashboard {
  id        String   @id @default(uuid())
  scopeType String
  scopeId   String
  name      String
  layout    Json                            // виджеты и их метрики
  createdBy String
  @@index([scopeType, scopeId])
  @@map("dashboards")
}

model Report {
  id         String   @id @default(uuid())
  scopeType  String
  scopeId    String
  type       String   // scheduled | adhoc | ai
  spec       Json
  lastRunAt  DateTime?
  @@map("reports")
}

model Prediction {
  id        String   @id @default(uuid())
  scopeType String
  scopeId   String
  kind      String    // patient_flow | product_demand | course_conversion
  horizon   String    // "30d"
  result    Json
  createdAt DateTime @default(now())
  @@index([scopeType, scopeId, kind])
  @@map("predictions")
}
```

### 4.4 Модуль
- `modules/data-intelligence` (или расширение `modules/analytics`): API дашбордов/метрик/отчётов/прогнозов; строгие права по scope (клиника видит свои данные; платформенные роли — агрегаты экосистемы из первого плана §7.3).
- Существующие эндпоинты `analytics/*` переводятся на реестр метрик (обратная совместимость сохраняется — старые ответы не меняются).

### 4.5 Критерий приёмки
BI-дашборд клиники строится из реестра метрик (значения совпадают со старым `analytics/dashboard`); AI-отчёт за месяц генерируется по тем же метрикам; прогноз потока пациентов на 30 дней доступен через API.

---

## 5. Partner Program (Фаза 11)

### 5.1 Цель
Отдельная модель управления **производителями, дистрибьюторами, академиями, лабораториями и официальными партнёрами**: уровни (tiers), KPI, SLA, комиссионная модель и совместные маркетинговые кампании.

### 5.2 Связь с существующими доменами
- Партнёр — надстройка над сущностями Ecosystem (`Supplier`, `Academy`) и над `LabOrder`-поставщиками (лаборатории). Партнёрская роль — это scoped-membership в IAM (`partner.*`).
- Комиссии реализуются как **override-правила** поверх `CommissionRule` из Finance (`scopeId` уже предусмотрен для переопределения на уровне поставщика/академии) — уровень партнёра меняет `percentBps`/`split`.
- KPI считаются из Data Intelligence (метрики оборота, рейтинга, SLA-исполнения).

### 5.3 Prisma
```prisma
enum PartnerType { MANUFACTURER DISTRIBUTOR ACADEMY LABORATORY OFFICIAL_PARTNER }

model Partner {
  id          String      @id @default(uuid())
  type        PartnerType
  refType     String                        // supplier | academy | lab
  refId       String                        // ссылка на Supplier/Academy/…
  tierId      String?
  status      String      @default("active")
  createdAt   DateTime    @default(now())
  campaigns   MarketingCampaign[]
  slas        PartnerSLA[]
  @@index([type, status])
  @@map("partners")
}

model PartnerTier {
  id            String @id @default(uuid())
  name          String                       // Silver | Gold | Platinum
  minKpiJson    Json                          // пороги вступления
  commissionBps Int                           // спец-комиссия уровня
  benefitsJson  Json                          // привилегии
  @@map("partner_tiers")
}

model PartnerKPI {
  id         String   @id @default(uuid())
  partnerId  String
  period     String    // "2026-07"
  metricsJson Json     // {gmv, rating, fulfillmentRate, disputes}
  score      Float
  createdAt  DateTime @default(now())
  @@index([partnerId, period])
  @@map("partner_kpis")
}

model PartnerSLA {
  id         String @id @default(uuid())
  partnerId  String
  metric     String   // shipping_time | response_time | uptime
  target     Float
  actual     Float?
  breached   Boolean  @default(false)
  partner Partner @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  @@map("partner_slas")
}

model MarketingCampaign {
  id         String   @id @default(uuid())
  partnerId  String
  name       String
  budget     BigInt   @default(0)            // минорные единицы (тиын)
  splitBps   Int      @default(5000)          // 50/50 co-marketing по умолчанию
  status     String   @default("draft")
  startsAt   DateTime?
  endsAt     DateTime?
  partner Partner @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  @@map("marketing_campaigns")
}
```

### 5.4 Модуль
- `modules/partners` — управление партнёрами, уровнями, расчётом KPI (джоба по метрикам Data Intelligence), мониторингом SLA (нарушение → событие + возможная смена уровня), co-marketing кампаниями (бюджет и распределение через Finance).
- Пересчёт уровня: KPI за период → сопоставление с `PartnerTier.minKpiJson` → повышение/понижение → обновление действующей `CommissionRule`.

### 5.5 Критерий приёмки
Поставщик оформлен как `Partner(type=MANUFACTURER)`, получает уровень Gold по KPI за месяц, его комиссия автоматически меняется через `CommissionRule`, нарушение SLA фиксируется событием, co-marketing кампания списывает бюджет через Finance.

---

## 6. Сквозные вопросы

- **Версионирование API:** `/api/v1` — стабильный внешний контракт; внутренние `/api/**` эволюционируют свободно. Ломающие изменения — только через `/api/v2`.
- **Безопасность:** секреты ключей/вебхуков хранятся только в виде хэшей; HMAC-подпись вебхуков; OAuth-скоупы ⊆ прав субъекта в IAM; sandbox изолирован от боевых данных и денег.
- **Единый реестр действий:** AI, Workflow Studio и публичное API используют **один** Action Registry (Blueprint §15) — исключает дублирование бизнес-логики.
- **Наблюдаемость:** доставки вебхуков, прогоны workflow, запуски отчётов и нарушения SLA — все пишут события в Event Bus и в `AuditLog`.
- **Compliance РК:** Data Intelligence и Partner Program проходят те же проверки перс. данных/налоговых требований, что и в первом плане (§7.2).

---

## 7. Дорожная карта

| Фаза | Модели Prisma | Модуль | Готовность |
|------|--------------|--------|-----------|
| 8 | `DeveloperApp`, `ApiKey`, `Webhook`, `WebhookDelivery` | `modules/developer` + `authenticateApiKey/OAuth` + webhook dispatcher | внешнее приложение работает в sandbox, получает подписанные вебхуки |
| 9 | `Workflow`, `WorkflowRun` | `modules/workflow` + Node Registry (поверх Action Registry) | визуальный процесс исполняется с логами по шагам |
| 10 | `Dataset`, `Metric`, `Dashboard`, `Report`, `Prediction` + аналитические таблицы/warehouse | `modules/data-intelligence` | BI + AI-отчёты + прогноз; старые `analytics/*` совместимы |
| 11 | `Partner`, `PartnerTier`, `PartnerKPI`, `PartnerSLA`, `MarketingCampaign` | `modules/partners` | уровни/KPI/SLA/комиссии/co-marketing работают |
| 12 | `Integration`, `IntegrationInstall`, `AppListing` | `modules/marketplace` | публикация и установка сторонних приложений с биллингом |

---

## 8. Риски и решения

| Риск | Решение |
|------|---------|
| Публичный API «замораживает» внутренние контракты | отдельный слой `/api/v1` поверх сервисов; внутренние API свободны |
| Утечка через сторонние приложения | скоупы ⊆ прав IAM, sandbox-изоляция, отзыв ключей, аудит |
| «Runaway» автоматизации (циклы, спам) | лимиты на прогоны/шаги, тайм-ауты, права роли-владельца, kill-switch |
| Нагрузка аналитики на OLTP | вынос в OLAP-слой (матвью → warehouse), загрузка через события |
| Рассинхрон метрик BI и AI-отчётов | единый реестр `Metric` как источник истины |
| Сложность партнёрских комиссий | переиспользование `CommissionRule` (override по `scopeId`), а не новая денежная логика |

---

## 9. Следующий шаг

Порядок обязателен: сначала завершить фундамент (**Фазы 0–7** из первого плана), затем **Фаза 8 (Developer Platform)** — она разблокирует Workflow Studio (коннекторы) и Integrations Marketplace. Data Intelligence можно вести параллельно с Фазы 10, т.к. зависит только от Event Bus и доменов. Partner Program — последним, т.к. опирается на Finance, Ecosystem и KPI из Data Intelligence.

> Этот документ — часть **DentVision Platform V2 Blueprint** и является обязательным ориентиром при разработке платформенных модулей.
