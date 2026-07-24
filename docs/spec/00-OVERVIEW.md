# 00 — Overview & Document Control

> **CORE Mission:** [`MISSION.md`](./MISSION.md) — высший документ назначения продукта.  
> **CORE Product DNA:** [`../00_CONSTITUTION/02_PRODUCT_DNA.md`](../00_CONSTITUTION/02_PRODUCT_DNA.md) — закон качества, AI-primary interface, feature gates (MUST/SHOULD).  
> Core Statement: *DentVision is an AI Operating System for Digital Dentistry.*

## 0.1 Назначение документа

DentVision Platform Specification описывает:

1. **Что** мы строим (продукт и экосистема)
2. **Для кого** (персоны и роли)
3. **Как это ощущается** (first-run, AI, UX)
4. **Что внутри** (CRM, Shop, School, Community, Jobs)
5. **Как это масштабируется** (платформа, данные, безопасность, железо)
6. **Как измеряем успех** (метрики, этапы, компания)

Документ рассчитан на горизонт **5+ лет** и должен оставаться источником истины при смене стека, команды и рынков.

---

## 0.2 Document Control

| Поле | Значение |
|------|----------|
| Product | DentVision Platform |
| Spec ID | DV-PS-1.0 |
| Version | 1.0.1 |
| Core Mission | [`MISSION.md`](./MISSION.md) — DV-MISSION-1.0 |
| Status | Approved for Product Foundation |
| Language | RU (canonical), EN identifiers for modules/roles |
| Owner | Product Leadership |
| Review cadence | Quarterly or on major pillar change |

### Версионирование

- **MAJOR** — смена product thesis, основных пользователей или north star
- **MINOR** — новый модуль / агент / обязательный раздел CRM
- **PATCH** — уточнения flows, метрик, NFR без смены смысла

---

## 0.3 Product Thesis (зафиксировано)

| Вопрос | Ответ (canonical) |
|--------|-------------------|
| Что такое DentVision? | AI-first суперплатформа для стоматологии |
| Главный интерфейс? | AI Workspace (ChatGPT-класс), не dashboard |
| Самые важные функции? | **CRM → Marketplace → School** |
| Основные пользователи? | **Врач, Владелец, Админ, Покупатель** |
| Кто продаёт в Shop? | **Поставщики** |
| Эталон Shop UX? | **Kaspi** |
| Эталон AI UX? | **ChatGPT** |
| Память AI? | **Помнит всё** (в рамках политики доступа и retention) |
| Community? | **Instagram + Threads** |
| Jobs? | **HH.kz-класс** (полный кадровый рынок) |
| 5-летнее железо? | Собственный **3D-сканер** + полная синхронизация с платформой |

---

## 0.4 Platform Map

```text
┌─────────────────────────────────────────────────────────────────┐
│                     DentVision Platform                         │
├─────────────────────────────────────────────────────────────────┤
│  DentVision Intelligence (AI OS)                                │
│  Greeting · Chat · Memory · Agents · Actions · Proactive        │
├─────────────────────────────────────────────────────────────────┤
│  Pillars                                                        │
│  ┌─────────┐ ┌─────────────┐ ┌────────┐ ┌───────────┐ ┌──────┐ │
│  │   CRM   │ │ Marketplace │ │ School │ │ Community │ │ Jobs │ │
│  │ (core)  │ │   (Kaspi)   │ │Academy │ │ IG/Threads│ │ HH   │ │
│  └─────────┘ └─────────────┘ └────────┘ └───────────┘ └──────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Platform Core                                                  │
│  Identity · Orgs · RBAC · Billing · Search · Events · Files     │
├─────────────────────────────────────────────────────────────────┤
│  Future Hardware Layer (Year 5+)                                │
│  DentVision 3D Scanner · Lab Device Sync · Imaging Pipeline     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 0.5 Что НЕ является DentVision

- Не «ещё одна dental CRM»
- Не каталог курсов без клинического контекста
- Не маркетплейс без операционной системы клиники
- Не chatbot-обёртка над формами
- Не набор разрозненных модулей с разными логинами

DentVision — **одна экосистема с одним интеллектом**.

---

## 0.6 Acceptance of Spec

Команда принимает спецификацию, если:

1. Любой новый экран можно отнести к одному pillar или Platform Core
2. First-run и AI-память реализованы по канону из §03 и §04
3. CRM содержит все обязательные разделы из §05
4. Shop, School, Community, Jobs соответствуют эталонам из §06–§09
5. Roadmap к железу не противоречит §13
