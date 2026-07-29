# 03 — First-Run Experience

## 3.1 Цель

Первые секунды после открытия сайта должны отвечать на вопрос:

> «Куда я попал?» → «В интеллектуального ассистента DentVision».

Не dashboard. Не меню. Не список модулей.

---

## 3.2 Canonical Sequence (после открытия сайта)

```text
Open site / app
    ↓
Auth (если нужно) / Session restore
    ↓
① AI Greeting (центр)
    ↓
② Chat surface появляется и становится активным
    ↓
③ Sidebar разворачивается и функционально переезжает на своё место
    ↓
④ Пользователь уже может писать в чат и кликать пункты sidebar
    ↓
⑤ Через 15 секунд sidebar сворачивается (collapse)
    ↓
⑥ Остаётся Chat как главный рабочий объект
```

Это **обязательный продуктовый сценарий**, не опциональная анимация.

---

## 3.3 Phase Spec

### Phase 0 — Entry (0–0.5s)

| Требование | Деталь |
|------------|--------|
| Splash | Логотип DentVision, без маркетингового шума |
| Session | Если есть валидная сессия — без повторного логина |
| Prefetch | Профиль, роль, org context, unread alerts |

### Phase 1 — AI Greeting (0.5–2.5s)

AI приветствует **и голосом интерфейса чата** (текст в greeting bubble / hero line).

Примеры (роль-зависимые):

- **Врач:** «Доброе утро, доктор Айгерим. Сегодня 12 приёмов, 1 лаборатория готова, у 2 пациентов незакрытый план.»
- **Владелец:** «Доброе утро. Выручка вчера 1.8M ₸, 3 просроченных счета, склад: композит ниже минимума.»
- **Админ:** «Доброе утро. 7 неподтверждённых записей на сегодня, 2 документа ждут подписи.»
- **Покупатель:** «Могу помочь с закупкой. У вас 4 позиции на минимуме — показать предложения поставщиков?»

**Правила greeting**
- Персонализирован (имя, роль, org)
- Опирается на реальные данные (не lorem)
- Содержит 1–3 actionable insight
- Сразу доступен reply в чате

### Phase 2 — Chat Becomes Live

Одновременно с greeting:

- Появляется input чата
- Streaming/typing для greeting допустим
- Пользователь может прервать и задать свой вопрос в любой момент
- Suggestions chips (до 3): например «Открой расписание», «Покажи долги», «Что купить на склад»

### Phase 3 — Sidebar Assembly (functional)

Sidebar:

1. Появляется / разворачивается
2. **Переезжает на своё постоянное место** (обычно left rail)
3. Пункты навигации **кликабельны сразу** после появления
4. Это не «картинка сайдбара», а реальный navigation component с роутингом

Минимальный набор пунктов first-run sidebar:

- AI Workspace (active)
- CRM
- Marketplace
- School
- Community
- Jobs
- Profile / Settings (compact)

### Phase 4 — 15-Second Auto-Collapse

| Параметр | Значение |
|----------|----------|
| Timer start | С момента, когда sidebar достиг final position и стал interactive |
| Duration | **15 секунд** |
| Action | Collapse to icon rail / hidden rail (по design system) |
| Remains | **Chat остаётся** главным и полным |
| User override | Hover/pin/click chevron — раскрыть снова |
| Interrupt | Любое взаимодействие с sidebar reset/pause? → **pause timer on hover/focus; resume on leave** (recommended) |
| Persistence | После collapse состояние `sidebarCollapsed=true` в session; pin сохраняется в user prefs |

**Acceptance criteria**
- [ ] Если пользователь ничего не трогает 15s — sidebar свернут, чат на месте
- [ ] Если пользователь открыл CRM через sidebar на 5-й секунде — навигация работает, collapse не ломает route
- [ ] Collapse не размонтирует chat state и не сбрасывает greeting/memory context
- [ ] Повторный вход в ту же сессию не обязан повторять full cinematic assembly (см. §3.5)

---

## 3.4 Functional Motion Contract

| Запрещено | Обязательно |
|-----------|-------------|
| Pure CSS theatre без реальных компонентов | Sidebar = тот же компонент, что в runtime |
| Блокировка input на всё intro | Chat input доступен ASAP |
| «Анимация закончилась → UI появился» | UI появляется и работает во время motion |
| Случайная длительность | Жёсткий 15s collapse policy |

Рекомендуемые motion cues (2–3 intentional):

1. Greeting fade/rise
2. Sidebar dock travel
3. Collapse ease (soft, Linear-like)

---

## 3.5 First Session vs Returning Session

### First session (или first session of day — product flag)

Полная последовательность §3.2.

### Returning session

```text
Logo microbeat (optional, ≤400ms)
    ↓
AI Greeting (короче)
    ↓
AI Workspace (chat + collapsed or user-pinned sidebar)
```

Service orbit / long assembly **не повторяется** каждый раз.

---

## 3.6 Failure & Degraded Modes

| Ситуация | Поведение |
|----------|-----------|
| Нет org context | Greeting предлагает Create / Join / Demo org |
| AI backend down | Static branded greeting + manual nav; chat retry |
| Slow metrics | Greeting без цифр → «Собираю сводку…» затем patch message |
| Mobile | Sidebar = drawer; auto-collapse через 15s в icon/bottom mode; chat full-bleed |

---

## 3.7 Mobile First-Run

1. Greeting full screen
2. Chat docks
3. Nav icons появляются (bottom or edge)
4. Через 15s лишние chrome уходят, остаётся чат
5. CRM/Shop/School открываются как destinations, возврат к AI — всегда в один тап

---

## 3.8 Instrumentation (обязательные события)

- `first_run_started`
- `ai_greeting_rendered` (+ role, latency_ms, data_complete bool)
- `chat_ready`
- `sidebar_docked`
- `sidebar_auto_collapsed` (at 15s)
- `sidebar_user_expanded`
- `first_user_message_sent` (t_ms from open)
- `first_navigation` (target, t_ms)

North-star UX metric first-run: **Time-to-first meaningful AI reply < 3s** на warm session.
