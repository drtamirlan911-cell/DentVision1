# 10 — Platform Core

## 10.1 Role of Platform Core

Platform Core — фундамент, на котором стоят AI и все pillars.

Без Core невозможны:

- мультиорганизационность
- безопасный RBAC
- единый поиск
- события realtime
- биллинг платформы
- файлы и аудит

---

## 10.2 Core Domains

| Domain | Responsibility |
|--------|----------------|
| **Identity** | Auth, sessions, MFA (phased), password reset |
| **Organizations** | Clinics/networks, create/join/demo/switch |
| **Membership** | User ↔ org relations |
| **Roles & Permissions** | RBAC matrix + AI action permissions |
| **Notifications** | In-app, email, push, messaging providers |
| **Search** | Global + scoped search |
| **Events** | Domain events + WebSocket fanout |
| **Files** | Secure uploads, signed URLs, virus scan phased |
| **Audit** | Immutable action log |
| **Feature Flags / Service Access** | Per-org module toggles |
| **Billing (Platform)** | Subscriptions for DentVision itself |
| **Admin Ops** | Superadmin tools |

---

## 10.3 Organization Model

```text
User
 └── Memberships[]
       └── Organization
             ├── Branches / Clinics
             ├── Roles
             ├── Workspace (CRM data plane)
             ├── Service Access (shop/school/...)
             └── Settings / Protocols
```

Пользователь может состоять в нескольких организациях.  
Switch organization переключает data plane, сохраняя personal AI profile memory.

---

## 10.4 Create / Join / Demo

Обязательные пути:

1. **Create organization** — владелец поднимает клинику
2. **Join organization** — invite link / code / admin approve
3. **Demo organization** — безопасная песочница для onboarding и продаж

Создание клиники **не блокирует** доступ к Marketplace / School / Community / Jobs на уровне платформы (policy may gate some features).

---

## 10.5 RBAC Principles

1. Deny by default
2. Least privilege
3. AI actions проверяются тем же permission layer, что и API
4. Superadmin bypass только с audit
5. Cross-org access запрещён без explicit partnership model

---

## 10.6 Event Bus (logical)

Примеры событий:

- `appointment.created|updated|cancelled`
- `invoice.paid`
- `inventory.min_breach`
- `lab.status_changed`
- `order.placed|shipped`
- `course.completed`
- `job.application.submitted`
- `community.moderation.flagged`

Events питают: realtime UI, AI proactive, notifications, automations.

---

## 10.7 API Surface Philosophy

- REST (or equivalent) resource APIs for CRUD
- AI gateway for chat/orchestrator
- WebSocket for realtime
- Idempotent mutating endpoints where needed
- Versioned public APIs before external partners

---

## 10.8 Multi-tenant Isolation

| Layer | Rule |
|-------|------|
| DB | org_id / clinic_id on tenant data |
| API | requireSameOrg / requirePermission |
| Search | tenant filters mandatory |
| AI memory retrieval | tenant + role filters |
| Files | signed access scoped to entitlements |

---

## 10.9 Acceptance Criteria

- [ ] Create / Join / Demo org работают
- [ ] Switch org не смешивает данные
- [ ] RBAC покрывает CRM mutate + AI actions
- [ ] Audit пишет clinical/financial critical actions
- [ ] Notifications и realtime events доходят до нужной org audience
