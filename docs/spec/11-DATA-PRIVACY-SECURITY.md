# 11 — Data, Privacy & Security

## 11.1 Principle

Клинические и финансовые данные — священны.  
AI-память не отменяет compliance, а усложняет требования: нужен controllable intelligence.

---

## 11.2 Data Classes

| Class | Examples | Handling |
|-------|----------|----------|
| **PHI / Clinical** | Dental chart, plans, visits, images | Strict org ACL, encryption, audit |
| **PII** | Names, phones, IDs | Minimization, access logs |
| **Financial** | Invoices, payouts | Role-gated, immutable ledger traits |
| **Commerce** | Orders, supplier KYB | Seller/buyer isolation |
| **Learning** | Progress, exam answers | User + org learning policy |
| **Social** | Posts, threads | Public/private per settings + moderation |
| **AI Memory** | Facts, prefs, summaries | Derived; deletable; ACL-filtered |

---

## 11.3 AI Memory Privacy Contract

«AI помнит всё» означает:

- всё **разрешённое** и **полезное** для пользователя/организации
- с возможностью erasure / export
- без cross-tenant bleed
- с provenance («из какого источника факт»)

Пользовательские controls:

- View memory facts
- Delete fact / thread
- Pause long-term memory
- Org admin policy: retention windows

---

## 11.4 Security Baseline

1. TLS everywhere
2. Password hashing (modern KDF)
3. JWT/session hardening + rotation
4. RBAC on every mutate
5. Rate limits on auth and AI
6. Audit log for privileged actions
7. Backups + tested restore
8. Secret management (no secrets in repo)
9. Dependency scanning
10. Supplier KYB before selling

---

## 11.5 Clinical Safety

- AI drafts ≠ clinical authority
- Radiology/specialty outputs labeled assistive
- E-sign documents capture signer identity + timestamp
- Imaging access logged

---

## 11.6 Community PHI Guard

Перед публикацией:

- client-side warnings
- server-side classifiers/heuristics for phone/name/chart leakage
- moderator queue for flagged content

---

## 11.7 Regional Compliance Posture

Продукт ориентирован на рынки ЦА (вкл. Казахстан) с расширением.

Требования фиксируются как capability targets:

- consent records
- data export for org owner
- deletion workflows
- processing agreements for suppliers/lecturers as needed

Конкретные юр. режимы сопровождаются legal counsel; spec требует engineering readiness.

---

## 11.8 Acceptance Criteria

- [ ] Нет API path чтения чужой org без membership
- [ ] AI retrieval не возвращает foreign-tenant facts
- [ ] Пользователь может удалить thread/memory fact
- [ ] Critical finance/clinical actions в audit
- [ ] Backups и restore procedure существуют и прогоняются
