# 12 — Non-Functional Requirements

## 12.1 Performance

| Metric | Target |
|--------|--------|
| First-run AI greeting (warm) | < 3s to meaningful content |
| Chat token stream start | < 1.5s p95 (online) |
| CRM schedule open | < 1s p95 cached / < 2.5s cold |
| Marketplace search keystroke feel | < 200ms suggestions UI |
| WebSocket event delivery in clinic | < 1s typical LAN/cloud path |

Bundle discipline: route-level code splitting сохраняется; AI workspace — приоритетный warm path.

---

## 12.2 Reliability

- API availability target: 99.9% monthly (production)
- Graceful degradation: AI down ≠ CRM locked
- Idempotent order placement
- Retry-safe notification dispatch
- Queue for outbound messaging

---

## 12.3 Scalability

Горизонты нагрузки (product planning, не бенчмарк железа):

1. Single clinic daily ops
2. Multi-branch networks
3. National marketplace suppliers
4. Concurrent Live School sessions
5. Hardware telemetry streams (Year 5+)

Архитектура не должна требовать rewrite при переходе 1→3; 5 потребует ingestion pipeline (§13).

---

## 12.4 Accessibility & Localization

- RU primary UX; KK/EN phased
- Currency/date formats locale-aware
- Keyboard access for core CRM tables
- Contrast-safe clinical UI (charts, statuses)

---

## 12.5 Device Support

| Surface | Support |
|---------|---------|
| Desktop web | Primary for CRM depth |
| Mobile web | First-class for AI, Shop, Community, Jobs |
| Tablet | Chart + schedule friendly |
| Future native shells | Optional wrappers, same backend |
| Hardware agent | Scanner companion app/service (§13) |

---

## 12.6 Observability

Обязательные сигналы:

- Product analytics (first-run, activation, retention)
- AI quality (tool success, confirm rate, thumbs)
- Commerce funnel
- Error tracking
- Audit trail integrity checks

---

## 12.7 Quality Gates

Перед major release pillar:

1. Spec acceptance criteria зелёные
2. Security checklist §11
3. No P0 data-isolation bugs
4. First-run motion functional (not theatre-only)
5. Critical e2e paths automated where feasible
