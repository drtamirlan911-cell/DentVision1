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

## 2A. Current branch and release evidence — 2026-10-20

- Active implementation branch: `security/payment-hardening-20261017`; pull request: [#307](https://github.com/drtamirlan911-cell/DentVision1/pull/307), still draft pending release verification.
- Production `main` was not changed by this release-gate work.
- Previous candidate `0134e6881687f5c9de7efe1c6ebe10eaa544d651`: Quality Gate and Android passed; backend/frontend lint and unit/build jobs passed; core E2E, browser UX and mobile design gate passed. The role/context gate remained in progress in the latest connected status because the full route matrix was repeated across eight viewport projects.
- Follow-up factors viewport-independent authorization/tenant checks into one exhaustive `role-1280` run while retaining role-specific critical-screen DOM/responsive audits and the required screenshot per role per viewport. SPA route discovery no longer sleeps before successful first reads. The existing 60-minute CI E2E-job limit remains in place.
- This follow-up remains **UNVERIFIED** until the exact-head CI, role/context, Visual Agent, business-owner and organization-owner gates finish. Do not merge or mark release-ready on the older candidate evidence.
- Render API health was observed returning HTTP 200 with database status `ok` on 2026-10-19; Vercel reported no runtime-error clusters for its queried 24-hour window. These observations do not close the application release blockers.
- RB-010 through RB-024 remain governed by `docs/RELEASE_BLOCKERS.md`; RB-019 specifically remains open because public Kaspi partner pages reviewed do not establish the technical API/callback contract assumed by the generic provider adapter.

## 2B. Latest role-gate findings — 2026-10-20

- Last checked candidate: `794638197e17a0cbd46180ca1406c31e67839a1d`. Core E2E, browser UX, mobile design gate, Quality Gate, Android, Visual Agent, business-owner and organization-owner stages passed; role/context failed on route-policy, student landing and responsive UI findings. CLI smoke failed at installation/invocation; visual validation failure was downstream from incomplete role screenshots after serial-test abort.
- Follow-up fixes role-to-School routing for student effective roles, treats the existing public `/community` feed as public in role-policy tests, preserves partner `effectiveRole`, fixes measured 36px touch controls and clipped reminder labels, and preserves failure screenshots.
- Playwright CLI invocation is corrected against official CLI docs; development-only CORS includes the 127.0.0.1:3000 loopback alias with explicit tests. Production CORS allowlist is unchanged.
- These changes remain **UNVERIFIED** pending exact-HEAD CI. Keep PR #307 draft and do not deploy.
- Canonical register: `docs/RELEASE_BLOCKERS.md`, RB-003, RB-025, RB-026; history: `DENTVISION_EXECUTION_LOG.md`.

## 2C. E2E execution efficiency findings — 2026-10-23

- Workflow run 39962109509 used exact head `5bb2e385434e038519de186c672a99aa6f44da56`. Frontend lint, backend lint, Quality Gate, Android, and unit checks passed. Core E2E passed in 64 seconds; browser UX passed in 106 seconds; mobile design passed in 117 seconds. On prior run 39959200531, mobile design took 165 seconds. The current mobile evidence artifact was 19.5 MB compressed.
- The role/context matrix was still active after roughly 14 minutes without a reported gate result. It audits 71 declared routes across 16 roles plus discovered routes. The fixed 300 ms sleep after each route accumulated as artificial wait time.
- The role gate now waits for meaningful root content and the disappearance of a full-screen loading/auth skeleton. For forbidden routes it waits for the URL path to leave the protected path, with a bounded timeout; route, role, and negative-access assertions remain enabled.
- CI records per-gate duration/log location and an artifact manifest; full HTML/CLI reports are failure-only; passed mobile screenshots stay available for seven days. Summary extraction includes escaped literal `expect(` matches.
- The new commit supersedes run 39962109509 before its role gate completed. Results for that role gate and subsequent stages on the superseded SHA are **not verified**. Keep PR #307 draft, do not merge/deploy, and require checks for the latest exact head.


## 2D. Exact-head role-gate follow-up — 2026-10-23

- Candidate before this follow-up: `9f7efd2b6c1946f0f15ffdd8400d9439b31f8b29`; CI run `39965626810`.
- At inspection, frontend lint, backend lint, lint/unit/build, core E2E, browser UX, and mobile design gate had passed; Quality Gate and Android workflows were successful. The role/context gate was still running, so its outcome and downstream Visual Agent/business-owner/organization-owner/CLI/visual-release gates were not verified.
- This follow-up deliberately supersedes the in-flight run to remove successful-path DOM/HTML artifact bloat, replace fixed sleeps with state-based readiness checks, and reconcile conflicting control-plane document references. The prior role result is neither pass nor fail.
- The new branch head remains UNVERIFIED pending CI, E2E, browser/role, Visual Agent, partner lifecycle, CLI smoke, visual release evidence, and relevant platform checks on that exact HEAD. Keep PR #307 draft; do not merge or deploy.

## 2E. Exact-head release-gate triage — 2026-10-24

- Previous candidate: `f681f4b8f0784a1f8553da5612c58634593b2ab9`; workflow run `39970030360` completed on 2026-10-23. This run is evidence for that SHA only, not for the follow-up candidate.
- Passed on that SHA: frontend lint, backend lint, lint/unit/build Quality Gate, Android, core E2E, Browser UX, mobile design gate, business-owner journeys, organization-owner lifecycle and Playwright CLI smoke.
- Failed on that SHA: role/context gate (58 attempts failed), Visual Agent (3 failed, 44 passed) and visual release evidence validation downstream from missing role screenshots. The overall E2E job failed; no release-ready conclusion is allowed.
- **RB-031 root cause:** the page origin was `http://localhost:3000` while browser API calls used `http://127.0.0.1:3001`; WebKit still reported access-control errors for `/api/guest/session` and `/api/ai/proactive`. The previous API-only hostname change was insufficient. The follow-up aligns both browser and API loopback hostnames and updates direct probes; production CORS policy is unchanged.
- **RB-025 root cause:** the clinic `owner` label rendered `Руководитель`, while the canonical IAM role matrix requires `Владелец`. The follow-up changes only the display label, not the role/permission bundle.
- **RB-003 root cause:** the shared `Button asChild` wrapped its child in a React Fragment before passing it to Radix `Slot`, preventing classes/size from reaching the child anchor. The patient portal CTA was measured at 149×24. The diagnostics `Все` action used the extra-small variant and measured around the 36px threshold. The follow-up fixes child propagation, adds a focused component regression test and raises the diagnostics action to `min-h-11`.
- **Artifact evidence:** run `39970030360` produced a 186,463,087-byte aggregate Playwright artifact and 175,929,159 bytes of traces. Compact diagnostics were 2,548 bytes. Large failure traces were preserved; do not delete or suppress evidence. Inspect the bounded manifest first on the next run.
- **Candidate implementation commit:** `3da346f752defe23853031747dde9e9dda5abdac`. A metadata/state commit is created directly on top of this implementation commit; only the final branch tip is eligible for exact-head verification.
- `main` and production remain untouched; PR #307 remains draft. The new candidate is **UNVERIFIED** until GitHub Actions completes all required gates on its exact final SHA.

### Root-cause 5-Why summaries
1. WebKit network errors persisted because the page and API used different loopback hostnames; prior work changed only the API host, and direct probes still hard-coded localhost. Root cause: inconsistent CI origin canonicalization, not a reason to weaken CORS.
2. Owner identity failed because the frontend's owner display label drifted from the canonical IAM matrix. Root cause: duplicate presentation mapping was not reconciled with the role contract; permissions remain unchanged.
3. The patient portal link had no design-system hit target because `Button asChild` passed a Fragment rather than the actual child element to Radix `Slot`. Root cause: polymorphic component implementation violated its class/size forwarding contract; a component regression test now covers it.
4. The diagnostics action was below the intended touch-target floor because it used the extra-small variant without a minimum height. Root cause: one action had not adopted the existing touch-target convention; `min-h-11` corrects it without weakening the gate.

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

## 5. Historical repository baseline — 2026-09-16 (reference only; not current release evidence)
- This section is a historical product/runtime snapshot retained for context. Its branch descriptions, status labels and CI result are not evidence for the current main or PR #307 head.
- Historical run `35066089223` on HEAD `844b469e084dd5acec6fb45f26d28757c27a3568` passed its listed checks at that time; subsequent changes mean that result must not support a current release claim.
- Use Sections 2A–2D and the newest exact-head workflow results for current verification. The current branch remains UNVERIFIED until all required gates pass on one exact HEAD.

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
