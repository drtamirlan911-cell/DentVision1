# DentVision Enterprise — План интеграции сервисов и модуля Diagnostics

## 1. Текущее состояние (что уже есть)

| Сервис | Роль | Статус |
|--------|------|--------|
| **DentVision CRM** | `/crm/*` — 17 страниц | ✅ Работает |
| **DentVision AI** | `/` (AI Workspace), AI OS, агенты, Digital Twin | ✅ Работает |
| **DentVision Academy** | `/school/*`, `/school/admin` | ✅ Работает |
| **DentVision Marketplace** | `/shop/*`, `/supplier` | ✅ Работает |
| **DentVision Community** | `/community` | ✅ Работает |
| **DentVision Analytics** | `/analytics`, `/bi` | ✅ Работает |
| **DentVision Finance** | Частично в CRM (касса, billing) + `/bi` | ⚠️ Частично |
| **DentVision Diagnostics** | Не существует | ❌ Новый |

---

## 2. Целевая архитектура — концепция 8 сервисов

### 2.1. Ключевой принцип: Role-Based Visibility

**Сервисы — это концептуальная архитектура, НЕ 8 пунктов меню для каждого пользователя.**

Каждый пользователь видит в сайдбаре только те сервисы, которые соответствуют его роли:

```
superadmin / owner / director:     все 8 сервисов
admin:                             CRM, Diagnostics, AI, Academy, Analytics
accountant:                        CRM (финансы), Analytics
doctor:                            CRM, Diagnostics, AI, Academy
assistant / reception:             CRM, Diagnostics
intern:                            CRM (только чтение)
laboratory / diagnostic-center:    Diagnostics (своя панель)
user:                              Academy, Marketplace, Community
```

### 2.2. Где что остаётся

| Сервис | Где живёт | Статус |
|--------|-----------|--------|
| **DentVision CRM** | `/crm/*` — 17 страниц | ✅ Без изменений |
| **DentVision AI** | `/` (AI Workspace) + AI OS | ✅ Без изменений |
| **DentVision Diagnostics** | `/diagnostics/*` — НОВЫЙ | ❌ Создать |
| **DentVision Academy** | `/school/*` | ✅ Без изменений |
| **DentVision Marketplace** | `/shop/*`, `/supplier` | ✅ Без изменений |
| **DentVision Analytics** | `/analytics`, `/bi` | ✅ Diagnostics Analytics как sub-tab |
| **DentVision Finance** | Остаётся в CRM (`/crm/cashier`, `/crm/billing`), НЕ выносится отдельно | ⚠️ Только для owner/director/admin/accountant |
| **DentVision Community** | `/community` | ✅ Без изменений |

### 2.3. Sidebar — изменения

**Добавить** только один новый пункт — **Diagnostics** (для ролей с `diagnostics` в pages).

**Finance НЕ добавлять** как отдельный пункт — Cashier/Billing остаются под CRM subnav, видимы только для ролей с `finance`/`cashier` в pages (как сейчас).

**Jobs** — убрать из основного сайдбара (не соответствует ни одному из 8 сервисов). Оставить по прямой ссылке или перенести в Community.

**Текущий список NAV_ITEMS** — перегруппировать для единообразия, но не плодить сущности:

---

## 3. Модуль Diagnostics — Полный план реализации

### 3.1. База данных (Prisma) — Новые модели

```prisma
// ─── Enums ───
enum DiagnosticCategory { CBCT OPG TRG TMJ STL FACE_SCAN DICOM ALLERGY HISTOLOGY PCR MICROBIOLOGY BLOOD GENETICS BIOPSY SALIVA PATHOLOGY OTHER }
enum ReferralStatus { DRAFT SENT ACCEPTED SCHEDULED PATIENT_ARRIVED IN_PROGRESS COMPLETED REVIEWED DELIVERED CLOSED CANCELLED }
enum ReferralPriority { NORMAL URGENT EMERGENCY }
enum DentitionRegion { UPPER RIGHT LOWER LEFT FULL_ARCH QUADRANT SEGMENT SINGLE_TOOTH MULTIPLE_TEETH }

// ─── Models ───
model DiagnosticCenter {
  id          String   @id
  name        String
  city        String?
  address     String?
  phone       String?
  email       String?
  rating      Float?   @default(0)
  logo        String?
  lat         Float?
  lng         Float?
  active      Boolean  @default(true)
  accredited  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members     DiagnosticCenterMember[]
  referrals   Referral[]               @relation("CenterReferral")
  studies     DiagnosticStudy[]
  operators   Operator[]
  radiologists Radiologist[]
  bookings    Booking[]
  schedules   Schedule[]
  notifications Notification[]
}

model DiagnosticCenterMember {
  id        String   @id
  centerId  String
  userId    String
  role      String   // admin | radiologist | operator | manager
  createdAt DateTime @default(now())

  center DiagnosticCenter @relation(fields: [centerId], references: [id])
  user   User             @relation(fields: [userId], references: [id])

  @@unique([centerId, userId])
  @@index([userId])
}

model Laboratory {
  id          String   @id
  name        String
  city        String?
  address     String?
  phone       String?
  email       String?
  rating      Float?   @default(0)
  accredited  Boolean  @default(false)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members     LaboratoryMember[]
  referrals   Referral[]          @relation("LabReferral")
  tests       LaboratoryTest[]
  bookings    Booking[]
}

model LaboratoryMember {
  id        String   @id
  labId     String
  userId    String
  role      String
  createdAt DateTime @default(now())

  lab  Laboratory @relation(fields: [labId], references: [id])
  user User       @relation(fields: [userId], references: [id])

  @@unique([labId, userId])
  @@index([userId])
}

model Referral {
  id              String            @id
  // Patient info (denormalized for snapshot integrity)
  patientId       String?
  patientName     String
  patientIin      String?
  patientBirth    DateTime?
  patientAge      Int?
  patientGender   String?
  patientPhone    String?
  patientEmail    String?
  pregnancy       Boolean           @default(false)
  allergies       String?
  specialNotes    String?
  patientPhoto    String?
  // Doctor info
  clinicId        String            // originating clinic
  doctorId        String
  doctorName      String?
  doctorPhone     String?
  doctorEmail     String?
  // Diagnostic type
  category        DiagnosticCategory
  studyType       String            // specific: CBCT, OPG, Histology, etc.
  anatomicalSites Json?             // selected teeth/regions [{region, teeth[]}]
  // Clinical
  complaints      String?
  preliminaryDx   String?
  studyGoal       String?
  commentForDoctor  String?
  commentForLab     String?
  priority        ReferralPriority  @default(NORMAL)
  status          ReferralStatus    @default(DRAFT)
  // Assignment
  centerId        String?           // diagnostic center
  labId           String?           // laboratory
  operatorId      String?
  radiologistId   String?
  // Schedule
  scheduledDate   DateTime?
  scheduledTime   String?
  // Finance
  cost            Decimal?          @default(0)
  platformFee     Decimal?          @default(0)
  paid            Boolean           @default(false)
  paidAt          DateTime?
  // Audit trail
  referrerNote    String?           // internal note
  reviewerId      String?           // who reviewed results
  reviewedAt      DateTime?
  completedAt     DateTime?
  cancelledAt     DateTime?
  cancelReason    String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  // Relations
  clinic          Clinic                @relation(fields: [clinicId], references: [id])
  doctor          User                  @relation(fields: [doctorId], references: [id])
  patient         Patient?              @relation(fields: [patientId], references: [id])
  center          DiagnosticCenter?     @relation("CenterReferral", fields: [centerId], references: [id])
  lab             Laboratory?           @relation("LabReferral", fields: [labId], references: [id])
  operator        Operator?             @relation(fields: [operatorId], references: [id])
  radiologist     Radiologist?          @relation(fields: [radiologistId], references: [id])
  files           ReferralFile[]
  comments        ReferralComment[]
  result          DiagnosticResult?
  notifications   Notification[]
  auditLogs       AuditLog[]

  @@index([clinicId])
  @@index([centerId])
  @@index([labId])
  @@index([doctorId])
  @@index([patientId])
  @@index([status])
}

model ReferralFile {
  id         String   @id
  referralId String
  fileName   String
  fileType   String   // image|pdf|dicom|stl|zip
  fileUrl    String
  fileSize   Int?
  uploadedBy String
  createdAt  DateTime @default(now())

  referral Referral @relation(fields: [referralId], references: [id])
  uploader User     @relation(fields: [uploadedBy], references: [id])

  @@index([referralId])
}

model ReferralComment {
  id         String   @id
  referralId String
  authorId   String
  text       String
  createdAt  DateTime @default(now())

  referral Referral @relation(fields: [referralId], references: [id])
  author   User     @relation(fields: [authorId], references: [id])

  @@index([referralId])
}

model DiagnosticResult {
  id          String   @id
  referralId  String   @unique
  reportText  String?  // Rich text / HTML
  conclusion  String?
  pdfUrl      String?
  signedBy    String?
  signedAt    DateTime?
  aiSummary   String?
  aiGenerated Boolean  @default(false)
  templateId  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  referral Referral @relation(fields: [referralId], references: [id])
}

model DiagnosticStudy {
  id          String   @id
  centerId    String
  name        String   // CBCT, OPG, TRG, etc.
  category    DiagnosticCategory
  description String?
  price       Decimal?
  durationMin Int?     // minutes
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  center DiagnosticCenter @relation(fields: [centerId], references: [id])
  bookings Booking[]
}

model Operator {
  id        String   @id
  centerId  String
  userId    String
  specialty String?  // CBCT, OPG, etc.
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  center    DiagnosticCenter @relation(fields: [centerId], references: [id])
  user      User             @relation(fields: [userId], references: [id])
  referrals Referral[]

  @@index([centerId])
}

model Radiologist {
  id        String   @id
  centerId  String
  userId    String
  specialty String?  // 3D, general
  license   String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  center    DiagnosticCenter @relation(fields: [centerId], references: [id])
  user      User             @relation(fields: [userId], references: [id])
  referrals Referral[]

  @@index([centerId])
}

model LaboratoryTest {
  id           String   @id
  labId        String
  name         String
  category     DiagnosticCategory
  description  String?
  price        Decimal?
  turnaroundHr Int?     // hours
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  lab Laboratory @relation(fields: [labId], references: [id])
}

model Booking {
  id          String   @id
  referralId  String?  // optional — standalone booking or via referral
  centerId    String?
  labId       String?
  studyId     String?
  patientName String
  patientPhone String?
  date        DateTime
  time        String
  durationMin Int?
  notes       String?
  status      String   @default("pending")  // pending | confirmed | completed | cancelled
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  center DiagnosticCenter? @relation(fields: [centerId], references: [id])
  lab    Laboratory?       @relation(fields: [labId], references: [id])
  study  DiagnosticStudy?  @relation(fields: [studyId], references: [id])
}

model Schedule {
  id        String   @id
  centerId  String
  date      DateTime
  startTime String
  endTime   String
  slots     Int      @default(1)
  available Boolean  @default(true)
  createdAt DateTime @default(now())

  center DiagnosticCenter @relation(fields: [centerId], references: [id])

  @@index([centerId, date])
}
```

### 3.2. API — Модуль `dentvision-backend/src/modules/diagnostics/`

```
diagnostics/
├── diagnostics.routes.ts        # Основной роутер (группирует все подроутеры)
├── referrals.routes.ts          # CRUD направлений + смена статуса
├── centers.routes.ts            # Диагностические центры (поиск, карта, профиль)
├── laboratories.routes.ts       # Лаборатории
├── studies.routes.ts            # Исследования / услуги центра
├── results.routes.ts            # Результаты (просмотр, PDF, DICOM view)
├── operators.routes.ts          # Операторы центров
├── radiologists.routes.ts       # Радиологи
├── bookings.routes.ts           # Онлайн-запись
├── scheduling.routes.ts         # Расписание центра
├── finance.routes.ts            # Финансы (стоимость, оплата, история)
├── dashboard.routes.ts          # Дашборды (врач, центр, админ)
├── statistics.routes.ts         # Статистика
├── diagnostics.service.ts       # Бизнес-логика
├── diagnostics.ai.ts            # AI-интеграция (проверка, генерация)
└── diagnostics.types.ts         # Типы / интерфейсы
```

**REST API Endpoints:**

```
# Referrals
GET    /api/diagnostics/referrals           — список (фильтры: статус, дата, центр, пациент)
POST   /api/diagnostics/referrals           — создать направление
GET    /api/diagnostics/referrals/:id       — детали
PATCH  /api/diagnostics/referrals/:id       — обновить
POST   /api/diagnostics/referrals/:id/status — сменить статус
DELETE /api/diagnostics/referrals/:id       — удалить (только DRAFT)

# Centers
GET    /api/diagnostics/centers             — список + фильтры (город, исследование, рейтинг)
GET    /api/diagnostics/centers/:id         — профиль центра
POST   /api/diagnostics/centers             — создать (admin)
PATCH  /api/diagnostics/centers/:id         — обновить

# Laboratories
GET    /api/diagnostics/laboratories        — список
GET    /api/diagnostics/laboratories/:id    — детали

# Studies
GET    /api/diagnostics/studies             — список доступных исследований
GET    /api/diagnostics/centers/:id/studies — услуги центра

# Results
GET    /api/diagnostics/results             — список результатов
GET    /api/diagnostics/results/:id         — детали результата
POST   /api/diagnostics/results             — создать/сохранить заключение
PATCH  /api/diagnostics/results/:id         — обновить
POST   /api/diagnostics/results/:id/sign    — подписать
GET    /api/diagnostics/results/:id/pdf     — скачать PDF

# Bookings
GET    /api/diagnostics/bookings            — список записей
POST   /api/diagnostics/bookings            — создать запись
PATCH  /api/diagnostics/bookings/:id        — обновить

# Dashboard
GET    /api/diagnostics/dashboard           — главная статистика (кол-во, сегодня, ожидание, готово)
GET    /api/diagnostics/dashboard/doctor    — дашборд врача
GET    /api/diagnostics/dashboard/center    — дашборд центра
GET    /api/diagnostics/dashboard/recent    — последние исследования

# AI
POST   /api/diagnostics/ai/check            — AI проверка направления
POST   /api/diagnostics/ai/suggest-diagnosis — AI предлагает диагноз
POST   /api/diagnostics/ai/generate-report  — AI генерирует шаблон заключения
POST   /api/diagnostics/ai/suggest-studies  — AI предлагает доп. исследования

# Statistics
GET    /api/diagnostics/statistics          — общая статистика

# Comments
GET    /api/diagnostics/referrals/:id/comments    — комментарии
POST   /api/diagnostics/referrals/:id/comments    — добавить комментарий

# Files
POST   /api/diagnostics/files/upload        — загрузить файл направления
GET    /api/diagnostics/files/:id           — скачать файл
DELETE /api/diagnostics/files/:id           — удалить файл

# Finance
GET    /api/diagnostics/finance/revenue     — доход
GET    /api/diagnostics/finance/transactions — история операций
```

### 3.3. Роутинг Frontend

```typescript
// src/index.tsx — добавить под IntelligenceLayout
<Route path="diagnostics" element={<Suspense fallback={<PageLoader />}><DiagnosticsLayout /></Suspense>}>
  <Route index element={<DiagnosticsDashboard />} />
  <Route path="referrals" element={<ReferralList />} />
  <Route path="referrals/new" element={<ReferralForm />} />
  <Route path="referrals/:id" element={<ReferralDetail />} />
  <Route path="centers" element={<CenterList />} />
  <Route path="centers/:id" element={<CenterProfile />} />
  <Route path="laboratories" element={<LabList />} />
  <Route path="laboratories/:id" element={<LabProfile />} />
  <Route path="patients" element={<DiagnosticPatients />} />
  <Route path="results" element={<ResultList />} />
  <Route path="results/:id" element={<ResultViewer />} />
  <Route path="calendar" element={<DiagnosticCalendar />} />
  <Route path="statistics" element={<DiagnosticStatistics />} />
  <Route path="settings" element={<DiagnosticSettings />} />
</Route>
```

### 3.4. Структура страниц Frontend

```
src/pages/diagnostics/
├── DiagnosticsLayout.tsx        # Лэйаут с левым меню Diagnostics (подменю)
├── DiagnosticsDashboard.tsx     # Главная диагностики
├── referrals/
│   ├── ReferralList.tsx         # Список направлений
│   ├── ReferralForm.tsx         # Универсальная форма направления
│   └── ReferralDetail.tsx       # Детали + правая панель
├── centers/
│   ├── CenterList.tsx           # Список центров + карта
│   └── CenterProfile.tsx        # Профиль центра
├── laboratories/
│   ├── LabList.tsx              # Список лабораторий
│   └── LabProfile.tsx           # Профиль лаборатории
├── patients/
│   └── DiagnosticPatients.tsx   # Пациенты диагностики
├── results/
│   ├── ResultList.tsx           # Список результатов
│   └── ResultViewer.tsx         # Просмотр результата (PDF, DICOM, STL)
├── calendar/
│   └── DiagnosticCalendar.tsx   # Календарь
├── statistics/
│   └── DiagnosticStatistics.tsx # Статистика
└── settings/
    └── DiagnosticSettings.tsx   # Настройки диагностики
```

### 3.5. Компоненты (shared)

```
src/components/diagnostics/
├── DiagnosisSelector.tsx         # Выбор типа диагностики (3D | Laboratory)
├── ToothSelector.tsx             # Интерактивная схема зубов
├── AnatomicalSelector.tsx        # Выбор анатомической области
├── ReferralStatusBadge.tsx       # Бейдж статуса
├── ReferralCard.tsx              # Карточка направления
├── ReferralTimeline.tsx          # Таймлайн направления
├── ReferralPriorityBadge.tsx     # Приоритет
├── FileUploader.tsx              # Загрузка файлов (фото, PDF, DICOM, STL)
├── FilePreview.tsx               # Превью файла
├── DicomViewer.tsx               # DICOM просмотрщик (open-source lib)
├── StlViewer.tsx                 # STL/3D просмотрщик
├── DiagnosticMap.tsx             # Карта центров (MapLibre / Leaflet)
├── CenterCard.tsx                # Карточка центра
├── LabCard.tsx                   # Карточка лаборатории
├── StatCard.tsx                  # Карточка статистики
├── ResultTimeline.tsx            # Таймлайн результатов
├── ReportEditor.tsx              # Rich Text редактор заключения
├── ReportTemplate.tsx            # Шаблон заключения
├── AiSuggestionPanel.tsx         # AI рекомендации при создании
├── CenterDashboard.tsx           # Дашборд центра (очередь + входящие)
├── CenterQueue.tsx               # Очередь пациентов центра
└── DiagnosticsFilterBar.tsx      # Фильтры
```

### 3.6. Sidebar — Diagnostics Submenu

Добавить подменю для Diagnostics (как CRM subnav):

```
🔬 Diagnostics
  ├── Dashboard
  ├── My Referrals
  ├── Diagnostic Centers
  ├── Laboratories
  ├── Patients
  ├── Results
  ├── Calendar
  ├── Statistics
  └── Settings
```

### 3.7. Роли и доступ (дополнение auth.store.ts)

Новые page ID: `diagnostics`, `diagnostics-referrals`, `diagnostics-centers`, `diagnostics-labs`, `diagnostics-patients`, `diagnostics-results`, `diagnostics-calendar`, `diagnostics-statistics`, `diagnostics-settings`

Обновление pages для ролей:
- **superadmin**: + все diagnostics
- **owner/director**: + все diagnostics
- **admin**: + diagnostics, diagnostics-referrals, diagnostics-results, diagnostics-settings
- **doctor**: + diagnostics-referrals (только свои), diagnostics-results
- **assistant**: + diagnostics-referrals (создание)
- **diagnostic-center**, **laboratory**, **radiologist**, **operator**: новые платформенные роли

Новый `DiagnosticCenterMember` в системе ролей — разрешает доступ к панели центра.

### 3.8. AI Integration

AI-агенты Diagnostics интегрируются как новые tools в `dentvision-backend/src/modules/ai/os/tools/`:

```typescript
// tools/diagnostics.tools.ts
export const DIAGNOSTICS_TOOLS = [
  {
    name: 'create_diagnostic_referral',
    description: 'Создать направление на диагностику',
    handler: handleCreateReferral,
  },
  {
    name: 'check_referral',
    description: 'AI проверка направления на ошибки',
    handler: handleAiCheckReferral,
  },
  {
    name: 'suggest_diagnosis',
    description: 'Предложить предварительный диагноз на основе симптомов',
    handler: handleAiSuggestDiagnosis,
  },
  {
    name: 'suggest_studies',
    description: 'Предложить дополнительные исследования',
    handler: handleAiSuggestStudies,
  },
  {
    name: 'generate_report_template',
    description: 'Сгенерировать шаблон заключения',
    handler: handleAiGenerateReport,
  },
  {
    name: 'find_diagnostic_centers',
    description: 'Найти диагностические центры по фильтрам',
    handler: handleFindCenters,
  },
  {
    name: 'get_referral_status',
    description: 'Проверить статус направления',
    handler: handleGetReferralStatus,
  },
];
```

Брифинг AI (`jarvisBriefing.ts`) — добавить секцию Diagnostics:
- Количество направлений сегодня
- Просроченные результаты
- Новые результаты за сегодня

### 3.9. Уведомления

Типы уведомлений Diagnostics:
- `referral.created` — новое направление (центр/лаборатория получают)
- `referral.accepted` — направление принято (врач/клиника получают)
- `referral.scheduled` — пациент записан (врач + центр)
- `referral.completed` — исследование выполнено (врач получает)
- `result.ready` — результат готов (врач получает)
- `result.reviewed` — результат просмотрен (центр/лаборатория)

Каналы доставки:
- AI Workspace (встроенные уведомления + AI alerts)
- WebSocket (через существующий SocketProvider)
- Email (через существующий messaging service)
- Push (через существующий механизм)

### 3.10. Audit Logging

Все действия логируются через существующий `audit.service.ts`:
```
REFERRAL_CREATED, REFERRAL_UPDATED, REFERRAL_STATUS_CHANGED,
REFERRAL_VIEWED, REFERRAL_DELETED,
RESULT_CREATED, RESULT_UPDATED, RESULT_SIGNED, RESULT_DOWNLOADED,
FILE_UPLOADED, FILE_DOWNLOADED, FILE_DELETED,
BOOKING_CREATED, BOOKING_UPDATED
```

### 3.11. Tooth Selector (DentalChart reuse)

Использовать существующий `src/components/odontogram/AnatomicalToothSvg.tsx` как основу для интерактивного выбора зубов в форме направления.

### 3.12. Этапы реализации

```
Фаза 1 — Foundation (3-4 дня)
├── Prisma schema + migrations
├── API: centers, laboratories, studies (CRUD)
├── Модели ролей: diagnostic-center, laboratory, radiologist, operator
├── Sidebar: секция Diagnostics + подменю
├── DiagnosticsLayout (лэйаут с левым меню)
└── DiagnosticsDashboard (главная)

Фаза 2 — Referrals (3-4 дня)
├── API: referrals CRUD + статусы
├── Универсальная форма направления (ReferralForm)
├── DiagnosisSelector (3D vs Laboratory)
├── Динамическая форма под категорию
├── ToothSelector (на основе AnatomicalToothSvg)
├── FileUploader (DICOM, STL, PDF, фото)
├── ReferralList + ReferralDetail
└── Правая панель (история, файлы, комментарии, статус)

Фаза 3 — Results & Reports (2-3 дня)
├── API: results CRUD + sign
├── ResultList + ResultViewer
├── ReportEditor (Rich Text)
├── PDF generation
├── DicomViewer (обёртка над open-source)
├── StlViewer (Three.js / Babylon.js)
└── ResultTimeline

Фаза 4 — Centers & Booking (2-3 дня)
├── API: bookings, scheduling
├── CenterProfile (полный профиль)
├── CenterDashboard (очередь, входящие)
├── CenterQueue (карточки очереди)
├── DiagnosticMap (карта с фильтрами)
├── Online booking flow
└── Calendar view

Фаза 5 — AI & Intelligence (2-3 дня)
├── AI tools (create, check, suggest, generate)
├── AiSuggestionPanel в форме направления
├── AI-проверка заполненности при создании
├── AI-генерация заключения
├── Интеграция в Jarvis Briefing
└── AI-уведомления о новых результатах

Фаза 6 — Finance & Statistics (2 дня)
├── API: finance (стоимость, оплата, комиссия)
├── Статистика dashboard
├── DiagnosticStatistics (N исследований, среднее время, доход)
├── Фильтры + графики
└── Экспорт

Фаза 7 — QA & Polish (1-2 дня)
├── Audit logging (все действия)
├── Role-based access testing
├── Error handling + edge cases
├── Responsive (mobile)
└── Load test
```

**Итого: ~16-20 дней на полную реализацию модуля.**

---

## 4. DentVision Finance — подход

### 4.1. Решение: НЕ выделять в отдельный сервис

Finance остаётся внутри CRM. Причины:
- Касса, биллинг, зарплаты — часть ежедневного CRM-воркфлоу
- Отдельный раздел создаёт лишний контекстный переключатель
- Большинству ролей (врач, ассистент) финансы не нужны — им будет мешать лишняя иконка

### 4.2. Что делаем

- Cashier (`/crm/cashier`) — остаётся
- Billing (`/crm/billing`) — остаётся
- Payroll (в CRM Staff) — остаётся
- BI Finance (`/bi`) — остаётся (только owner/director/superadmin)
- DentCash — остаётся как chip в хедере

### 4.3. Улучшение (опционально)

Добавить финансовый дашборд как in-page вкладку внутри CRM или `/bi`, НЕ как отдельный раздел сайдбара.

---

## 5. Super Admin — Platform Operator (не user)

### 5.1. Концепция

**Super Admin — это бог платформы, а не пользователь.** Он:
- Управляет клиниками (создаёт, блокирует, удаляет)
- Управляет пользователями (назначает роли, сбрасывает пароли, удаляет)
- Модерирует все сервисы (Diagnostics, Marketplace, Academy)
- Видит платформенную аналитику и финансы
- Управляет AI Governance, Audit, Security, Backups
- НЕ видит: CRM (расписание, пациенты, визиты), Shop (как покупатель), Academy (как студент), Community (как участник)

### 5.2. Страница Super Admin — /admin (табы)

```
Super Admin Panel
├── 📊 Dashboard      — платформа stats (клиники, юзеры, MRR, активность)
├── 🏥 Клиники       — список, создать, заблокировать, тариф, продлить, удалить
├── 👥 Пользователи   — список, роль, сброс пароля, удалить
├── 🔬 Diagnostics    — модерация центров и лабораторий
├── 🏪 Marketplace    — модерация поставщиков и товаров
├── 📚 Academy        — модерация курсов и лекторов
├── 🧠 AI Governance  — мониторинг AI запросов, логов, модель
├── 💰 Platform Finance — доход, подписки, комиссии
├── 📋 Audit          — полный лог платформы
├── 🛡️ Security       — compliance, сессии, consent
├── 💾 Backups        — управление
└── 🎧 Support        — ассистенты поддержки
```

### 5.3. Super Admin pages (auth.store.ts)

**Текущие** (74 строки пользовательских CRM страниц):
```typescript
pages: ['dashboard', 'schedule', 'patients', 'medical-card', 'visits', 'icd10', 'documents', 'finance', 'cashier', 'pricelist', 'lab', 'reminders', 'promotions', 'inventory', 'admin', 'audit', 'backup', 'shop', 'school', 'analytics', 'settings', 'clinic-settings', 'billing', 'staff', 'treatment-plans', 'dental-chart']
```

**Новые** (только платформенные страницы):
```typescript
pages: ['admin', 'audit', 'backup', 'analytics', 'settings', 'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'platform-finance', 'ai-governance', 'security', 'support']
```

### 5.4. Что видит Super Admin в сайдбаре

Super admin НЕ видит обычные сервисы (CRM, Shop, School, Community, Jobs). Вместо этого:
- Администрирование (по умолчанию раскрыто)
  - Dashboard — /admin
  - Клиники — /admin
  - Пользователи — /admin
  - Diagnostics — /admin
  - Marketplace — /admin
  - Academy — /admin
  - AI Governance — /admin
  - Platform Finance — /admin
  - Audit — /audit
  - Security — /security
  - Backups — /backup
  - Support — /admin
- Платформа
  - Настройки — /settings
  - Профиль — /profile

## 6. Sidebar — ролевая видимость

### 6.1. Что видит каждая роль

```
SUPERADMIN:
  🛡️ Платформа (все табы на /admin)
  ├── Dashboard, Клиники, Пользователи, Diagnostics, Marketplace,
  │   Academy, AI Governance, Platform Finance, Support
  ├── 📋 Аудит — /audit
  ├── 🛡️ Security — /security
  └── 💾 Бэкапы — /backup
  ⚙️ Настройки — /settings
  👤 Профиль — /profile

OWNER / DIRECTOR (всё):
  🏥 DentVision CRM → /crm/schedule
  🧠 DentVision AI → /
  🔬 DentVision Diagnostics → /diagnostics
  📚 DentVision Academy → /school
  🏪 DentVision Marketplace → /shop
  📊 DentVision Analytics → /analytics
  👥 DentVision Community → /community
  🛡️ Администрирование (Dashboard, Аудит, Бэкапы)
  ⚙️ Настройки / Профиль

ADMIN:
  🏥 DentVision CRM
  🧠 DentVision AI
  🔬 DentVision Diagnostics
  📚 DentVision Academy
  🏪 DentVision Marketplace
  📊 DentVision Analytics
  ⚙️ Настройки / Профиль

DOCTOR:
  🏥 DentVision CRM
  🧠 DentVision AI
  🔬 DentVision Diagnostics
  📚 DentVision Academy
  🏪 DentVision Marketplace
  👥 DentVision Community
  👤 Профиль

ASSISTANT:
  🏥 DentVision CRM
  🔬 DentVision Diagnostics
  👤 Профиль

RECEPTION:
  🏥 DentVision CRM
  👤 Профиль
```

### 6.2. Файлы для изменения Sidebar

1. `src/layouts/Sidebar.tsx` — NAV_ITEMS разделить на user + superadmin
2. `src/store/auth.store.ts` — обновить `pages` для всех ролей (+ diagnostics)
3. `src/lib/roleAccess.ts` — добавить diagnostics пути в PATH_PAGE_ID

## 7. Конкретные изменения файлов

### Файл: `src/store/auth.store.ts`

**superadmin pages** (было 26 user pages → стало 12 platform pages):
```typescript
superadmin: {
  label: 'Super Admin',
  icon: '⚙️',
  pages: ['admin', 'audit', 'backup', 'analytics', 'settings', 'security',
    'diagnostics', 'diagnostics-centers', 'diagnostics-labs',
    'platform-finance', 'ai-governance', 'support'],
  canSeeSuperAdmin: true,
  canAddStaff: false,    // superadmin не добавляет сотрудников в клиники
  canSeeAudit: true,
  canBackup: true,
  canManageClinicSettings: true,
  canManageFinance: true,
}
```

**owner/director** — добавить `diagnostics`, `diagnostics-referrals`:
```typescript
pages: [...старые..., 'diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-labs', 'diagnostics-results']
```

**admin** — добавить `diagnostics`, `diagnostics-referrals`, `diagnostics-results`

**doctor** — добавить `diagnostics-referrals`, `diagnostics-results`

**assistant** — добавить `diagnostics-referrals`

### Файл: `src/lib/roleAccess.ts`

Добавить:
```typescript
'/diagnostics': 'diagnostics',
'/diagnostics/referrals': 'diagnostics-referrals',
'/diagnostics/centers': 'diagnostics-centers',
'/diagnostics/laboratories': 'diagnostics-labs',
'/diagnostics/results': 'diagnostics-results',
'/diagnostics/calendar': 'diagnostics-calendar',
'/diagnostics/statistics': 'diagnostics-statistics',
'/diagnostics/settings': 'diagnostics-settings',
```

### Файл: `src/layouts/Sidebar.tsx`

Для superadmin — не показывать NAV_ITEMS (CRM, Shop, School, etc.), показать только админ-панель.
Sidebar фильтр:

```typescript
const isSuperAdmin = authRole === 'superadmin';

// Super admin не видит user-сервисы
if (isSuperAdmin) {
  // Показываем только: admin, audit, security, backup, settings, profile
} else {
  // Показываем NAV_ITEMS как сейчас
}
```

---

## 8. Итоговая дорожная карта

```
┌─────────────────────────────────────────────────────────────┐
│ Фаза 0 — Super Admin + Role System                 [3 дня]  │
│   • Обновить superadmin pages (убрать user-страницы)        │
│   • Переписать SuperAdmin.tsx — 10+ табов платформы        │
│   • Обновить sidebar — superadmin видит только админку    │
│   • Обновить roleAccess.ts                                  │
│   • Diagnostics в pages для всех ролей                      │
├─────────────────────────────────────────────────────────────┤
│ Фаза 1 — Diagnostics Foundation                   [4 дня]   │
│   • DiagnosticsLayout + Dashboard skeleton                  │
│   • Prisma models, migrations                               │
│   • API: centers, labs, studies                             │
│   • Роуты /diagnostics/*                                   │
├─────────────────────────────────────────────────────────────┤
│ Фаза 2 — Referrals System                         [4 дня]   │
│   • Form + ToothSelector + FileUpload                       │
│   • Referral workflow (10 статусов)                         │
│   • Right panel (details, timeline, comments)               │
├─────────────────────────────────────────────────────────────┤
│ Фаза 3 — Results + Reports                        [3 дня]   │
│   • ReportEditor + PDF + DICOM/STL viewer                   │
│   • ResultTimeline + ResultViewer                           │
├─────────────────────────────────────────────────────────────┤
│ Фаза 4 — Centers + Booking                        [3 дня]   │
│   • CenterDashboard + Queue                                 │
│   • Online booking + Map                                    │
│   • Calendar                                                │
├─────────────────────────────────────────────────────────────┤
│ Фаза 5 — AI Integration                           [3 дня]   │
│   • Diagnostics AI tools                                    │
│   • AI suggestions in form + report generation              │
│   • Jarvis Briefing integration                             │
├─────────────────────────────────────────────────────────────┤
│ Фаза 6 — Finance + Statistics                     [2 дня]   │
│   • Diagnostic finance (cost, payment)                      │
│   • Statistics (counts, avg time, revenue, popular)         │
├─────────────────────────────────────────────────────────────┤
│ Фаза 7 — QA, Polish, Performance                 [2 дня]   │
│   • Audit logging all actions                               │
│   • Role-based access audit                                 │
│   • Error boundaries + loading states                       │
│   • Mobile responsive                                       │
└─────────────────────────────────────────────────────────────┘
```

**Общий срок: ~24 дня при full-time работе одного разработчика.**
**Начинаем с Фазы 0**: Super Admin redesign + роли + sidebar.
