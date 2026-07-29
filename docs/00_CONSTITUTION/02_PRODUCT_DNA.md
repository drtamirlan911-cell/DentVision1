# DentVision Product DNA

| Field | Value |
|-------|-------|
| Path | `docs/00_CONSTITUTION/02_PRODUCT_DNA.md` |
| Version | 1.0 |
| Status | **CORE** |
| Priority | **CRITICAL** |
| Spec ID | DV-DNA-1.0 |
| Audience | Humans and AI agents |
| Language | Normative English (RFC-style) |
| Parent | [`MISSION.md`](../spec/MISSION.md) |
| Authority | Binding for all product, design, and engineering work |

---

## 0. Normative Language

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as requirements.

| Keyword | Meaning |
|---------|---------|
| **MUST** | Absolute requirement. Non-compliance is a defect. |
| **MUST NOT** | Absolute prohibition. |
| **SHOULD** | Strong default. Deviation requires written rationale. |
| **SHOULD NOT** | Strong discouragement. Deviation requires written rationale. |
| **MAY** | Truly optional. |

This document is intentionally short, unambiguous, and executable by people and agents.

---

## 1. Ambition Level

DentVision is a **world-class** product.

It is **MUST NOT** be designed as a Kazakhstan-only product.  
It is **MUST NOT** be designed as a CIS-only product.  
It **MUST** be designed to compete with the best global software experiences — adapted to dentistry.

Local payment methods, languages, and regulations **MAY** be supported as market adapters.  
They **MUST NOT** define product quality, UX ambition, or architecture ceilings.

---

## 2. Reference Principles (Adapt, Do Not Copy)

DentVision **MUST** study and adapt successful principles from world-class products.  
DentVision **MUST NOT** copy brands, layouts, copy, or trademarked patterns.

| Reference | What we take |
|-----------|----------------|
| **ChatGPT** | Conversational clarity, streaming, memory, tool use, low-friction dialogue |
| **Linear** | Speed, keyboard fluency, intentional motion, ruthless focus |
| **Notion** | Flexible workspace mental model, composition of blocks/tools |
| **Figma** | Component systems, variants, design-to-product consistency |
| **Stripe** | Precise documentation, progressive disclosure, trust through clarity |
| **Vercel** | Excellent DX, fast feedback loops, polish in defaults |
| **Kaspi** | Super-app coherence, commerce speed, everyday utility |
| **Apple HIG** | Hierarchy, restraint, human interface craft, accessibility |
| **GitHub** | Clear development architecture, review culture, durable systems |

**Adaptation rule:** every borrowed principle **MUST** be rewritten for dental workflows, clinical safety, and clinic operations before implementation.

---

## 3. Development Philosophy

### 3.1 Core Beliefs

1. DentVision is an **AI Operating System for Digital Dentistry**, not a bundle of apps.
2. Software **MUST** adapt to the professional. The professional **MUST NOT** be forced to adapt to software.
3. Routine work **MUST** be removed before features are added.
4. Clarity beats completeness. Speed beats ceremony. Trust beats novelty.
5. One ecosystem. One identity. One intelligence. No duplicated truth.

### 3.2 Build Rules

| ID | Rule |
|----|------|
| DNA-DEV-01 | Every change **MUST** improve patient care, reduce professional workload, or strengthen the ecosystem — preferably more than one. |
| DNA-DEV-02 | Every workflow **MUST** be reachable through AI Workspace, even if a dedicated UI also exists. |
| DNA-DEV-03 | Dedicated UIs **MUST** remain excellent; AI is primary, not an excuse for weak screens. |
| DNA-DEV-04 | Automation **MUST** be the default path when safe; manual steps are exceptions. |
| DNA-DEV-05 | Systems **MUST** be cloud-native, multi-tenant safe, mobile-ready, and hardware-ready. |
| DNA-DEV-06 | Code and docs **MUST** be understandable by future humans and AI agents without tribal knowledge. |
| DNA-DEV-07 | Incomplete world-class is preferred over complete mediocre. Ship the sharp slice. |

---

## 4. Why AI Is the Primary Interface

### 4.1 Thesis

The primary interface of DentVision **MUST** be the AI Workspace.

Modules (CRM, Marketplace, School, Community, Jobs, Analytics, Laboratory, Hardware) **MUST** be capabilities of the operating system, not competing home screens.

### 4.2 Rationale

Dental work is interrupt-driven, multi-context, and language-native (“reschedule Sabina”, “open chart for 26”, “order composite”).  
A conversation + tools model matches the job better than menu archaeology.

### 4.3 Normative AI Interface Rules

| ID | Rule |
|----|------|
| DNA-AI-01 | On product open, the user **MUST** land in an intelligent surface (greeting + chat capability), not a generic dashboard wall. |
| DNA-AI-02 | AI UX quality **MUST** target ChatGPT-class: natural language, streaming, memory, clarification, tool use. |
| DNA-AI-03 | AI **MUST** be able to navigate, draft, and execute platform actions under RBAC and confirmation policy. |
| DNA-AI-04 | AI **MUST** remember relevant user, org, and workflow context across sessions (subject to privacy controls). |
| DNA-AI-05 | AI **MUST NOT** silently perform irreversible clinical or financial mutations without required confirmation. |
| DNA-AI-06 | AI **MUST NOT** replace professional clinical judgment; assistive outputs **MUST** be labeled when diagnostic. |
| DNA-AI-07 | If AI cannot act, it **SHOULD** explain why and offer the next best safe path. |
| DNA-AI-08 | Motion and chrome around AI **MUST** be functional (real navigation assembled), not decorative theatre. |

---

## 5. How Product Decisions Are Made

### 5.1 Decision Stack (top → bottom)

1. **Mission** — purpose and ten-year direction  
2. **Product DNA** (this document) — non-negotiable philosophy and quality law  
3. **Platform Specification** — modules, flows, acceptance criteria  
4. **UX / Engineering blueprints** — implementation detail  
5. **Code** — reality

On conflict of purpose, higher layers win.

### 5.2 Mission Decision Rule (Gate 0)

Every feature **MUST** answer **YES** to all:

1. Does it improve patient care?  
2. Does it reduce the doctor’s (or primary user’s) workload?  
3. Does AI understand / operate it?  
4. Can it be automated (now or by design)?  
5. Does it integrate with the ecosystem?  
6. Does it simplify the workflow?

If any answer is **NO**, the feature **MUST** be redesigned before implementation.

### 5.3 DNA Decision Rule (Gate 1)

In addition, the feature **MUST** pass:

| Check | Requirement |
|-------|-------------|
| World-class bar | Would this embarrass us next to Linear / Apple / Stripe quality? If yes → redesign. |
| AI-reachable | Can a user complete the job from AI Workspace? |
| Single source of truth | Does it avoid duplicated data or parallel shadow systems? |
| Automation path | Is there a default automated path with safe overrides? |
| Ecosystem fit | Does it strengthen CRM ↔ Shop ↔ School ↔ Community ↔ Jobs ↔ Lab/Hardware, not isolate? |
| Simplicity | Did we remove steps, not add ceremony? |

### 5.4 Decision Record

Material product decisions **SHOULD** leave a short written rationale (PR, ADR, or spec note) stating:

- problem  
- Gate 0 / Gate 1 answers  
- alternatives rejected  
- risk / safety notes  

AI agents implementing work **MUST** treat missing Gate answers as a blocking gap.

---

## 6. Rules Every New Feature MUST Obey

### 6.1 Absolute Requirements (MUST)

| ID | Requirement |
|----|-------------|
| DNA-FEAT-01 | **MUST** map to at least one ecosystem module or Platform Core capability. |
| DNA-FEAT-02 | **MUST** define primary user(s) and the job-to-be-done in one sentence. |
| DNA-FEAT-03 | **MUST** be operable via AI (command, tool, or guided flow). |
| DNA-FEAT-04 | **MUST** respect RBAC and tenant isolation. |
| DNA-FEAT-05 | **MUST** define empty, loading, error, and success states. |
| DNA-FEAT-06 | **MUST** define confirmation rules for destructive or clinical/financial mutations. |
| DNA-FEAT-07 | **MUST** include acceptance criteria testable by humans and agents. |
| DNA-FEAT-08 | **MUST** avoid duplicating an existing source of truth. |
| DNA-FEAT-09 | **MUST** be keyboard-reachable for core professional desktop workflows. |
| DNA-FEAT-10 | **MUST** meet performance budgets defined for its surface (see Quality Standards). |

### 6.2 Strong Defaults (SHOULD)

| ID | Requirement |
|----|-------------|
| DNA-FEAT-11 | **SHOULD** automate reminders, drafts, routing, or follow-ups where safe. |
| DNA-FEAT-12 | **SHOULD** reuse design-system components; new one-off UI **SHOULD NOT** be invented. |
| DNA-FEAT-13 | **SHOULD** expose analytics events for activation and failure. |
| DNA-FEAT-14 | **SHOULD** degrade gracefully if AI is unavailable (manual path still works). |
| DNA-FEAT-15 | **SHOULD** be localizable without redesign. |

### 6.3 Prohibitions (MUST NOT)

| ID | Requirement |
|----|-------------|
| DNA-FEAT-16 | **MUST NOT** ship as a dead-end screen with no AI entry or exit. |
| DNA-FEAT-17 | **MUST NOT** require the user to re-enter data the system already knows. |
| DNA-FEAT-18 | **MUST NOT** introduce a second login, second patient record, or second inventory truth. |
| DNA-FEAT-19 | **MUST NOT** prioritize decorative animation over functional UI readiness. |
| DNA-FEAT-20 | **MUST NOT** copy a reference product’s brand identity or trademarked UX chrome. |
| DNA-FEAT-21 | **MUST NOT** bury critical clinical/financial safety under “smart” defaults. |
| DNA-FEAT-22 | **MUST NOT** expand scope by adding adjacent modules “while we are here” without Gate 0. |

---

## 7. Quality Standards (Apple + Linear Bar)

DentVision quality is not “good enough for dental software.”  
Quality **MUST** match the emotional and operational bar of top global tools.

### 7.1 Interface Performance (Linear-class)

| ID | Standard |
|----|----------|
| DNA-Q-01 | Core interactions **MUST** feel instant; perceived lag **MUST NOT** be excused by “enterprise complexity.” |
| DNA-Q-02 | Navigation **MUST** be predictable; users **SHOULD** complete frequent tasks without hunting. |
| DNA-Q-03 | Motion **MUST** clarify hierarchy or state change. Motion **MUST NOT** delay input readiness. |
| DNA-Q-04 | Dense professional screens **MUST** remain scannable: one primary action per view region. |

### 7.2 Human Interface Craft (Apple-class)

| ID | Standard |
|----|----------|
| DNA-Q-05 | Visual hierarchy **MUST** make the next action obvious within 2 seconds on first view. |
| DNA-Q-06 | Typography, spacing, and contrast **MUST** be intentional; default system-looking sprawl is a defect. |
| DNA-Q-07 | Components **MUST** come from a coherent design system (Figma-like variant discipline in code). |
| DNA-Q-08 | Accessibility basics (contrast, focus, labels, hit targets) **MUST** be present for primary flows. |
| DNA-Q-09 | Error messages **MUST** explain recovery; blame-the-user copy is forbidden. |

### 7.3 Conversation Quality (ChatGPT-class)

| ID | Standard |
|----|----------|
| DNA-Q-10 | AI replies **MUST** be useful in the first answer more often than they ask unnecessary questions. |
| DNA-Q-11 | When ambiguous, AI **SHOULD** ask one precise clarifying question, not interrogate. |
| DNA-Q-12 | Tool results **MUST** be visible as structured confirmations, not hidden side effects. |

### 7.4 Documentation & DX (Stripe + Vercel-class)

| ID | Standard |
|----|----------|
| DNA-Q-13 | Specs **MUST** be short, normative, and linked; novels without requirements are invalid. |
| DNA-Q-14 | Engineers and agents **MUST** be able to implement from docs without Slack archaeology. |
| DNA-Q-15 | Local development defaults **SHOULD** be fast, safe, and obvious. |

### 7.5 Ecosystem Utility (Kaspi-class super-app coherence)

| ID | Standard |
|----|----------|
| DNA-Q-16 | Cross-module journeys (e.g., inventory → marketplace order) **MUST** feel like one product. |
| DNA-Q-17 | Context **MUST** travel with the user; module switches **MUST NOT** reset essential state without reason. |

### 7.6 Definition of Done (Quality Gate)

A feature is done only when:

1. Gate 0 and Gate 1 pass  
2. DNA-FEAT absolute rules pass  
3. AI path works  
4. Manual path works if AI is down  
5. Empty/loading/error/success are real  
6. Tenant/RBAC safety checked  
7. No known world-class UX embarrassment on the happy path  

If any item fails, status **MUST** remain incomplete.

---

## 8. Agent & Human Compliance Checklist

Before implementing or reviewing any feature, answer:

- [ ] Mission Gate 0: all six YES  
- [ ] DNA Gate 1: world-class + AI-reachable + single truth + automation + ecosystem + simplicity  
- [ ] AI is primary entry or explicitly integrated  
- [ ] No duplicated data plane  
- [ ] Confirmations for dangerous actions defined  
- [ ] Design-system reuse preferred  
- [ ] Acceptance criteria written with MUST language  
- [ ] Quality bar would not embarrass Linear/Apple/Stripe on the happy path  

If an item is unchecked, work **MUST NOT** be marked complete.

---

## 9. Final Law

DentVision **MUST** feel like an intelligent operating system for dentistry.

If a change makes DentVision feel like “another dental CRM with extra tabs,” that change **MUST** be rejected or redesigned — regardless of short-term convenience.

**The product DNA is not inspiration. It is law.**
