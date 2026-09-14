# DentVision — Session Bootstrap / Single Source of Current Context

**Purpose:** This file is the first-read bootstrap for any future AI/session working on DentVision. Do not require the user to name a document before reconstructing project state.

## 1. Repository identity
- Product: DentVision — Dental Operating System / ecosystem.
- Repository: `drtamirlan911-cell/DentVision1`.
- Primary product source of truth: verified repository code + current branch/PR evidence.
- North-star product requirements: `DENTVISION_SUPERAPP_BLUEPRINT.md` and `DENTVISION_SUPERAPP_MASTER_PLAN.md`.
- Current implementation/release reconciliation: `docs/DENTVISION_RECONCILIATION_2026-09-14.md`.
- Canonical economics policy: `docs/business/DENTVISION_PARTNER_ECONOMICS.md`.
- Execution sequencing: `DENTVISION_EXECUTION_PLAN.md` and `DENTVISION_EXECUTION_LOG.md`.
- Do not treat old audit checkboxes or stale state files as proof of completion.

## 2. Mandatory bootstrap procedure
Before making a product/release claim:
1. Read this file.
2. Read `docs/DENTVISION_RECONCILIATION_2026-09-14.md`.
3. Inspect current branch/PR and latest CI if the question concerns current implementation or release readiness.
4. Use the north-star blueprint/master plan for requirements, not as implementation evidence.
5. Use the economics policy for all prices, commissions, floors, caps, tiers and accounting semantics.
6. If sources disagree, prefer current verified code/evidence for implementation status and record the conflict instead of silently choosing a checkbox.
7. Never mark a feature DONE merely because a route, screen, model, or document exists.

## 3. Status vocabulary
- DONE = implementation + end-to-end workflow + verification evidence agree.
- PARTIAL = meaningful implementation exists but the full workflow is incomplete.
- BROKEN = intended path exists but current verification exposes a defect.
- UNVERIFIED = implementation may exist but evidence is insufficient.
- NOT IMPLEMENTED = required capability is absent or only scaffolding/UI exists.
- CONFLICT = repository documents and current code disagree.

## 4. Product north star
DentVision is one Dental Operating System, not separate CRM/Shop/Academy/AI products. The central business/clinical connector is the Clinical/Treatment Case.

Canonical clinical graph:
`Patient → Diagnosis → Imaging → AI Findings → Treatment Plan → Appointments → Procedures → Lab → Materials → Documents → Payments → Communication → Follow-up → Outcome`

AI critical-action model:
`Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit`

Core workspaces include Home/Today, Practice/CRM, Diagnostics, AI, Shop, Academy, Analytics and Network, with role-based administration and mobile navigation.

## 5. Current verified state — 2026-09-14
### Release
- PR #275: open, not merged; branch `feat/iam-role-matrix-v2`.
- Current head at last reconciliation: `0f3b54a3e12f3e91868d8c3743fd4770e097da95`.
- Do NOT merge until required CI/Quality Gate/E2E are green.
- Latest reconciliation records CI/Quality Gate as BROKEN because backend TypeScript has an orphan `svc.confirmAiResult` call in diagnostics routes.
- Vercel preview may be unavailable because the free-plan daily deployment limit was reached; this is an external deployment limit, not proof of a code defect.

### Product
- IAM / partner roles: PARTIAL.
- Tenant/branch isolation: PARTIAL; negative-path release matrix still required.
- Partner onboarding: PARTIAL.
- Economics/ledger: PARTIAL; strong engine foundation exists, but durable paid/settled medical-analysis and full reconciliation remain open.
- Clinical OS / Treatment Case: PARTIAL.
- Diagnostics: PARTIAL.
- Medical analysis laboratories: PARTIAL.
- Dental laboratories: PARTIAL.
- AI control plane: PARTIAL.
- Marketplace / Academy / Jobs / Community: PARTIAL.
- Finance Hub: PARTIAL.
- UX/design system: PARTIAL.
- Web release: NOT READY.
- True natural interactive 32-tooth WebGL/3D odontogram: NOT IMPLEMENTED; current dental chart is not evidence of a Three.js/WebGL/Babylon renderer.
- Android release: UNVERIFIED / NOT RELEASE-READY until fresh build/install/runtime evidence exists.

## 6. Known implementation facts
- Root `/` currently maps to Dashboard; an older Sep-9 audit claiming AIWorkspaceIndex at `/` is stale.
- `TreatmentCaseWorkspace` exists in current code; the older audit claiming no first-class TreatmentCase UI is stale. Completeness of the full case lifecycle is still unverified/partial.
- Diagnostics has real routes, referrals, center/lab access checks, studies, files and AI-result flows, but full clinic→partner→result→confirmation→payment→economics lifecycle is not release-proven.
- Public booking and diagnostics discovery exist, but route existence is not proof of production lifecycle completeness.
- Current package dependencies do not establish a real 3D dental renderer.

## 7. Canonical economics — never invent alternatives
Source: `docs/business/DENTVISION_PARTNER_ECONOMICS.md`.
- Clinic SaaS: START ₸19,900; PRO ₸39,900; BUSINESS ₸79,900; NETWORK from ₸149,900/branch.
- Diagnostic/3D center: ₸49,900/branch/month; 7% on DentVision-originated orders; min ₸500/study; max ₸3,000/study.
- Medical analysis lab: ₸19,900/branch/month; 6%; min ₸150/analysis; max ₸2,500/analysis.
- Dental lab: ₸29,900/month; canonical policy contains 8% default plus volume tiers and min/max constraints; preserve the policy verbatim when implementing until an explicit policy revision resolves any internal tier/default ambiguity.
- Marketplace: standard 8%, high-volume 6%, strategic 4–5%.
- Academy: lecturer-originated 10/90; DentVision-originated 25/75; full marketing+sales 30/70.
- Finance must distinguish GMV, gross platform revenue, processing, AI inference, storage/data, support/ops, refunds/chargebacks, tax/VAT, contribution margin and net platform revenue.
- Pricing changes require version/effective date/migration/impact/audit and no silent retroactive repricing.

## 8. Required role matrix
At minimum verify:
- Clinic: Owner, Administrator, Manager, Doctor, Assistant.
- Partners: Diagnostic Center Owner/Manager/Operator/Radiologist as applicable; Medical Laboratory Owner/Manager/Operator; Dental Laboratory Owner/Manager/Technician/Operator as applicable.
- Also verify Superadmin where applicable.
For every role test: allowed actions, denied actions, tenant isolation, branch isolation, invitation lifecycle, disabled/revoked access, active-session enforcement, audit log and privileged mutation safety.

## 9. Working rules for future sessions
- Do not ask the user which document to read when the answer can be reconstructed from this bootstrap plus repository evidence.
- Do not repeat audits without changing the evidence or resolving a known blocker.
- Do not create fake endpoints/models/permissions solely to satisfy tests.
- Preserve existing routes/API contracts/data relationships unless the requirement explicitly changes them.
- When implementing, work on the active feature branch, verify, then record the evidence here or in the reconciliation document.
- Keep one current status vocabulary and one current release picture.
- Never silently overwrite a newer state with an older document.
- If a document is stale, mark it stale and use current code/CI evidence.

## 10. Immediate queue
1. Fix the real `diagnostics.routes.ts` → `svc.confirmAiResult` backend TypeScript defect or remove the route if it is not part of the intended contract.
2. Re-run backend TypeScript/lint and full CI.
3. Re-run full E2E and then business-owner, organization-owner and browser UX gates.
4. Complete role × tenant × branch × invitation × disabled-session negative matrix.
5. Finish economics paid→settled boundaries, especially medical-analysis, and durable reconciliation.
6. Verify complete Clinical Case lifecycle.
7. Verify partner operational lifecycles and Finance Hub transparency.
8. Finish accessibility/responsive/performance/error-state/security/release hardening.
9. Rebuild/install/run Android before calling mobile release complete.

**Rule:** A future session should be able to start from this file and immediately know what is authoritative, what is stale, what is implemented, what is not, why, and what to do next.
