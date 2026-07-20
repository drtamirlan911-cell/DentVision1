# 05 — CRM (Workspace)

## 5.1 Positioning

CRM — **самая важная функция** DentVision (P0).

Эталон: не «средняя dental CRM», а **лучшее, что существует в категории practice OS** — глубина клиники + автоматизация уровня top-tier ops tools + AI-native управление.

CRM появляется как Workspace после выбора организации.  
В IA платформы CRM не конкурирует с AI: AI управляет CRM.

---

## 5.2 Product Goal

Максимально автоматизировать рутину клиники, чтобы врач/админ/владелец тратили время на решения, а не на ввод данных.

**Automation promise**
- Запись сама напоминает и подтверждает
- No-show и переносы предлагаются автоматически
- Планы лечения ведут пациента по этапам
- Склад сам говорит, что докупить
- Документы генерируются из визита
- Финансы связывают услугу → счёт → оплату → отчёт

---

## 5.3 Mandatory Sections (canonical)

Следующие разделы **обязательны** в CRM:

| Section | Route (logical) | Owner persona |
|---------|-----------------|---------------|
| **Расписание** | `/crm/schedule` | Admin, Doctor |
| **Пациенты** | `/crm/patients` | Doctor, Admin |
| **Финансы** | `/crm/finance` (cashier + reports) | Owner, Cashier, Admin |
| **Склад** | `/crm/inventory` | Admin, Owner, Buyer |
| **Документы** | `/crm/documents` | Admin, Doctor |
| **Зубная карта** | `/crm/dental-chart` (patient-scoped) | Doctor |
| **Планы лечения** | `/crm/treatment-plans` | Doctor, Admin |

Дополнительно (strongly recommended, уже в продуктовой карте):

- Визиты / journal
- Прайс-лист
- Лабораторные заказы
- Сотрудники
- Акции
- ICD-10 / справочники
- Медицинская карта пациента (container для chart + plans + docs)

---

## 5.4 Section Specs

### 5.4.1 Расписание (Schedule)

**Must-have**
- Day / week / doctor / chair views
- Drag-and-drop reschedule
- Conflict detection (doctor, chair, patient double-book)
- Status pipeline: requested → confirmed → arrived → in_chair → done / no_show / cancelled
- Color coding by type / doctor / status
- Waitlist + auto-offer freed slots
- AI: «Найди окно для эндо к пятнице» → предложения слотов

**Automation**
- SMS/WhatsApp/push confirmations
- Auto-reminders T-24h / T-2h
- No-show probability hints
- Overbooking policy per clinic

### 5.4.2 Пациенты (Patients)

**Must-have**
- Global search (name, phone, IIN/local ID, card no.)
- Patient 360: contacts, tags, allergies, balance, next visit, open plans
- Duplicate merge
- Segmentation (VIP, debtor, inactive)
- AI natural-language search: «пациенты без визита 6 месяцев с открытым планом»

### 5.4.3 Финансы (Finance)

**Must-have**
- Касса дня
- Счета / чеки / оплаты (cash, card, transfer, mixed)
- Долги и частичные оплаты
- Привязка оплаты к визиту / этапу плана
- Возвраты
- Отчёты: день / врач / услуга / филиал
- AI Finance agent integration

**Automation**
- Auto-invoice from completed stage
- Dunning sequences for debtors (policy-based)
- Daily cash close checklist

### 5.4.4 Склад (Inventory)

**Must-have**
- Номенклатура, партии, сроки годности
- Min/max thresholds
- Приход / расход / списание / перемещение
- Привязка расхода к визиту/процедуре (где применимо)
- One-click «заказать в Marketplace» из критичных остатков
- AI: прогноз расхода и purchase list

### 5.4.5 Документы (Documents)

**Must-have**
- Шаблоны согласий, актов, договоров, выписок
- Генерация из данных пациента/визита
- E-sign flow (token link)
- Versioning + audit trail
- Attachments (снимки, PDF, lab files)
- AI draft documents from visit summary

### 5.4.6 Зубная карта (Dental Chart)

**Must-have**
- FDI notation (default for region; configurable)
- Per-tooth status & surfaces
- Conditions, existing restorations, planned work
- Visual odontogram interactive
- History timeline of chart changes
- Link tooth ↔ treatment plan item ↔ visit procedure
- AI assist: заполнение/предложение на основе описания и снимков (draft)

### 5.4.7 Планы лечения (Treatment Plans)

**Must-have**
- Multi-stage plans with statuses
- Cost estimate + approved budget
- Patient-facing explanation mode
- Stage completion → schedule next + invoice hooks
- Alternatives (Plan A/B)
- Consent linkage
- AI: generate plan draft from diagnosis + chart + specialty agent

---

## 5.5 World-Class CRM Feature Pack (дифференциаторы)

Обязательно стремиться к этому набору (не optional wishlist без приоритета — это definition of best-in-class):

1. **AI command CRM** — любая операция доступна из чата
2. **Zero-dead-end forms** — формы с smart defaults и validation
3. **Realtime multi-user** — ресепшен и врач видят изменения live
4. **Clinic protocols** — шаблоны визитов по специализациям
5. **Smart recall** — реактивация пациентов
6. **Lab loop** — заказ ↔ статус ↔ примерка ↔ remake
7. **Cross-branch patient** (network orgs) с ACL
8. **Audit everything** clinical/financial
9. **Offline-tolerant schedule view** (read) + sync queue (phased)
10. **Outcome tracking** — план выполнен / сорван / почему

---

## 5.6 CRM Object Model (logical)

```text
Organization
  └── Clinic / Branch
        ├── Staff Memberships
        ├── Schedule Resources (doctors, chairs)
        ├── Patients
        │     ├── Dental Chart
        │     ├── Treatment Plans → Stages → Procedures
        │     ├── Visits
        │     ├── Documents
        │     └── Balances / Invoices / Payments
        ├── Inventory Items / Stock Moves
        ├── Price List / Promotions
        └── Lab Orders
```

---

## 5.7 Role × CRM Access (summary)

| Section | Doctor | Owner | Admin | Buyer |
|---------|--------|-------|-------|-------|
| Schedule | R/W own+clinic policy | R (all) | R/W | — |
| Patients | R/W clinical | R | R/W ops | — |
| Finance | R limited | R/W | R/W ops | — |
| Inventory | R | R/W | R/W | R + order |
| Documents | R/W clinical | R | R/W | — |
| Dental Chart | R/W | R | R (policy) | — |
| Treatment Plans | R/W | R | R/W assist | — |

Точная матрица — в Platform Core RBAC (§10).

---

## 5.8 AI × CRM Playbook (examples)

| User says | System does |
|-----------|-------------|
| «Запиши Сабину на чистку в четверг утром» | Reception AI → slots → confirm card → create |
| «Открой зубную карту 26» | Navigate + chart context |
| «Собери план имплантации» | Specialty agents → draft plan + finance estimate |
| «Что закончилось на складе?» | Inventory query → Marketplace deep links |
| «Кто должен больше 100k?» | Finance AI list + one-click reminders |

---

## 5.9 Acceptance Criteria (CRM P0)

- [ ] Все 7 обязательных разделов доступны в production navigation
- [ ] Создание записи, пациента, плана, оплаты — из UI и из AI
- [ ] Зубная карта связана с планом и визитом
- [ ] Склад умеет порождать заказ в Marketplace
- [ ] Документ генерируется из визита и уходит на подпись
- [ ] Автонапоминания и долги работают без ручного экспорта в Excel
- [ ] Нет сценария «данные есть в одном разделе и невидимы в связанном»
