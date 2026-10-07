# DentVision — Session Bootstrap / Current Context

**First-read file for every future DentVision AI/engineering session.**

## 1. Repository identity
- Product: DentVision — Dental Operating System / ecosystem.
- Repository: `drtamirlan911-cell/DentVision1`.
- Persistent execution directive: `DENTVISION_OPERATING_DIRECTIVE.md`.
- Execution plan: `DENTVISION_EXECUTION_PLAN.md`.
- Execution evidence/history: `DENTVISION_EXECUTION_LOG.md`.
- Product/system source of truth: `docs/DENTVISION_MASTER_SPEC.md`.
- Product quality law: `docs/00_CONSTITUTION/02_PRODUCT_DNA.md`.
- Retained reference blueprint: `DENTVISION_SUPERAPP_BLUEPRINT.md`.
- Canonical economics: `docs/business/DENTVISION_PARTNER_ECONOMICS.md`.

## 2. Authority and anti-confusion rules
1. Current repository code and current CI/runtime evidence are authoritative for implementation status.
2. This file is the current bootstrap; it must be updated when verified state changes.
3. The Operating Directive is the persistent implementation/growth contract and must survive chat/session changes.
4. The Execution Plan controls sequencing and Definition of Done.
5. The Execution Log records material changes and evidence.
6. `docs/DENTVISION_MASTER_SPEC.md` is the single normative Product/System source of truth.
7. Product DNA is the constitutional quality law.
8. `DENTVISION_SUPERAPP_BLUEPRINT.md` is a retained reference blueprint and must not compete with the Master Spec.
9. Economics policy is the only canonical pricing/commission/accounting source.
10. Never mark DONE because a route, screen, model, or document exists.
11. Never create a competing roadmap, current-state file, release gate or product specification without a clearly different bounded purpose.
12. Preserve all unfinished previous work while adding new priorities.

## 3. Status vocabulary
- DONE = implementation + workflow + verification evidence agree.
- PARTIAL = meaningful implementation exists but full workflow is incomplete.
- BROKEN = intended path exists but verification exposes a defect.
- UNVERIFIED = implementation may exist but evidence is insufficient.
- NOT IMPLEMENTED = capability absent or only scaffolding/UI exists.
- CONFLICT = sources disagree; resolve from current evidence.

## 4. Product north star
DentVision is one Dental Operating System and ecosystem for the whole dental industry, not a clinic-first CRM.

Clinics, professionals, patients/buyers, diagnostic centers, radiologists, medical laboratories, dental laboratories, suppliers, academies, lecturers, students, employers, job seekers and platform roles are first-class participants according to the implemented identity, organization, workspace and permission model.

Clinical graph:
`Patient → Diagnosis → Imaging → AI Findings → Treatment Plan → Appointments → Procedures → Lab → Materials → Documents → Payments → Communication → Follow-up → Outcome`

Cross-ecosystem graph:
`Professional / Organization ↔ Network ↔ Practice ↔ Diagnostics ↔ Laboratory ↔ Shop/Suppliers ↔ Academy ↔ Jobs ↔ Finance ↔ AI`

The UI uses progressive disclosure: the underlying ecosystem remains complete, while each user sees the context and next useful action relevant to their role and task.

AI action lifecycle:
`Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit`

## 5. Verified repository state — 2026-10-07
- `main` remains the product source of truth; PR #302 is the active release-blocker remediation branch.
- Current PR #302 exact HEAD: `f45ea6ced5648e2accfaa4ab4b8d6c8106c4634c`.
- Quality Gate #4791 passed on the preceding exact-head `7b86b600dd9253334b26fd21ce89ae4e01b4aa6b`, including TypeScript, frontend ESLint and the repository release-gate step.
- Full CI #3816 reached real execution on `7b86b600dd9253334b26fd21ce89ae4e01b4aa6b`: frontend lint, backend lint, build/typecheck, Command Center audit and generated system-map validation passed; unit tests finished at **2048 passed / 1 failed** across 221 test files.
- The single CI #3816 unit-test failure was a source-inspection boundary defect in `organizations.test.ts`; it was repaired on `a0f87c0e8f1756887d73a09ca67a6bfa7a513a01` by slicing the actual control-flow branches rather than an object-literal field.
- `f45ea6ced5648e2accfaa4ab4b8d6c8106c4634c` records that repair in the execution log and synchronizes this context file. A fresh full CI must verify this post-fix exact HEAD; no superseded run is release evidence.
- PR #302 contains the current odontogram curved-arch refinement, notification detail/ownership hardening, and payment metadata/Academy settlement hardening; these remain unverified until fresh exact-head browser/E2E/visual evidence completes.

### Product status
- Clinical RBAC boundary: IMPLEMENTED + unit coverage; fresh CI required after later main changes.
- IAM / role matrix / tenant and branch isolation: PARTIAL; negative-path matrix continues.
- Active-session enforcement: IMPLEMENTED + E2E regression.
- Partner onboarding: PARTIAL.
- Economics engine/ledger: PARTIAL; deterministic engine and rule snapshots exist, durable paid→settled medical-analysis and full reconciliation remain open.
- Clinical OS / Treatment Case: PARTIAL.
- Diagnostics: PARTIAL; confirmation action exists, full clinic→partner→result→confirmation→payment lifecycle is not release-proven.
- Medical analysis laboratories: PARTIAL.
- Dental laboratories: PARTIAL.
- AI control plane: PARTIAL.
- Marketplace / Academy / Jobs / Community: PARTIAL.
- Finance Hub: PARTIAL.
- UX/design system: PARTIAL; documentation now establishes ecosystem-first progressive-disclosure direction.
- Web release: NOT READY until fresh gates prove the target commit.
- True natural interactive 32-tooth WebGL/3D odontogram: NOT IMPLEMENTED; current dental chart is not evidence of a WebGL renderer.
- Android release: UNVERIFIED until fresh build/install/runtime evidence exists.

## 6. Known implementation facts
- `TreatmentCaseWorkspace` exists; full case lifecycle remains unverified/partial.
- Root `/` has a public-first Welcome path for anonymous users; authenticated entry must be evaluated against the current contextual Home/AI behavior rather than assuming a clinic dashboard.
- Diagnostics has real referrals, center/lab access checks, studies, files and AI-result flows.
- Auth middleware requires an active `UserSession` for protected users; the E2E regression verifies revoked sessions return 401.
- Branch-scoped IAM foundations exist across clinic, finance, diagnostics and inventory domains.
- `quality-gate.yml` is blocking; a failed release gate cannot silently produce a green workflow.
- `docs/SYSTEM_MAP.md` is generated from source and must be regenerated with `npm run system-map`/the repository's configured generator rather than manually edited.

## 7. Canonical economics
Use `docs/business/DENTVISION_PARTNER_ECONOMICS.md` only for pricing, commissions and settlement rules. Historical calculations must remain reproducible.

## 8. Required role/security matrix
Clinic: Owner, Administrator, Manager, Doctor, Assistant.
Partners: Diagnostic Center Owner/Manager/Operator/Radiologist as applicable; Medical Laboratory Owner/Manager/Operator; Dental Laboratory Owner/Manager/Technician/Operator as applicable; suppliers/academies and other supported partner roles according to current IAM.

For every role verify: allowed/denied actions, tenant isolation, branch isolation, invitations, disabled/revoked access, active-session enforcement, audit trail and privileged mutation safety.

## 9. Product-led growth directive
The product should reduce explanation and increase self-demonstration/value:
`Visitor → Interactive Discovery/Demo → Signup → Role/Goal → First Value → Trial → Payment → Upgrade → Expansion → Referral`

Priority capabilities:
- privacy-aware growth event vocabulary;
- role/goal onboarding using real IAM/org/branch/workspace state;
- First Value Engine targeting meaningful value in under 10 minutes;
- contextual Next Best Action;
- AI product-operator behavior within permission/risk/audit rules;
- contextual trial/upsell based on real entitlement and usage;
- transparent ROI/value explanations;
- privacy-safe patient/treatment-plan sharing loop;
- clinical-context links to Shop, Diagnostics, Dental Lab and Academy;
- management growth analytics using existing Finance/Analytics truth.

## 10. Canonical branch management contract
Branch management is part of the existing Organization/Workspace model. Do not create a separate branch product or organization model.

Owner entry point:
`Owner → Settings / Organization → Branches`

Capabilities:
- list active/archived branches;
- create, persist and edit branches;
- open/switch authorized branch workspace;
- assign/change/disable/revoke staff access;
- configure supported branch settings;
- inspect branch operational and financial status;
- archive/deactivate without destroying required history/audit records.

At minimum, branch-aware patient, appointment, inventory, invoice, expense and referral/diagnostic data must obey backend scope authorization where the domain supports branch scope.

Branch-aware AI includes active organization + branch context but never bypasses authorization.

## 11. Documentation consolidation rule
The canonical documentation set is intentionally small:

- Product DNA = quality law.
- Master Spec = product/system truth.
- Execution Plan = sequencing and Definition of Done.
- Context = verified current state.
- Execution Log = evidence/history.
- Partner Economics = financial policy.
- Specialized domain documents = bounded technical/legal/security contracts.
- Generated system maps = code facts.

Superseded product roadmaps, stale status snapshots and duplicate North Star/addendum documents must not compete with the Master Spec. They may be removed after repository-reference checks; useful requirements must first be incorporated into the canonical document.

## 12. Working rule
For each slice: **inspect → implement → test → fix → verify → document → continue**.

Do not repeat an audit when implementation can resolve the issue. Do not weaken tests. Do not invent a parallel architecture. Preserve the whole ecosystem and make complexity progressively discoverable.
- `4f540e4fc256779ad8598beebc898d206925322d` contains a focused odontogram UX refinement: desktop places the selected-tooth clinical context beside the curved upper/lower arches; mobile stacks it below. This is implementation evidence only until fresh exact-head CI/browser/visual gates pass.


## 2026-10-08 — Current verified checkpoint
- PR #302 remains open/draft and release remains UNVERIFIED.
- Latest code changes after the previous checkpoint: physical branch timestamp alignment across E2E factories, patient branch scope, branch API and IAM context discovery; AI workspace 36px descendant button target guard.
- These changes were driven by exact CI #3822 evidence: branch raw-SQL column mismatch caused cascading patient/appointment/clinical/IDOR failures; /me/contexts had the same stale timestamp query; Mobile Design Gate exposed undersized AI controls.
- Fresh exact-head CI/Quality Gate must be used for release decisions after the latest documentation checkpoint.

## 2026-10-08 — Marketplace context hardening
- Marketplace list/detail now enforce catalog audience at the route boundary for PUBLIC/PATIENT contexts; authenticated PATIENT is explicitly recognized by the content-access resolver.
- This addresses the exact CI #3822 patient-context professional-product exposure assertion without weakening the E2E contract.
- Fresh exact-head CI remains the release evidence source; release is still UNVERIFIED.
