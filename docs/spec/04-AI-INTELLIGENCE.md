# 04 — AI Intelligence System

## 4.1 Product Definition

DentVision Intelligence — главный продукт платформы.

Эталон ощущения: **ChatGPT**.  
Отличие: AI встроен в стоматологическую ОС и **исполняет действия** в CRM / Shop / School / Community / Jobs.

Пользователь не «пользуется ботом».  
Пользователь **управляет практикой через разговор**.

---

## 4.2 Experience Requirements (ChatGPT-class)

| Capability | Requirement |
|------------|-------------|
| Conversation quality | Естественный язык, уточняющие вопросы, многошаговые задачи |
| Streaming | Token/stream ответа обязателен |
| Tool use | AI вызывает платформенные actions (create appointment, open chart…) |
| Continuity | Пользователь может вернуться к треду через дни/недели |
| Multimodal (phased) | Текст → изображения снимков → голос → скан с устройства |
| Safety | Клинические и финансовые действия — confirm / RBAC |
| Personality | Профессиональный, спокойный, expert-peer tone; без «робо-канцелярита» |

---

## 4.3 Memory Doctrine — «должен помнить всё»

### 4.3.1 Meaning

AI обязан помнить:

1. **User memory** — предпочтения, специализация, стиль общения, частые команды
2. **Organization memory** — клиника, филиалы, прайс, протоколы, поставщики
3. **Clinical operational memory** — пациенты, визиты, планы, документы (по RBAC)
4. **Conversation memory** — полная история тредов (persistent, не только session TTL)
5. **Episodic memory** — что уже делали вместе («вчера заказывали композит», «договаривались перенести Иванова»)
6. **Agent memory** — выводы профильных агентов (radio findings draft, finance anomalies)

«Помнит всё» = **максимально полная полезно-извлекаемая память**, а не бесконтрольный dump без ACL.

### 4.3.2 Memory Layers

```text
┌──────────────────────────────────────────────┐
│ Working Memory (current turn + open widgets) │
├──────────────────────────────────────────────┤
│ Conversation Memory (threads, messages)      │
├──────────────────────────────────────────────┤
│ Profile Memory (user digital twin)           │
├──────────────────────────────────────────────┤
│ Org Knowledge Graph (clinic entities)        │
├──────────────────────────────────────────────┤
│ Long-term Facts & Preferences                │
├──────────────────────────────────────────────┤
│ Audit / Provenance (why AI knew X)           │
└──────────────────────────────────────────────┘
```

### 4.3.3 Hard Rules

- Retrieval всегда проходит через **permission filter**
- Медицинские факты хранятся в source-of-truth CRM; memory хранит pointers + summaries
- Пользователь может попросить «забудь это» / управлять memory prefs
- Cross-org leakage запрещён
- Retention policy документируется в §11

---

## 4.4 Agent Roster (canonical)

Все агенты доступны через единый AI Workspace. Router выбирает агента; пользователь может вызвать явно («спроси Orthodontic AI»).

| Agent | ID | Mandate |
|-------|----|---------|
| **Dental AI** | `agent.dental` | General clinical orchestration, default clinical brain |
| **Radiology AI** | `agent.radiology` | Снимки, КТ, описание, red flags (assistive) |
| **Orthopedic AI** | `agent.orthopedic` | Ортопедия, протезирование, конструкции |
| **Orthodontic AI** | `agent.orthodontic` | Ортодонтия, движение зубов, элайнеры/брекеты |
| **Therapy AI** | `agent.therapy` | Терапия, кариес, реставрации |
| **Endodontic AI** | `agent.endodontic` | Эндодонтия, каналы, pain pathways |
| **Laboratory AI** | `agent.laboratory` | Заказы в лабораторию, статусы, fit/remake |
| **Finance AI** | `agent.finance` | Выручка, долги, касса, маржа, прогнозы |
| **Reception AI** | `agent.reception` | Запись, подтверждения, no-show, очередь |
| **Marketing AI** | `agent.marketing` | Акции, реактивация пациентов, репутация, контент |

### 4.4.1 Agent Collaboration

```text
User message
  → Intent Engine
  → Agent Router (1 primary + N consultants)
  → Tool / Action Planner
  → RBAC + Confirm Policy
  → Execute / Propose
  → Memory Writeback
  → Streamed response in Chat
```

Пример: «Собери план по 26 зубу и посчитай стоимость»

1. Therapy/Endodontic AI — клиническая логика  
2. Dental AI — зубная карта / plan entity  
3. Finance AI — прайс и сумма  
4. Reception AI — слоты под этапы  

---

## 4.5 Core AI Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     AI Workspace UI                         │
│         Chat · Composer · Citations · Confirm cards         │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│ Orchestrator                                                │
│ Intent · Context packer · Agent router · Planner            │
└───────┬───────────────┬──────────────────┬──────────────────┘
        │               │                  │
   Memory Engine   Knowledge Router   Action Registry
        │               │                  │
        ▼               ▼                  ▼
   Threads/Facts   CRM/Shop/School    Command Bus
                   Community/Jobs     (side effects)
```

---

## 4.6 Action Model

AI может:

| Mode | Example | Confirm? |
|------|---------|----------|
| Answer | «Какая загрузка завтра?» | No |
| Navigate | Открыть карту пациента | No |
| Draft | Черновик плана лечения | Soft confirm |
| Mutate | Создать запись / счёт | Hard confirm (role-based) |
| Automate | Поставить правило reminder | Confirm + editable |

Каждый mutate-action логируется в audit.

---

## 4.7 Proactive Intelligence

AI не только отвечает — инициативно пишет в workspace:

- Риск no-show
- Просроченные планы лечения
- Склад ниже min
- Lab delay
- Финансовые аномалии
- Рекомендованный курс под частые кейсы врача
- Marketing opportunity (пациенты без визита N дней)

Proactive cards появляются в chat/context panel, не как spam push.

---

## 4.8 Safety & Clinical Boundaries

1. AI — **ассистент**, не замена врача.
2. Диагностические выводы Radiology/Clinical агентов — draft, требуют professional review.
3. Запрещены гарантирующие medical claims в UI.
4. Disclaimers в clinical drafts.
5. Jailbreak / off-policy medical advice — soft refuse + route to knowledge/school.

---

## 4.9 Quality Bar (Acceptance)

- [ ] Пользователь может решить типичный morning start без выхода из чата
- [ ] Память переживает reload и новый день
- [ ] Явный вызов каждого из 10 агентов работает
- [ ] Router сам выбирает агента с объяснимым citation («отвечает Finance AI, потому что…»)
- [ ] Streaming + tool cards + confirm flows polished to ChatGPT-class UX
- [ ] Нет утечки данных между организациями

---

## 4.10 Implementation Phases (AI)

| Phase | Scope |
|-------|-------|
| A | Persistent threads + org-aware greetings + action bus |
| B | Full 10-agent router + citations |
| C | Long-term memory graph + preference learning |
| D | Multimodal imaging assist (Radiology) |
| E | Device sync memory (3D scanner stream) — see §13 |
