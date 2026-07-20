# 14 — Success Metrics & Company OS

## 14.1 North Star Metric

**Weekly Active Professional (WAP)** — уникальный врач/админ/владелец, который за неделю совершил ≥1 meaningful action в AI или CRM.

Meaningful action examples:
- создал/изменил запись
- обновил зубную карту / план
- провёл оплату
- завершил AI mutate confirm
- оформил заказ Shop из рабочего контекста

---

## 14.2 Pillar Metrics

### AI
- Time-to-first greeting insight
- Messages / WAP / week
- Tool-success rate
- Memory revisit rate (threads reopened)
- Agent mix (не только Dental AI)

### CRM
- Schedule create→complete conversion
- % visits with chart updates
- % patients with active treatment plan
- Inventory stockout incidents
- Docs signed cycle time
- Automation saves (reminders sent without manual ops)

### Marketplace
- GMV
- Repeat purchase rate
- Supplier active listings
- Inventory→order conversion
- Checkout completion time

### School
- Enroll → complete rate
- Certificates issued
- AI Tutor sessions / learner
- Office course fill rate
- % staff with ≥1 completed module / quarter (org)

### Community
- WAU posters/commenters
- Follow graph growth
- PHI flag rate (should be low + caught)
- Click-out to School/Shop/Jobs

### Jobs
- Vacancy apply rate
- Time-to-first shortlist
- Hire → org invite conversion
- Candidate return within 30 days

---

## 14.3 First-Run Funnel

1. `open` → `greeting_rendered`
2. → `chat_ready`
3. → `sidebar_docked`
4. → `sidebar_auto_collapsed` (15s) **or** early nav
5. → `first_meaningful_action` (< 24h)

Activation definition (D0): greeting + (AI message **or** CRM action).

---

## 14.4 Company Operating Cadence

| Cadence | Ritual |
|---------|--------|
| Weekly | Pillar metrics review + AI quality samples |
| Monthly | Spec drift review (code vs `docs/spec`) |
| Quarterly | Epoch goals + MAJOR/MINOR spec bump |
| Yearly | Hardware program gate review |

---

## 14.5 Decision Framework

**Gate 0 — Mission Decision Rule** ([`MISSION.md`](./MISSION.md)):

Каждая фича должна ответить YES на все:

1. Does it improve patient care?
2. Does it reduce doctor's workload?
3. Does AI understand it?
4. Can it be automated?
5. Does it integrate with the ecosystem?
6. Does it simplify the workflow?

Если любой ответ NO — redesign до реализации.

**Gate 1 — Portfolio priority** (после Gate 0): фича должна улучшать хотя бы одно из:

1. WAP / retention  
2. Automation minutes saved  
3. Marketplace liquidity  
4. Learning credentials  
5. Network graph  
6. Hardware loop readiness

---

## 14.6 Spec Completeness Checklist (v1.0)

- [x] Primary users: Врач, Владелец, Админ, Покупатель
- [x] First-run: AI greeting + chat + functional sidebar + 15s collapse
- [x] Priority pillars: CRM → Marketplace → School
- [x] AI quality bar: ChatGPT-class
- [x] AI memory: remembers everything (with ACL)
- [x] 10 named agents
- [x] CRM world-class automation + 7 mandatory sections
- [x] Shop Kaspi-class; sellers = suppliers
- [x] School full academic inventory + local/international lecturers
- [x] Community = Instagram + Threads
- [x] Jobs = HH.kz-class market
- [x] Year-5 lab + own 3D scanner synced to app
