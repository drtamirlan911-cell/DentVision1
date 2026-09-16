# DentVision Documentation Constitution

**Status:** CORE  
**Purpose:** define the small set of authoritative documents and prevent duplicate or conflicting product direction.

---

## Canonical document hierarchy

DentVision uses one product/system specification plus separate execution, evidence, quality and domain documents. No new roadmap or competing product specification should be created when an existing canonical document can be extended.

| Layer | Canonical document | Purpose |
|---|---|---|
| Quality law | [`02_PRODUCT_DNA.md`](./02_PRODUCT_DNA.md) | Non-negotiable product/design/engineering quality rules |
| Product + system truth | [`../../DENTVISION_MASTER_SPEC.md`](../../DENTVISION_MASTER_SPEC.md) | Single normative source for product intent, architecture guardrails, UX direction and P0 completion |
| Execution | [`../../DENTVISION_EXECUTION_PLAN.md`](../../DENTVISION_EXECUTION_PLAN.md) | Sequencing, Definition of Done and active execution queue |
| Current state | [`../../DENTVISION_CONTEXT.md`](../../DENTVISION_CONTEXT.md) | Verified repository state and session bootstrap |
| Evidence/history | [`../../DENTVISION_EXECUTION_LOG.md`](../../DENTVISION_EXECUTION_LOG.md) | Durable implementation, verification and blocker history |
| Economics | [`../business/DENTVISION_PARTNER_ECONOMICS.md`](../business/DENTVISION_PARTNER_ECONOMICS.md) | Sole canonical pricing, commission and settlement policy |
| Generated facts | `../SYSTEM_MAP.md` | Code-generated system inventory; never manually treated as product intent |
| Domain contracts | `docs/` security, IAM, branch, laboratory, legal and other specialized specs | Detailed constraints for a bounded domain; they must not redefine product direction |

---

## Product scope invariant

DentVision is a **Dental Operating System / ecosystem for the whole dental industry**.

Clinics are one participant type, not the default center of the product. Doctors, patients/buyers, clinic organizations, diagnostic centers, radiologists, medical laboratories, dental laboratories, suppliers, academies, lecturers, students, employers, job seekers and other supported participants must be treated as first-class users/workspaces according to the implemented role and organization model.

The UX may reveal complexity progressively, but the underlying ecosystem scope must never be reduced to a clinic-first product.

---

## UX invariant

The product must preserve the existing ecosystem and make it easier to understand:

`Welcome / Discovery → intent → authentication only when required → contextual Home/Workspace → AI + real workflow`

Progressive disclosure is mandatory for complexity: do not place every module, control or organization type on the first screen. Do not remove real capabilities merely to make the interface visually simpler.

---

## Documentation rules

1. Existing canonical documents are extended rather than duplicated.
2. Historical documents remain only when they preserve useful evidence or decisions; otherwise they are removed after reference checks.
3. Generated inventories are regenerated from code rather than hand-edited.
4. A stale status document is not release evidence.
5. Product decisions must be reconciled against the current repository and CI/runtime evidence.
6. Any contradiction is resolved in the canonical layer; do not create another document to hide the conflict.
7. Domain documents may add constraints but must not silently replace the Master Spec.

---

## For AI agents

Before implementing product or UX work:

1. Read Product DNA.
2. Read the Master Spec.
3. Read the Execution Plan and Context for current sequencing/state.
4. Inspect the real code/routes/services before changing UX.
5. Reuse existing models, APIs, permissions and workflows.
6. Preserve all participant types and partner workflows.
7. Use progressive disclosure rather than deleting product capability.
8. Verify the result and record material changes in the execution log.
