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

## 5. Verified repository state — 2026-10-25

### Main and integration status
- Exact GitHub `main` HEAD at the start of this integration cycle: `b27f9b920ee08388dfb560c4ad0ff6243f461844`.
- Already merged before this reconciliation: PR #300 → `22c1350abf311859a791ff773d43e2b1fb1487b9`; PR #310 → `f1276fdb9ab2d7761f7e6c3f77e82eff752ac835`; PR #301 → `b27f9b920ee08388dfb560c4ad0ff6243f461844`. Their source branches remain intact.
- Integration workspace: `integration/merge-all-20261025`. Every session must re-read the live branch ref; do not assume a saved SHA remains current as reconciliation commits are added.
- Release status: **NOT READY**. No full exact-head CI/E2E/role-context/visual/Android pass has been established for current `main`; PR #310's CI run `40164023070` was still in progress at the last API check, and PR #301's E2E run `37469591391` was cancelled before it was merged. Candidate-branch success is not current-main evidence.
- Branch protection remains an open P0 control (RB-033 / issue #259). A previous audit reported protection disabled; this run could not independently re-read the administrative setting through the connected permission surface. Verify it in GitHub repository settings.
- No production deployment is authorized by this integration work. Source branches and existing CI artifacts remain preserved.

### Source branch / candidate evidence
- PR #310: DoctorAgent patient and appointment lookups are now tenant-scoped on main. Lint/type/unit jobs passed on source head `bf65526de39628201a94ab986c77cc38d73cbfbe`; E2E was still running at the last direct observation. Keep RB-034 open until exact-main E2E, branch/assigned-patient authorization, and the negative cross-tenant tests are verified.
- PR #301: clinical odontogram workspace is merged to main, but source CI `37469591391` had cancelled E2E. Preserve the merged code and rerun mobile, clinical-workflow, responsiveness, and role/context tests on the integrated candidate.
- PR #307: payment/production security candidate `adaaa90794018911451d9faa649aa880d9b093de`; lint and unit checks plus Android/Quality Gate passed, but CI `40064469652` failed the role/context release gate. GitHub rejected a direct merge because of conflicts.
- PR #302: release/IAM/finance/odontogram candidate `8855e522dce91b01652520bef2ccec6e21f5630f`; lint and Quality Gate passed, but CI `37791379352` failed core E2E, role/context, business-owner, and visual release checks. GitHub rejected a direct merge because of conflicts.
- PR #309: documentation candidate `f30119b4f6752e540327666f9f34afe4a17bfe96`; lint/unit/system-map checks passed, but its CI `40163222925` had not completed all E2E/visual/role-context checks at the last direct observation. Its overlapping documents must be reconciled rather than copied wholesale.
- PR #308: support-operations workflow design only; it does not itself prove the runtime support system is complete. Preserve its SUP-01…SUP-15 inventory checklist and validate actual code, database, IAM, notifications and tests before marking items done.

### Active high-risk release blockers
- RB-029 — Patient `medicalHistory` JSON may bypass the string-only PHI encryption helper; reader/writer inventory and a compatible, resumable encrypted-at-rest migration are still required.
- RB-019 — actual payment provider contract must be verified; a generic gateway HMAC example must not be described as the official Kaspi API contract.
- RB-033 — branch protection / required checks need repository-admin verification.
- RB-034 — DoctorAgent cross-tenant patient/appointment IDOR fix needs completed exact-head E2E and role/context evidence.
- Existing RB-001…RB-009 entries and the payment/PHI blockers introduced by PR #307 remain open unless their own fixing commit and verification evidence are recorded.

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
