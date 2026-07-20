# 13 — Roadmap & Hardware Future

## 13.1 Strategy Timeline

Горизонт спецификации — **5+ лет**.  
Ниже — продуктовые эпохи, не календарные обещания в неделях.

```text
Epoch 1  Foundation OS
Epoch 2  Liquidity (Shop + School depth)
Epoch 3  Network (Community + Jobs)
Epoch 4  Intelligence Density (full memory + agents)
Epoch 5  Hardware Loop (Lab + DentVision 3D Scanner)
```

---

## 13.2 Epoch 1 — Foundation OS

**Цель:** AI Workspace + CRM P0 незаменимы ежедневно.

Deliverables:
- First-run greeting → chat → functional sidebar → 15s collapse
- ChatGPT-class chat shell (streaming, threads)
- CRM mandatory sections: schedule, patients, finance, inventory, documents, dental chart, treatment plans
- Org create/join/demo + RBAC
- Persistent conversation memory (baseline)

Exit criteria:
- Врач/админ/владелец закрывают morning loop в AI+CRM без Excel.

---

## 13.3 Epoch 2 — Liquidity

**Цель:** Marketplace как Kaspi + School как академия.

Deliverables:
- Supplier cabinet + KYB
- Inventory → Shop replenishment loop
- School: video/PDF/tests/exams/certificates/live/AI tutor/practicals/office courses
- Local + international lecturers

Exit criteria:
- Повторные закупки и завершённые сертификации создают weekly active loops.

---

## 13.4 Epoch 3 — Network

**Цель:** Профессиональный граф.

Deliverables:
- Community IG+Threads experience
- Jobs HH.kz-class two-sided market
- Profile as portable professional identity
- Cross-pillar graph (certs → jobs, posts → courses)

Exit criteria:
- Пользователь остаётся на платформе даже в дни без приёма пациентов.

---

## 13.5 Epoch 4 — Intelligence Density

**Цель:** «Помнит всё» + все 10 агентов в боевом качестве.

Deliverables:
- Long-term memory graph + user controls
- Full agent roster excellence (Dental…Marketing)
- Multimodal radiology assist
- High-automation CRM playbooks
- Proactive ops that feel like a chief of staff

Exit criteria:
- AI initiates more valuable actions than user navigates manually.

---

## 13.6 Epoch 5 — Laboratory & DentVision 3D Scanner

### 13.6.1 Vision (зафиксировано основателем)

> Через ~5 лет: собственная лаборатория направления + создание своего аппарата **3D-сканирования**, полностью синхронизированного с приложением DentVision.

Это не side-project. Это **стратегический hardware moat**.

### 13.6.2 Product Outcomes

1. Врач сканирует пациента аппаратом DentVision
2. Скан мгновенно появляется в карте пациента / зубной карте / плане
3. AI (Orthopedic / Orthodontic / Laboratory) работает на облаке скана
4. Лаборатория получает задачу без ручного экспорта файлов
5. Статусы изготовления возвращаются в CRM realtime
6. Marketplace может предлагать материалы под тип работы
7. School использует anonymized cases для обучения (consent)

### 13.6.3 Hardware System Map

```text
DentVision 3D Scanner (device)
  ├── Capture firmware / calibration
  ├── Edge preprocessing
  ├── Secure upload agent
  └── Device identity + clinic binding
           │
           ▼
DentVision Cloud Imaging Fabric
  ├── Scan object store
  ├── Mesh / texture pipeline
  ├── DICOM/mesh converters as needed
  ├── AI inference hooks
  └── ACL + audit
           │
           ▼
Platform App
  ├── Patient Imaging tab
  ├── Dental Chart overlay
  ├── Treatment Plan linkage
  ├── Laboratory AI order
  └── Progress timeline
```

### 13.6.4 Lab Platform Capabilities (software first → hardware)

Ещё до собственного сканера Lab pillar усиливается:

- Единый lab order protocol
- Partner labs network
- Remake analytics
- Shade/material specs
- File exchange with version pins

Собственный аппарат закрывает loop end-to-end и поднимает switching costs.

### 13.6.5 Hardware Program Workstreams

| Workstream | Scope |
|------------|-------|
| Industrial design & optics | Устройство клиники |
| Firmware & calibration | Стабильный захват |
| Companion sync service | Clinic bridge |
| Cloud imaging fabric | Storage + processing |
| Clinical UX | Scan-to-plan flows |
| Regulatory | Мед. изделие / local regs |
| Manufacturing & service | Supply, warranty, support |
| Data moat | Protocol library + model improvement |

### 13.6.6 Non-Goals (near term)

- Не блокировать Epoch 1–4 ожиданием железа
- Не строить сканер как изолированный gadget без CRM sync
- Не хранить сканы вне patient ACL модели

---

## 13.7 Dependency Graph

```text
CRM depth ──────────────┐
                        ├──► AI memory density
Shop inventory loop ────┤
School credentials ─────┤
Community graph ────────┤
Jobs identity ──────────┘
           │
           ▼
    Imaging / Lab software maturity
           │
           ▼
    DentVision 3D Scanner program
```

---

## 13.8 Portfolio Rule

Каждый квартал продукт обязан двигать:

1. **Retention core** (CRM+AI)
2. **Network/liquidity** (хотя бы один из Shop/School/Community/Jobs)
3. **Future moat** (lab protocols / imaging readiness) — даже маленьким шагом

Так компания не застревает в «вечной CRM» и не прыгает в железо раньше времени.
