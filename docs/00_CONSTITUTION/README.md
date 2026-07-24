# DentVision Constitution

**Status:** CORE  
**Purpose:** Highest-authority, short, normative documents that bind product, design, engineering, and AI agents.

---

## Document series

| ID | Document | Status |
|----|----------|--------|
| 01 | Mission *(canonical copy also at [`../spec/MISSION.md`](../spec/MISSION.md))* | CORE |
| **02** | **[`02_PRODUCT_DNA.md`](./02_PRODUCT_DNA.md)** | **CORE / CRITICAL** |
| 03+ | Reserved (architecture laws, UX laws, security laws, …) | — |

---

## How to write Constitution docs

1. Keep documents **short and unambiguous**.
2. Use **MUST / SHOULD / MUST NOT / MAY** for every binding rule.
3. Give stable rule IDs (`DNA-AI-01`, …) so humans and agents can cite them.
4. Prefer tables and checklists over essays.
5. Adapt world-class principles; **never** copy brand identities.
6. Ambition level is **global**, not regional.

---

## Authority order

1. Constitution (`docs/00_CONSTITUTION/`)
2. Platform Specification (`docs/spec/`)
3. Blueprints (`BLUEPRINT.md`, `UX_BLUEPRINT.md`)
4. Code

---

## For AI agents

Before building a feature:

1. Read Mission Decision Rule  
2. Read Product DNA Gates + FEAT rules  
3. Implement only if checklist items can be marked complete  
4. Cite failing rule IDs when blocking or requesting redesign  
