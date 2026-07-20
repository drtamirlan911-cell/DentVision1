# DentVision Platform V2

## AI-First Super Platform Blueprint v1.0

---

# 1. Product Vision

DentVision — это не CRM.

DentVision — это AI-экосистема для стоматологии.

CRM является одним из сервисов.

Главный интерфейс системы — DentVision Intelligence.

Пользователь взаимодействует не со страницами, а с интеллектуальным помощником, который управляет сервисами платформы.

---

# 2. Platform Layers

```text
┌──────────────────────────────────────────────────────────────┐
│                     DentVision Platform                      │
├──────────────────────────────────────────────────────────────┤
│                  DentVision Intelligence                     │
│                                                              │
│ Intent Engine                                                │
│ Context Engine                                               │
│ Memory                                                       │
│ Knowledge Router                                             │
│ Command Planner                                              │
│ Command Bus                                                  │
│ Action Registry                                              │
├──────────────────────────────────────────────────────────────┤
│ Platform Core                                                │
│                                                              │
│ Identity                                                     │
│ Organizations                                                │
│ Membership                                                   │
│ Roles                                                       │
│ Permissions                                                  │
│ Notifications                                                │
│ Search                                                       │
│ Events                                                       │
├──────────────────────────────────────────────────────────────┤
│ Platform Services                                            │
│                                                              │
│ Workspace (CRM)                                              │
│ Marketplace                                                  │
│ Academy                                                      │
│ Community                                                    │
│ Jobs                                                         │
│ Laboratory                                                   │
│ Finance                                                      │
│ Analytics                                                    │
├──────────────────────────────────────────────────────────────┤
│ Database                                                     │
└──────────────────────────────────────────────────────────────┘
```

---

# 3. Information Architecture

```text
DentVision

├── AI Workspace
│
├── My Profile
│
├── Organizations
│     ├── Create
│     ├── Join
│     ├── Demo
│     └── Switch
│
├── Marketplace
│
├── Academy
│
├── Community
│
├── Jobs
│
└── Settings
```

CRM отсутствует как отдельная сущность.

Рабочее пространство появляется только после выбора организации.

---

# 4. User Journey

## Первый запуск

```text
Splash

↓

DentVision Logo

↓

AI Greeting

↓

Service Cards

↓

Animation

↓

AI Workspace
```

---

## Второй запуск

```text
Logo

↓

AI Greeting

↓

AI Workspace
```

Карточки сервисов больше не показываются.

---

# 5. AI Workspace

```text
┌──────────────────────────────────────────────────────────────┐
│ Header                                                       │
├──────────────┬──────────────────────────────┬────────────────┤
│ Navigation   │                              │ Context Panel  │
│              │                              │                │
│ Workspace    │                              │ Notifications  │
│ Marketplace  │          AI                  │ Today's Tasks  │
│ Academy      │        Workspace             │ Calendar       │
│ Community    │                              │ AI Tips        │
│ Jobs         │                              │                │
│ Profile      │                              │                │
├──────────────┴──────────────────────────────┴────────────────┤
│ Smart Command Bar                                            │
└──────────────────────────────────────────────────────────────┘
```

AI всегда остается главным элементом интерфейса.

---

# 6. Workspace Flow

```text
Workspace

↓

Organizations

↓

Select Organization

↓

Workspace Context

↓

Patients

Appointments

Finance

Lab

Inventory
```

---

# 7. Registration Flow

```text
Register

↓

Personal Profile

↓

AI Onboarding

↓

Platform Access

↓

Marketplace

↓

Academy

↓

Community

↓

Workspace
```

Создание клиники не является обязательным.

---

# 8. Organization Flow

```text
Organizations

↓

Create

или

Join

или

Demo
```

---

# 9. Multi Organization

```text
User

↓

Organizations

↓

KazDent

Smile

University

Demo
```

Каждая организация имеет собственный Workspace.

---

# 10. AI Request Flow

```text
User

↓

Intent Engine

↓

Context Engine

↓

Permission Check

↓

Knowledge Router

↓

Command Planner

↓

Command Bus

↓

Action Registry

↓

Platform Service

↓

Database

↓

Response

↓

AI Workspace
```

---

# 11. Knowledge Flow

```text
Question

↓

Knowledge Router

↓

DentVision Data

↓

Academy

↓

Marketplace

↓

Research

↓

Internet

↓

Merge

↓

Final Answer
```

---

# 12. Marketplace Logic

```text
Question

↓

Need Equipment?

↓

Compare Market

↓

Research

↓

Recommendations

↓

Marketplace Products

↓

Purchase
```

Сначала консультация, затем предложение товара.

---

# 13. Academy Logic

```text
Question

↓

Determine Skill

↓

Find Courses

↓

Find Articles

↓

Learning Path

↓

Progress
```

---

# 14. Context Engine

AI всегда знает:

```text
Current User

↓

Current Organization

↓

Current Patient

↓

Current Screen

↓

Conversation Memory

↓

Role

↓

Permissions
```

---

# 15. Command Execution

```text
"Запиши пациента"

↓

Intent

↓

Create Appointment

↓

Open Form

↓

Fill Fields

↓

Confirmation

↓

Save

↓

Notify

↓

Analytics
```

---

# 16. Event Bus

Каждое действие генерирует событие.

```text
Appointment Created

↓

Notification

↓

Analytics

↓

Calendar

↓

AI

↓

Audit

↓

Activity Feed
```

Все сервисы подписываются на события.

---

# 17. Permission Model

```text
Platform

↓

User

↓

Membership

↓

Organization

↓

Role

↓

Permissions
```

Роль принадлежит Membership, а не User.

---

# 18. AI Memory

```text
Conversation Memory

↓

Patient Memory

↓

Organization Memory

↓

Personal Memory

↓

Learning Memory

↓

Shopping Memory
```

---

# 19. Search

Единый поиск по всей платформе.

```text
Search

↓

Patients

Doctors

Courses

Products

Orders

Articles

Organizations

Documents

Community
```

---

# 20. Mobile Blueprint

```text
──────────────

AI Workspace

──────────────

Context Sheet

──────────────

Bottom Navigation

Workspace

Shop

Academy

Community

Profile
```

AI занимает почти весь экран.

---

# 21. Design System

Требования:

* единая дизайн-система;
* единая библиотека компонентов;
* SVG-иконки;
* Lucide Icons (или собственный набор);
* Framer Motion для всех анимаций;
* светлая и темная темы;
* адаптивность Desktop / Tablet / Mobile.

---

# 22. Product Principles

1. **AI First** — AI является основным способом взаимодействия с системой.
2. **Platform, not CRM** — CRM — один из сервисов, а не центр продукта.
3. **User First** — личный аккаунт пользователя существует независимо от организаций.
4. **Workspace Based** — доступ к данным осуществляется через выбранное рабочее пространство.
5. **Context Aware** — AI всегда учитывает текущий контекст, роль и права.
6. **Action Driven** — AI не только отвечает, но и выполняет действия через подтверждаемые команды.
7. **Modular Architecture** — каждый сервис развивается независимо и подключается через общие платформенные механизмы.
8. **Event Driven** — взаимодействие сервисов строится на событиях, а не на прямых зависимостях.
9. **Transparent Recommendations** — рекомендации должны быть объективными; товары Marketplace предлагаются только после анализа потребностей.
10. **Scalable by Design** — архитектура должна поддерживать новые сервисы (например, телемедицину, страхование, лаборатории, сети клиник) без переработки ядра платформы.

Этот Blueprint должен стать основным документом проекта. Любое изменение интерфейса, бизнес-логики или архитектуры должно проверяться на соответствие этим принципам, чтобы DentVision оставался единой AI-платформой, а не превратился со временем в набор несвязанных модулей.

---

# 23. Обязательные главы V2 (План интеграции)

Следующие главы являются обязательными компонентами архитектуры (**Mandatory Architecture Component**) и внедряются в порядке зависимостей (**IAM — первым**):

- **Chapter: Identity & Access Management (IAM)** — единая система аккаунтов, контекстов (Clinic/Supplier/Academy/Platform), ролей и гранулярных прав. Фундамент для всех доменов.
- **Chapter: Ecosystem Marketplace & Education Governance** — кабинеты поставщиков и лекторов/академий, верификация, богатые карточки товаров/курсов, рейтинги, AI-агенты Supplier/Course/Quality.
- **Chapter: Finance & Payment Architecture** — кошельки, двойная запись (Ledger), комиссии, подписки, Kaspi QR, выплаты, споры, AI Finance/Anti-fraud, Compliance РК.

Детальный, привязанный к кодовой базе план внедрения (целевая схема Prisma, изменения IAM, дорожная карта по фазам, стратегия миграции, тестирование и риски) вынесен в отдельный документ:

**[`docs/DENTVISION_V2_INTEGRATION_PLAN.md`](docs/DENTVISION_V2_INTEGRATION_PLAN.md)**

---

# 24. Platform Extensions V2 (План интеграции)

Второй набор обязательных глав — «платформенные» модули, превращающие DentVision в расширяемую **Platform-as-a-Product**. Строятся поверх фундамента главы 23 (IAM · Event Bus · Finance · Ecosystem · AI Core):

- **Chapter: Developer Platform** — публичный API v1, SDK, API-ключи/OAuth, вебхуки, песочница (sandbox), маркетплейс интеграций.
- **Chapter: Workflow Studio** — визуальный конструктор автоматизаций (аналог n8n/Power Automate) поверх Event Bus и единого Action Registry.
- **Chapter: Data Intelligence** — разделение OLTP/OLAP, единое хранилище, реестр метрик, BI-панели, прогнозная аналитика и AI-отчёты.
- **Chapter: Partner Program** — управление производителями/дистрибьюторами/академиями/лабораториями/официальными партнёрами: уровни, KPI, SLA, комиссии (override поверх `CommissionRule`) и co-marketing.

Детальный план (целевая схема Prisma, модули/API, дорожная карта Фаз 8–12, зависимости, риски) вынесен в отдельный документ:

**[`docs/DENTVISION_V2_PLATFORM_EXTENSIONS_PLAN.md`](docs/DENTVISION_V2_PLATFORM_EXTENSIONS_PLAN.md)**

---

# 25. Гейт качества: аудит текущего состояния

Перед реализацией планов глав 23–24 обязателен **входной аудит ядра**: он фиксирует конкретные баги и несогласованности, найденные при запуске проекта (крах CRM из-за конверта ответа, пустой AI-чат из-за двойной распаковки, потеря сессии из-за невызванного `restoreSession`, публичные clinics-эндпоинты, деньги во `Float`, заглушки в API), и вводит **Этап стабилизации (Фаза 0.5)** до Фазы 1 (IAM).

**[`docs/DENTVISION_V2_ARCHITECTURE_REVIEW.md`](docs/DENTVISION_V2_ARCHITECTURE_REVIEW.md)**