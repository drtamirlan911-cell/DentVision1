# 15 — AI Agents Operating System (DentVision AI OS)

**Version:** 1.0
**Status:** Core Architecture
**Relation to §04:** §04 определяет пользовательский опыт AI (workspace, память, safety, публичный roster из 10 агентов). Эта глава определяет **внутреннюю операционную систему агентов** — полную сеть специализированных агентов, оркестрацию, жизненный цикл и governance. Публичный roster §4.4 — это витрина; AI OS — машинное отделение.

---

## 15.1 Концепция

DentVision AI OS — это интеллектуальная операционная система, объединяющая специализированных ИИ-агентов, которые совместно выполняют задачи пользователя.

**Пользователь общается только с одним AI Assistant.** Внутри работает сеть специализированных агентов.

```text
DentVision AI
     ↓
AI Orchestrator
     ↓
специализированные агенты
     ↓
единый ответ пользователю
```

Инвариант UX: пользователь никогда не «переключается между ботами». Один диалог, одна личность, один ответ.

---

## 15.2 Архитектура

```text
                         USER
                           │
                           ▼
                DentVision AI Assistant
                           │
                    AI Orchestrator
                           │
 ┌────────────────────────────────────────────────────┐
 │ Clinical        │ Business       │ Marketplace     │
 │ Education       │ Compliance     │ Security        │
 │ Finance         │ Analytics      │ Automation      │
 │ Communication   │ Knowledge      │ Infrastructure  │
 └────────────────────────────────────────────────────┘
```

---

## 15.3 AI Orchestrator

Главный управляющий агент. Он:

1. понимает запрос;
2. выбирает агентов;
3. запускает их;
4. объединяет результаты;
5. проверяет конфликты;
6. формирует финальный ответ.

Пример: *«Подготовь лечение пациента, закажи материалы и запиши меня на курс.»*

Оркестратор одновременно вызывает:

- Diagnosis Agent
- Treatment Planner
- Shop Agent
- School Agent
- Finance Agent

Пользователь этого не замечает.

---

## 15.4 Clinical Intelligence Layer

| Agent | Mandate |
|-------|---------|
| **Patient Agent** | Пациенты, медицинская карта, анамнез, посещения |
| **Diagnosis Agent** | Симптомы, снимки, фотографии, данные осмотра. Выдаёт варианты; окончательное решение принимает врач |
| **CBCT Agent** | DICOM, сегментация, измерения, анатомия, имплантация |
| **Smile Design Agent** | Цифровая улыбка, визуализация, варианты лечения |
| **Prosthodontic Agent** | Ортопедия, виниры, коронки, мосты, окклюзия |
| **Orthodontic Agent** | Элайнеры, брекеты, анализ прикуса |
| **Surgery Agent** | Имплантация, синус-лифтинг, удаление, хирургические шаблоны |
| **Treatment Planner** | Полный план лечения |
| **Clinical Protocol Agent** | Сверка лечения с клиническими рекомендациями, внутренними стандартами, законодательством |

---

## 15.5 Marketplace Intelligence

| Agent | Mandate |
|-------|---------|
| **Shop Agent** | Поиск товаров |
| **Product Expert Agent** | Сравнение товаров |
| **Procurement Agent** | Формирование закупки |
| **Supplier Agent** | Работа с поставщиками |
| **Inventory Agent** | Контроль остатков |
| **Logistics Agent** | Контроль доставки |

---

## 15.6 Education Intelligence

| Agent | Mandate |
|-------|---------|
| **School Agent** | Поиск обучения |
| **Course Builder Agent** | Создание курсов |
| **Lecturer Assistant** | Помощь преподавателям |
| **Student Mentor** | Персональный наставник |
| **Examination Agent** | Проверка знаний |
| **Certification Agent** | Выдача сертификатов |

---

## 15.7 Business Intelligence

| Agent | Mandate |
|-------|---------|
| **CEO Agent** | Рекомендации владельцу клиники |
| **Financial Agent** | Прибыль, расходы, подписки, выплаты |
| **Marketing Agent** | Реклама, SEO, соцсети, удержание пациентов |
| **HR Agent** | Вакансии, подбор персонала, обучение |
| **Analytics Agent** | Отчёты |

---

## 15.8 Compliance Layer

| Agent | Mandate |
|-------|---------|
| **Kazakhstan Compliance Agent** | Соответствие законодательству РК |
| **Medical Compliance Agent** | Соблюдение медицинских требований |
| **AI Governance Agent** | Контроль работы ИИ |
| **Privacy Agent** | Персональные данные |
| **Audit Agent** | Полный журнал действий |

---

## 15.9 Security Layer

| Agent | Mandate |
|-------|---------|
| **Cyber Security Agent** | Безопасность |
| **Fraud Detection Agent** | Выявление мошенничества |
| **Access Control Agent** | Управление правами доступа |

---

## 15.10 Communication Layer

| Agent | Mandate |
|-------|---------|
| **Voice Agent** | Голосовой ассистент |
| **Translator Agent** | Перевод на разные языки |
| **Call Assistant** | Телефонные звонки |
| **Chat Agent** | Все переписки |

---

## 15.11 Automation Layer

| Agent | Mandate |
|-------|---------|
| **Workflow Agent** | Автоматизация процессов |
| **Scheduler Agent** | Управление расписанием |
| **Reminder Agent** | Напоминания о задачах |
| **Notification Agent** | Отправка уведомлений |

---

## 15.12 Knowledge Layer

| Agent | Mandate |
|-------|---------|
| **Research Agent** | Анализ публикаций |
| **Scientific Agent** | Научная литература |
| **Knowledge Graph Agent** | Единая база знаний |
| **Learning Agent** | Предпочтения пользователя (в пределах настроек и политики платформы) |

---

## 15.13 Infrastructure Layer

| Agent | Mandate |
|-------|---------|
| **API Agent** | Управление API |
| **Integration Agent** | Интеграции |
| **Database Agent** | Контроль данных |
| **Cloud Agent** | Инфраструктура |

---

## 15.14 Multi-Agent Collaboration

Каждый запрос разбивается на задачи.

Пример: *«Запланируй имплантацию 36 зуба.»*

```text
User
 ↓
AI Orchestrator
 ↓
Patient Agent          — контекст пациента, карта, анамнез
 ↓
CBCT Agent             — снимки, анатомия, объём кости
 ↓
Diagnosis Agent        — клиническая оценка (draft)
 ↓
Treatment Planner      — план имплантации по этапам
 ↓
Clinical Protocol Agent — сверка с протоколами и правом
 ↓
Shop Agent             — материалы и имплантационная система
 ↓
Finance Agent          — стоимость, счёт, план оплаты
 ↓
Calendar Agent         — слоты под этапы
 ↓
Unified Response       — один связный ответ пользователю
```

Правила цепочек:

- Оркестратор строит DAG задач; независимые ветки исполняются параллельно.
- Каждый агент возвращает результат + провенанс (на чём основан вывод).
- Конфликты результатов разрешает оркестратор (при клиническом конфликте — эскалация врачу, не автоматическое решение).

---

## 15.15 AI Memory System

Каждый агент использует четыре уровня памяти:

```text
Session Memory        — контекст текущей сессии
 ↓
Patient Memory        — данные пациента (при наличии прав)
 ↓
Organization Memory   — знания конкретной организации
 ↓
Global Knowledge      — общая база знаний
```

Соответствие слоям §4.3.2: Session ⊂ Working/Conversation Memory; Patient ⊂ Org Knowledge Graph (RBAC-filtered); Organization ⊂ Org Knowledge Graph; Global ⊂ Long-term Facts. Правила §4.3.3 (permission filter, no cross-org leakage, «забудь это») обязательны для всех уровней.

---

## 15.16 AI Governance Rules

Каждый агент обязан:

1. работать только в пределах своих полномочий;
2. передавать задачи профильным агентам;
3. журналировать действия;
4. объяснять основания своих выводов, где это возможно;
5. учитывать законодательные ограничения;
6. выполнять контроль качества перед передачей результата пользователю.

---

## 15.17 AI Operating States

Все агенты используют единый жизненный цикл:

```text
IDLE → UNDERSTAND → PLAN → SELECT TOOLS → EXECUTE
     → VERIFY → COMPLIANCE CHECK → MERGE RESULTS
     → RESPOND → LEARN
```

| State | Обязанность |
|-------|-------------|
| IDLE | Ожидание; ресурсы не потребляются |
| UNDERSTAND | Разбор задачи от оркестратора, проверка полномочий |
| PLAN | Декомпозиция; при выходе за мандат — возврат оркестратору |
| SELECT TOOLS | Только инструменты из Allowed Tools реестра |
| EXECUTE | Исполнение; side effects только через Action Registry (§4.6 confirm policy) |
| VERIFY | Самопроверка результата |
| COMPLIANCE CHECK | Прогон через Compliance Layer при клинических/финансовых/персональных данных |
| MERGE RESULTS | Отдача результата с провенансом оркестратору |
| RESPOND | Только оркестратор говорит с пользователем |
| LEARN | Writeback в память в пределах политики (§4.3.3) |

---

## 15.18 Agent Registry

Каждый агент регистрируется в едином каталоге:

| Поле | Описание |
|------|----------|
| Agent ID | Уникальный идентификатор (`agent.<domain>.<name>`) |
| Name | Название агента |
| Domain | Область ответственности (слой из §15.4–15.13) |
| Version | Версия |
| Required Permissions | Необходимые права |
| Allowed Tools | Доступные инструменты |
| Required Models | Используемые модели ИИ |
| Owner | Ответственная команда |
| Status | Active / Beta / Disabled |

Registry — единственный источник правды о том, какие агенты существуют и что им разрешено. Незарегистрированный агент не может быть вызван оркестратором.

---

## 15.19 Mapping to Current Implementation

**Source reconciliation — 2026-11-15.** This section describes the code currently present on the audit candidate branch. It is not a production deployment claim. For cabinet-level completeness use `docs/SYSTEM_AUDIT.md`; for release blockers use `docs/RELEASE_BLOCKERS.md`.

| AI OS layer | Current source implementation | Verified boundary / remaining gap |
|------------|-------------------------------|-----------------------------------|
| Orchestrator | `dentvision-backend/src/modules/ai/os/orchestrator.ts`; deterministic fallback in `core/ai.service.ts` | Real role-filtered tool planning, bounded sequential tool rounds, persona resolution and merged response. Full DAG decomposition, parallel agent chains and conflict-resolution graph are not implemented. |
| Registry | `dentvision-backend/src/modules/ai/os/registry.ts` | Central typed registry defines agent IDs, domains, mandates, role access, allowed tools and persona tags. It replaces the old hard-coded-only description below; it is not yet a dynamic externally managed registry. |
| Operational personas | `dentvision-backend/src/modules/ai/os/persona.ts`; `orchestrator.ts` | Eight operational personas (Doctor, Reception, Analyst, Finance, Supply, Education, Marketing, CEO) resolve by explicit call, intent, stage and role. Guest is a safe fallback persona. Persona resolution does not imply every persona workflow is complete. |
| Clinical | Registry entries `agent.clinical.*`; `tools.ts`; clinical domain services | Patient, treatment-planner, dental, radiology, endodontic, orthopedic, orthodontic and lab-oriented agent definitions exist. Specialist depth, imaging/CBCT acquisition and full clinical DAG handoff remain partial. |
| Business | Registry entries `agent.business.finance`, `analytics`, `marketing`, `ceo` | Finance/analytics and CEO brief paths exist; Marketing has a registered persona/tool surface. Full autonomous business workflows, approval coverage and outcome measurement remain partial. |
| Marketplace / Supply | Registry entries in the marketplace domain; supplier/shop services and workspace routes | Product, supplier, stock, order and seller operations exist. Procurement recommendations, logistics orchestration and complete return/refund/settlement flows remain partial. |
| Education | Registry education agents; School course, exam, tutor and lecturer services | Learner/course/tutor primitives exist. Course Builder, Mentor and Certification agent depth and complete academy-owner lifecycle remain partial. |
| Compliance | Clinical safety rules, permission checks, confirmation gates and legal/compliance domain code | Safety controls exist outside a complete dedicated AI Compliance Agent. The autonomous compliance layer described in §15.8 is not complete. |
| Security | RBAC middleware, scoped registry tool exposure, organization/branch context and audit services | Authorization is enforced by platform services; a dedicated fraud-detection agent and full tenant/role negative matrix are not complete. |
| Communication | AI chat, provider streaming, notification and conversation services | Text interaction exists. Full voice, translation and call workflows are not implemented as the documented agent layer. |
| Automation | Reminder/workflow jobs, event subscribers and clinic-scoped AI Employee task/approval paths | Durable automation exists in selected domains. A universal scheduler/workflow agent and ecosystem-wide non-clinic task queues are not proven. |
| Knowledge / Memory | `dentvision-backend/src/modules/ai/memory/memory.engine.ts`, learning services and scoped retrieval | Session/long-term memory and learning primitives exist. A complete knowledge graph/research-agent layer, full deletion/retention lifecycle and historical PHI protection remain open under RB-029. |
| Infrastructure | Platform deployment, observability and operational services | No autonomous infrastructure-agent layer matching §15.13 is verified. |
| Lifecycle | `orchestrator.ts` request flow and confirmation-aware tool execution | Understand → plan/select tools → execute → verify/correct → merge → respond is implemented as a bounded request flow. A persisted universal IDLE…LEARN state machine and multi-agent DAG lifecycle are not implemented. |

**Interpretation rule:** a registered agent or visible persona is not proof of an end-to-end cabinet workflow. Verify each capability against its real tool, permission scope, persisted outcome, audit event, failure path and E2E evidence. The current implementation is a meaningful AI OS foundation, not full completion of every capability in §§15–16.

**Release boundary:** do not close RB-029, RB-034, RB-035 or any clinical/financial safety blocker merely because the orchestrator or registry exists. The exact negative authorization matrix, historical PHI inventory/key lifecycle, and staging/production evidence remain independent gates.

---

## 15.20 Priority Rule

При конфликте слоёв:

1. **[§16 — AI Strategy](./16-AI-STRATEGY.md)** — пользовательский контракт **8 операционных персон** + Jarvis (роутинг, мандаты, фазы).
2. **§04** — clinical specialty, memory doctrine, safety UX (Radiology/Ortho… под Doctor).
3. **Эта глава (§15)** — внутренняя архитектура оркестрации, registry schema, lifecycle.

Business gap из §15.19 («нет CEO/Marketing») закрывается агентами `agent.business.marketing` / `agent.business.ceo` с тегом `persona` — см. §16.
