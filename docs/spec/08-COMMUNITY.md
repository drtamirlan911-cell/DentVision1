# 08 — Community

## 8.1 Positioning

Community — **P3 pillar**.

Эталон: **Instagram + Threads**.

- **Instagram-слой:** визуальный профессиональный feed (кейсы, до/после с этикой, кабинет, оборудование, short education clips)
- **Threads-слой:** текстовые дискуссии, мнения, быстрые треды, комментарии-цепочки

Это профессиональная соцсеть стоматологов, а не Facebook-группа и не форум 2008 года.

---

## 8.2 Core Objects

| Object | Analogy | Notes |
|--------|---------|-------|
| Post (media) | Instagram post | Image/carousel/video + caption |
| Thread | Threads post | Text-first, nested replies |
| Story (phased) | IG Stories | Ephemeral clinic/day life |
| Profile | Creator profile | Links to School certs, Jobs, specialty |
| Follow graph | Social graph | People, clinics, lecturers, suppliers (policy) |
| Reactions / Comments | Social engagement | Professional tone enforcement |
| Saves / Collections | Bookmarks | Protocols, inspiration |
| Mentions / Tags | Discovery | #endo #implants #management |

---

## 8.3 Feed Principles

1. **Professional relevance first** — specialization-aware ranking
2. **Visual clarity** — media-forward layout
3. **Conversation depth** — Threads-style reply chains
4. **Safety** — moderation for PHI, before/after consent, spam
5. **Bridge to product** — post → course, product, vacancy, AI explain

---

## 8.4 Content Rules (non-negotiable)

- Запрет публикации идентифицируемых пациентских данных без consent workflow
- Before/after — только с политикой клиники и маскированием
- Медицинские утверждения — без гарантий исхода
- Поставщики могут иметь brand presence, но нативная реклама маркируется
- Harassment / non-professional attacks — hard moderation

---

## 8.5 Creator & Clinic Pages

- Personal professional profile (не settings)
- Clinic page (org-owned)
- Lecturer page (School bridge)
- Supplier page (Marketplace bridge, limited community actions)

---

## 8.6 AI in Community

- Summarize long threads
- Draft reply (user confirms)
- Recommend people/topics to follow
- Detect potential PHI leak before publish (warning)
- Turn a case discussion into private CRM learning note (user-initiated)

---

## 8.7 IA

```text
/community
  /community/feed
  /community/thread/:id
  /community/post/:id
  /community/u/:handle
  /community/compose
  /community/notifications
  /community/saved
```

---

## 8.8 Acceptance Criteria

- [ ] Media feed и text threads сосуществуют в одном Community
- [ ] Follow, comment, nested replies работают
- [ ] Profile показывает professional identity + certs
- [ ] PHI guardrails на publish
- [ ] Deep links в School / Shop / Jobs из постов
- [ ] Ощущение ближе к IG/Threads, чем к forum/admin board
