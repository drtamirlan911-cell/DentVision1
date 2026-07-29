# 16 — AI Strategy: 8 операционных персон

**Статус:** Canonical · Product Strategy  
**Связь:** [§04 AI Intelligence](./04-AI-INTELLIGENCE.md) · [§15 AI Agents OS](./15-AI-AGENTS-OS.md) · registry `dentvision-backend/src/modules/ai/os/registry.ts`

---

## 16.1 Принцип — AI = центр ОС

DentVision — **AI Operating System**. Пользователь всегда говорит с **одним Jarvis**.

Внутри Jarvis переключается между **8 операционными персонами** по роли, экрану и намерению. Клинические specialty-агенты из §4.4 (Radiology, Ortho, Endo…) **подчинены AI Doctor** и не конкурируют с этими 8 на верхнем уровне.

```text
User → Jarvis Facade → Persona Router → {Doctor|Reception|Analyst|Finance|Supply|Education|Marketing|CEO}
                                              ↓
                                         Platform Tools (CRM / Shop / School / …)
```

**Решение по умолчанию (зафиксировано):**

1. **Один чат, много персон** — не 8 отдельных приложений.
2. **CEO = оркестратор персон**, не отдельная модель с полным доступом ко всему в обход RBAC.
3. **Marketing и CEO** — первые новые registry-агенты; остальное — усиление существующих.
4. Persona shortcuts без LLM (`deterministicShortcuts`) остаются обязательными.

---

## 16.2 Два слоя (не путать спеки)

| Слой | Что это | Где живёт |
|------|---------|-----------|
| **Операционные персоны (эта глава)** | Doctor / Reception / Analyst / Finance / Supply / Education / Marketing / CEO | §16 + `persona` tags в registry |
| **Клинические specialty** | Radiology, Ortho, Endo… | Под AI Doctor; §4.4 |
| **Внутренний OS** | Registry, tools, lifecycle | §15 + `registry.ts` / orchestrator |

**Правило приоритета для пользователя:** контракт = **8 персон + Jarvis**. Specialty вызываются явно («опиши снимок») или из Doctor.

При конфликте слоёв:

1. §16 — пользовательский контракт персон и роутинг.
2. §04 — клинические specialty, memory, safety UX.
3. §15 — внутренняя оркестрация, registry schema, lifecycle.

---

## 16.3 Мандаты 8 персон

### 16.3.1 AI Doctor

| | |
|--|--|
| **Кто** | Врач у кресла / в карте |
| **Делает** | Пациент, одонтограмма, план лечения, визиты, клинические подсказки (draft), маршрутизация в specialty |
| **Не делает** | Оплату без confirm; диагнозы как финальный вердикт |
| **Inputs** | Пациент / зубная карта / план / снимок (по ACL) |
| **Tools (сейчас)** | `searchPatients`, `getPatientCard`, `getVisits`, `getTreatmentPlans`, `createTreatmentPlan`, `navigate` |
| **Outputs** | Draft плана, навигация в карту, клинический next step |
| **Safety** | Клиника = assistive; мутации — confirm; specialty findings — draft |
| **Success** | Утро врача без выхода из чата: карта → план → контроль |
| **Registry** | `agent.clinical.patient`, `agent.clinical.treatment-planner` · persona `doctor` |
| **Дальше** | Явный persona-id в UI; CBCT-assist draft; «продолжи план» по зубной карте |

### 16.3.2 AI Reception

| | |
|--|--|
| **Кто** | Администратор / ресепшн |
| **Делает** | Запись, конфликты, лист ожидания, no-show, подтверждения, загрузка слотов |
| **Не делает** | Клинические диагнозы; смену прайса без роли |
| **Inputs** | Расписание, пациенты, load plan |
| **Tools** | `getSchedule`, `createAppointment`, `updateAppointmentStatus`, `cancelAppointment`, `rescheduleAppointment`, `getClinicLoadPlan`, … |
| **Outputs** | Конкретные слоты, имена, телефоны, действия confirm |
| **Safety** | Mutate appointment — confirm; RBAC clinic-scoped |
| **Success** | «Заполни слабые окна» → список действий за < 1 ответ |
| **Registry** | `agent.clinical.reception` · persona `reception` |
| **Дальше** | Mass-confirm, waitlist tools, сценарий заполнения окон |

### 16.3.3 AI Analyst

| | |
|--|--|
| **Кто** | Владелец / директор «что происходит» |
| **Делает** | KPI дня/недели, загрузка врачей, воронка, аномалии, briefing |
| **Не делает** | SQL в обход tools; выдуманные цифры |
| **Inputs** | Dashboard, revenue, utilization, load signals |
| **Tools** | `getDashboardStats`, `getRevenue`, `getDoctorUtilization`, `getClinicLoadPlan`, `getDebtors` |
| **Outputs** | Краткие KPI + «почему» + next step |
| **Safety** | Только read tools; цифры из данных |
| **Success** | «Почему упала выручка» → сравнение периодов с фактами |
| **Registry** | `agent.business.analytics` · persona `analyst` |
| **Дальше** | Сравнение периодов, cohort recall |

### 16.3.4 AI Finance

| | |
|--|--|
| **Кто** | Касса / бухгалтер / owner |
| **Делает** | Выручка, долги, P&L, ФОТ, расходы, «кого бить по долгам» |
| **Не делает** | Списание/оплату без confirm |
| **Inputs** | Invoices, debtors, payroll/expenses (по мере tools) |
| **Tools** | `getRevenue`, `getDebtors`, `createInvoice`, `navigate` |
| **Outputs** | Цифры + список должников + CTA |
| **Safety** | Финансовые мутации — hard confirm + audit |
| **Success** | Закрытие дня / список долгов без ручного Excel |
| **Registry** | `agent.business.finance` · persona `finance` |
| **Дальше** | Payroll/expenses tools, закрытие дня, экспорт |

### 16.3.5 AI Supply

| | |
|--|--|
| **Кто** | Закупщик / склад / supplier |
| **Делает** | Остатки, дозаказ в Shop, сравнение поставщиков, заявки |
| **Не делает** | Клинические диагнозы |
| **Inputs** | Inventory, Shop catalog |
| **Tools** | `getInventory`, `searchProducts`, `navigate` (+ buyer/supplier agents) |
| **Outputs** | «Заканчивается → корзина» список |
| **Safety** | Заказ оформляет пользователь через корзину |
| **Success** | Min-stock → конкретные SKU к дозаказу |
| **Registry** | `agent.marketplace.inventory`, `agent.marketplace.shop`, buyer/supplier · persona `supply` |
| **Дальше** | Auto-restock, supplier pricing assist |

### 16.3.6 AI Education

| | |
|--|--|
| **Кто** | Врач-ученик / лектор / академия |
| **Делает** | Курсы, вебинары, mentor Q&A, треки, кабинет лектора |
| **Не делает** | CRM чужой клиники |
| **Inputs** | School catalog, twin specialization |
| **Tools** | `searchCourses`, `navigate` |
| **Outputs** | Рекомендации курсов с обоснованием |
| **Safety** | Образовательный контент ≠ клинический вердикт |
| **Success** | Курс под специализацию twin за 1 ответ |
| **Registry** | `agent.education.school`, `agent.education.lecturer` · persona `education` |
| **Дальше** | Tutor по кейсу |

### 16.3.7 AI Marketing

| | |
|--|--|
| **Кто** | Owner / маркетолог клиники |
| **Делает** | Акции, reactivation базы, тексты акций, прайс-промо, WhatsApp-шаблоны |
| **Не делает** | Массовую рассылку без confirm / политики клиники |
| **Inputs** | Promotions, recall list, price list |
| **Tools** | `getPromotions`, `getRecallList`, `draftPromoCopy`, `navigate` |
| **Outputs** | Список акций / пациентов на reactivation / draft текста |
| **Safety** | Draft-only для текстов; отправка — вне AI или confirm |
| **Success** | «Кого вернуть + текст акции» за один ход |
| **Registry** | `agent.business.marketing` · persona `marketing` |

### 16.3.8 AI CEO

| | |
|--|--|
| **Кто** | Owner / multi-clinic director |
| **Делает** | Синтез Analyst + Finance + Marketing (+ HR signals): «что важно», приоритеты недели, риски, план действий |
| **Не делает** | Прямой SQL / обход RBAC; сам не пишет мутации — делегирует |
| **Inputs** | Briefing + finance KPIs + load/recall + promotions |
| **Tools** | `composeCeoBrief`, read tools Analyst/Finance/Marketing, `navigate` |
| **Outputs** | Executive brief: 3–5 приоритетов + owners (персоны) |
| **Safety** | CEO видит только то, что роль OWNER/ADMIN уже может; RBAC неизменен |
| **Success** | Утренний brief с действиями без переключения экранов |
| **Registry** | `agent.business.ceo` · persona `ceo` |

---

## 16.4 Роутинг персон

Порядок (детерминировано → LLM):

1. **Role default** — DOCTOR→Doctor, CASHIER/ADMIN/RECEPTION→Reception, OWNER/DIRECTOR→CEO, BUYER→Supply, STUDENT/LECTURER→Education, GUEST→concierge (вне 8, `guest`)
2. **Stage from pathname** — `/crm/finance`→Finance, `/crm/schedule`→Reception, `/shop`→Supply, `/school`→Education, `/crm/promotions`→Marketing, `/analytics`→Analyst
3. **Intent override** — «долги»→Finance, «запиши»→Reception, «акция»→Marketing, «план лечения»→Doctor
4. **Явный вызов** — «как CEO», «спроси Marketing»

В UI: chip/бейдж **«Сейчас: AI Finance»** + возможность сменить персону (P0 badge; override в follow-up).

Код: `dentvision-backend/src/modules/ai/os/persona.ts` → поле `activePersona` в ответе оркестратора.

---

## 16.5 Матрица Role × Persona × Stage

| Role | Default persona | Типичные stage overrides |
|------|-----------------|--------------------------|
| OWNER / DIRECTOR | CEO | finance→Finance, promotions→Marketing, schedule→Reception, analytics→Analyst |
| ADMIN / RECEPTION / CASHIER | Reception | finance→Finance, patients/clinical→Doctor (soft) |
| DOCTOR / ASSISTANT | Doctor | schedule→Reception (запись), school→Education |
| MANAGER | Analyst | finance→Finance, promotions→Marketing |
| BUYER | Supply | — |
| SUPPLIER | Supply (seller scope) | — |
| LECTURER / STUDENT | Education | — |
| GUEST | Concierge | — |

---

## 16.6 Связь с §04 / §15

- **§04** остаётся каноном clinical specialty roster и memory/safety UX. Публичный «Marketing AI» / «Reception AI» из §4.4 мапятся на персоны §16; Radiology и пр. — **под Doctor**.
- **§15** — внутренний OS (registry schema, lifecycle, layers). Новые агенты `agent.business.marketing` / `agent.business.ceo` регистрируются по §15.18 с тегом `persona`.
- Пользовательский контракт персон = **§16**. Specialty UX = **§04**. Wiring = **§15 + код**.

---

## 16.7 Phased roadmap

| Фаза | Фокус |
|------|-------|
| **P0** | Спека §16 + persona tags на существующих agents + UI badge `activePersona` |
| **P1** | Marketing agent + tools + CEO brief composer (склейка briefing / finance / load) |
| **P2** | Doctor depth (plan/odontogram) + Reception automation |
| **P3** | Supply auto-restock + Education tutor |
| **P4** | Specialty clinical under Doctor (из §4.4) |

Экономика: deterministic shortcuts без LLM остаются обязательными на всех фазах.

---

## 16.8 Success metrics (persona layer)

| Metric | Target sense |
|--------|----------------|
| % ответов с корректным `activePersona` vs intent | > 90% на golden set |
| Time-to-first-action утром (OWNER) | Brief → CTA без смены экрана |
| Marketing recall list used / week | Growing with activations |
| Finance mutate without confirm | **0** |
| Clinical draft labeled as draft | 100% |

---

## 16.9 Implementation map (код)

| Артефакт | Путь |
|-----------|------|
| Persona resolve | `dentvision-backend/src/modules/ai/os/persona.ts` |
| Registry + tags | `dentvision-backend/src/modules/ai/os/registry.ts` |
| Orchestrator `activePersona` | `dentvision-backend/src/modules/ai/os/orchestrator.ts` |
| Marketing / CEO tools | `dentvision-backend/src/modules/ai/os/tools.ts` + `core/ceoBrief.ts` |
| UI badge | `src/components/intelligence/AIWorkspaceIndex.tsx` |
