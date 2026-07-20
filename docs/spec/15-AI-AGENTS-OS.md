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

Текущее состояние кода относительно этой главы (для инженеров):

| Слой AI OS | Сейчас в коде | Gap |
|------------|---------------|-----|
| Orchestrator | `dentvision-backend/src/modules/ai/core/ai.service.ts` + `agent.router.ts` (intent → agent) | Нет DAG-декомпозиции, нет параллельных цепочек, нет merge/conflict resolution |
| Clinical | `DoctorAgent` (поиск пациента, запись, карта, план, CBCT-заглушка) | Нет отдельных Diagnosis/CBCT/Surgery/Prosthodontic/Orthodontic агентов |
| Business | `OwnerAgent` (выручка, должники, счета) | Нет CEO/Marketing/HR агентов |
| Marketplace | `functions/shop.school.functions.ts` (частично) | Нет Procurement/Supplier/Logistics |
| Education | School exam engine + tutor endpoint | Нет Course Builder/Mentor/Certification агентов |
| Compliance | — | Слой отсутствует целиком |
| Security | RBAC middleware (не агент) | Нет Fraud Detection |
| Communication | Чат (текст) | Нет Voice/Translator/Call |
| Automation | Reminders UI (клиентский) | Нет Workflow/Scheduler агентов на сервере |
| Knowledge | `memory.engine.ts` (session/long memory) | Нет Knowledge Graph / Research агентов |
| Infrastructure | — | Слой отсутствует целиком |
| Registry | Хардкод-регистрация в `ai.service.ts` | Нет декларативного каталога со схемой §15.18 |
| Lifecycle | Нет явных состояний | Внедрять при переходе на DAG-оркестрацию |

Приоритет внедрения (соответствует фазам §4.10):

1. **Registry + lifecycle skeleton** — декларативный каталог агентов вместо хардкода (Phase B).
2. **Orchestrator DAG** — параллельные цепочки + merge (Phase B/C).
3. **Compliance Layer** — обязателен до любых автономных клинических/финансовых действий (Phase C).
4. **Clinical specialists** — Diagnosis/CBCT по мере multimodal (Phase D).

---

## 15.20 Priority Rule

При конфликте между этой главой и §04: **§04 определяет пользовательский контракт** (10 публичных агентов, UX, память, safety) и имеет приоритет для всего, что видит пользователь. Эта глава имеет приоритет для внутренней архитектуры оркестрации.
