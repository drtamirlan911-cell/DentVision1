## Latest verified state — 2026-10-30
- Active implementation candidate: PR [#330](https://github.com/drtamirlan911-cell/DentVision1/pull/330), branch `fix/d1-d10-trial-archive-signing-api-20261029`.
- Pre-change live PR #330 HEAD for the 2026-10-30 role-gate follow-up: `77fc9c81fbc276621ad1a4d03a753e4733819722`. The same-branch follow-up now contains the School breadcrumb hit-area correction, regenerated System Map snapshot and additional RB-035 deposit-denial regressions; resolve the current SHA from PR #330 before any subsequent edit. Base/main remains `ac913cc3389a294d0b135a852b035ddddb1018ca`.
- The candidate now contains both parallel workstreams through history-preserving merge commits: PR #328 workspace picker/RBAC work (merge commit `091604d78d6457a0ae5e97a83ae96059c0dde945`) and PR #329 patient-history envelope work (merge commit `a3138609fb147cbee0a8cfeab3ffd397ceb6212d`). The original source PRs #328 and #329 remain open at their original heads and their branches were not rewritten.
- Temporary integration PRs #331 and #332 were closed as merged into the #330 working branch. Neither targeted `main`.
- Follow-up fixes on the integrated branch: corrected the trial/archive contract regex syntax; combined archived-membership filtering with active-clinic session hydration; combined clinical-chart/route permission checks with the 30-day write guard; combined patient-portal JSON-history encryption and client-ciphertext rejection with trial write checks and optimistic concurrency; minimized PatientCreated event payload to patient/clinic/user IDs plus `hasComplaints`; fixed the confirmed `_res` reference and stale CRM security assertion from #328.
- Exact-head CI for `415e4a9`: CI run [41034452583](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452583) is pending; Quality Gate [41034452312](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452312) and RB-034 diagnostic [41034452343](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452343) are in progress. No passing result is inferred.
- Release remains NOT READY: full non-cancelled E2E/role/owner gates, staging trial/archive migration verification, RB-029 consumer/concurrency and read-only staging dry run, production CORS/WebSocket, official Kaspi contract/callback, branch protection, and D10 workflow parity remain open.
- `main` was not changed. No staging/production database operation, backfill, or deployment was performed. No local checkout was available, so local `git status` and local tests are not claimed.

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

## 2A. Current branch and release evidence — 2026-10-30

- **Live main:** GitHub's `main` ref resolves to `ac913cc3389a294d0b135a852b035ddddb1018ca`. PR #330 is based on this SHA.
- **Active work target:** `drtamirlan911-cell/DentVision1`, branch `fix/d1-d10-trial-archive-signing-api-20261029`, existing PR [#330](https://github.com/drtamirlan911-cell/DentVision1/pull/330), OPEN / DRAFT / mergeable. The code/test follow-up head before this documentation pass was `411ae782f2bdb9964c4c8e5b40378c267ae8aaa1`. No branch or PR was created; nothing was merged to main.
- **Code/test commits in this run:** `c83cbd010f59399d4d1647366f3a6752e8e892a6` fixes the `/demo-clinic` existing-clinic lookup to recognize both legacy DEMO and new ENTERPRISE trial clinics; `e6c3147604f21acf0bf8766048f802540c54c015` aligns archive-aware IAM tests and adds archived-context denial regressions; `411ae782f2bdb9964c4c8e5b40378c267ae8aaa1` updates the clinic-creation contract to Enterprise/trialing/30-day semantics. These changes are committed to the existing PR branch.
- **D1 finding:** clinic creation now creates Enterprise + trialing, and the legacy migration upgrades eligible DEMO rows to Enterprise. The old `/demo-clinic` idempotency query still searched only `Clinic.plan = DEMO`; repeat calls could create duplicate clinics/trials. The lookup now accepts both DEMO and ENTERPRISE. The new tests have not yet been run on this exact head.
- **Last full CI evidence (pre-follow-up):** [run 40870315832](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/40870315832) tested PR merge ref `51a4e1f8dcc53b6284932127f482ccbb48d46c80` for candidate head `469b32d3403614a67151b649de9bf73f03ef9d15`. Frontend lint, backend lint, Quality Gate and RB-034 context diagnostic passed. Unit tests: 2,301 passed / 4 failed in `orgContext.test.ts` (three stale mock/expectation cases) and `auth.diagnostics-endpoints.contract.test.ts` (obsolete DEMO expectation). The test contracts were corrected in the commits above; a new exact-head run is required.
- **E2E evidence from run 40870315832:** overall E2E job concluded cancelled. Core: 240 passed, 5 skipped, 1 failed (BRANCH-003 branch option was outside viewport). Browser UX: 3 passed, 1 failed; HTTP 403 resources occurred on `/crm/patients` and `/crm/treatment-plans`. Mobile design gate passed 16/16. The compact diagnostics, core checkpoint and Browser UX checkpoint were inspected; full trace/screenshot collections were not loaded.
- **Other branches / PRs preserved:**
  - PR #328 `fix/workspace-switcher-menu-overflow-20261026`, head `966512b54a2937472732e2c94d23fd819de2edb0`, OPEN. Its own CI [40843992280](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/40843992280) failed backend lint (`planGate.ts` references undefined `_res`) and one stale CRM security contract; E2E cancelled. It is not a green fix for the picker/403 failures.
  - PR #329 `security/rb029-patient-portal-history-envelope-20261026`, head `c2e5951ba631da1762bd3380c3bbc35c51953770`, OPEN. Quality Gate and lint/unit stages passed; E2E was cancelled. RB-029 remains open pending complete consumer/concurrent-writer audit, backup/rollback review and staging dry run/backfill approval.
  - PR #322 `dev-env/codespaces-bootstrap-20261025`, OPEN / DRAFT and intentionally isolated. Quality Gate passed; CI failed and Vercel reported a build-rate-limit error. It must not be merged into product code as part of this task.
  - PR #326 auth/diagnostics is already merged into main.
- The remote branch search shows many historical `cursor/*`, `audit/*`, `autonomous/*` and other branches; only the first 100 branch names were returned in the listing page. No branch cleanup was performed.
- **Local git status limitation:** no local DentVision1 checkout was mounted in this execution environment, so `git status` / local uncommitted changes could not be read. Remote PR/base/head and branch state were verified through GitHub. Do not infer that a local working tree is clean.
- **Canonical documents checked:** Operating Directive, this Context, Execution Plan and Log; Product DNA; Master Spec v5.0; System Map; IAM Role Matrix; Release Blockers; Kaspi Clinic Setup; Partner Economics; Release Checklist; RB-029 medical-history inventory. The canonical IAM model is active context → Organization/Branch → scoped role/permission → ownership/resource state → audit. The Master Spec requires organization and branch isolation, fail-closed deep links and negative authorization journeys.
- **Document discrepancies / constraints:** `docs/security/RB-029_MEDICAL_HISTORY_ENCRYPTION_INVENTORY.md` is an older source-only inventory and still describes the encryption implementation as outstanding; the open #329 candidate contains the structured-envelope portal-writer correction but is not merged. `docs/RELEASE_CHECKLIST.md` is dated 2026-07-22 and lists Neon for `DATABASE_URL`; this is not proof of the live provider. Do not claim Neon or any other DB host until the deployed environment is independently verified.
- **Kaspi contract:** `docs/KASPI_CLINIC_SETUP.md` explicitly says its sample HMAC webhook is a DentVision adapter contract for a compatible third-party gateway, not the official Kaspi Pay/acquiring contract. Official merchant documentation and live callback verification remain required. Clinic-cash manual confirmation cannot confirm platform SaaS/Academy/Shop payments.
- **Partner economics:** `docs/business/DENTVISION_PARTNER_ECONOMICS.md` remains the sole canonical economics policy; its settlement-first snapshots and transparent partner-net rules were reviewed and not changed.
- The checked-in System Map snapshot reports 69 mounted routers, 691 unique handlers, 653 registrations, 99 routes without a detected consumer, 150 Prisma models, 12 background jobs and 11 permission roles. Treat these as the document's generated snapshot, not as proof that all Master Spec workflows are complete.
- No production DB query/write, migration, PHI backfill, staging migration, production CORS/WebSocket inspection, Kaspi live callback, branch-protection change, merge or deployment was performed.

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

## 5. Verified repository state — 2026-10-25
- Current verified main HEAD: 6581695e91eb70c638bc0b94efb10773d8882dd9. Keep main unchanged while P0 verification continues.
- Current RB-034 candidate is PR #323 on security/doctor-agent-tenant-isolation-20261025. Candidate SHA d632bff595a749f6e926269c5dbdc4ab4e707d8d has its focused RB-034 diagnostic and Quality Gate green; the full CI run 40216825980 was in progress at the last query. This does not yet establish a green release gate.
- The stronger local signing fix uses canonical PersonRole scoped to the user's active organization, rather than a broad general-role allow-list. BIZ-009 now forwards the onboarding access token to the IAM-context request. Fresh exact-head CI must verify the follow-up.
- Local evidence on the pre-rebase repair: 245 unit-test files / 2,232 tests passed; frontend typecheck/lint passed; backend typecheck, lint and build passed; focused signing/visibility tests 5/5 passed; project-index validation passed; generated docs/SYSTEM_MAP.md remains in sync. These local results must not be reported as GitHub CI results for a remote SHA.
- Earlier E2E failure findings: PARTNER-001 result-signing 403, BIZ-009 missing Bearer header, and 55 failures among 168 role/context checks. Inspect new exact-head artifacts after the scoped-role and request-token changes.
- RB-033 is still a P0 release blocker: main protection was reported disabled with no required checks; a repository administrator must configure and verify required checks.
- The Render dentvision-api service deploys from DentVision1/main. The listed Render Postgres database is the unrelated suspended romantic-invitations-db; the deployed database provider/host remains unverified. Do not infer Neon from Prisma usage alone.
- No production deployment, database or migration was changed.

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


## 2026-10-08 — Final pre-CI SQL checkpoint
- Corrected Branch raw SQL to use `created_at`/`updated_at` while preserving `clinic_members.updatedAt` camelCase.
- Marketplace public/patient filtering includes a JSON-array type guard for legacy tag shapes.
- This HEAD is the fresh release candidate for the next full CI evidence cycle; no readiness is inferred yet.


## 2026-10-08 — Finance/Inventory branch scope checkpoint
- Finance and Inventory branch-scope SQL now use the physical `branches.created_at` timestamp column.
- Adjacent branch-related backend files were reviewed for the same confirmed stale Branch timestamp pattern; no additional confirmed production references were found in the checked set.
- Current exact HEAD requires a fresh full CI/E2E/design/role/visual cycle before any readiness decision.


## 2026-10-08 — Pricing permission correction checkpoint
- PR #302 latest exact HEAD is `22274262449d88b6e5be09eef2dc09b4e66d0ef9`.
- Diagnostic/laboratory pricing and catalog mutations no longer share the cashier-enabled billing guard.
- This is a security hardening change only; no release readiness is inferred until fresh exact-head CI/E2E/browser/mobile/role/visual evidence exists.

## 2026-10-08 — Payment refund authorization checkpoint
- Clinic-scoped payment refunds now require the canonical `billing.manage` permission resolved against the exact clinic scope.
- The earlier member-only refund authorization path is removed.
- The latest exact PR #302 HEAD is `96c599643757e64b9a0a2a6fd2ecbde96b6ed048`.
- Release remains UNVERIFIED until fresh exact-head CI/E2E/browser/mobile/role/visual evidence exists.

## 2026-10-08 — Academy/Diagnostics policy checkpoint
- Academy course CRUD uses scoped `academy.manage` and active Academy organization context; course create derives Academy/lecturer ownership and update/delete reject foreign Academy rows.
- Academy format catalog routes and commerce registration now apply the canonical content-audience policy.
- Diagnostics referral clinic authorization now translates domain Clinic.id to canonical Organization.id through `assertClinicOrgAccess`.
- Latest documented HEAD: `da864b717d63d9a1a26bca14a1b6fd2978e41e96`.
- Fresh exact-head CI is pending; release remains UNVERIFIED.

## 2026-10-08 — Subscription finance checkpoint
- Generic subscription payment creation now requires scoped clinic billing authority and an exact server-derived plan total.
- Subscription settlement repeats the plan/amount invariant before activating the target clinic subscription.
- Latest documented HEAD: `a3c6f22b49475de8606a23ae1c1b1fa432df5028`.
- Release remains UNVERIFIED pending exact-head CI/E2E/browser/mobile/role/visual evidence.

## 2026-10-08 — Verification checkpoint
- Local full Vitest on the preceding exact branch state passed: 727/727 test suites, 2059/2059 tests.
- Current GitHub Quality Gate #5011 is green for `be7913e8d9c078d94fa96c4e11d342519a397138`.
- Current CI #3920 is still running its lint-test and E2E/browser/mobile/role/visual chain.


## 2F — E2E runner output stability — 2026-10-25

- Verified baseline `main` HEAD: `d273a4ecdd1daf8b3269d223c06a7a9c43a162e7`. The CI run `40183562189` for that exact SHA passed frontend lint, backend lint, TypeScript/build/system-map checks and unit tests, but the E2E job failed. Core E2E had 7 failures; role/context failed; business-owner journeys failed; organization-owner lifecycle hit a test timeout. The run is not release evidence for a passing candidate.
- The repository already has an isolated GitHub Actions test environment: PostgreSQL 16, E2E-only database sync/migrations/fixtures, local frontend/backend processes, Playwright Chromium/WebKit, and separate core, UX, mobile, role, visual and owner gates. Do not create a duplicate CI/E2E system.
- Confirmed runner bottleneck: `quality-scripts/run-e2e-gate.sh` used `tee` to stream the complete verbose Playwright output into Actions logs. The same main run uploaded 142.63 MB of traces and 155.26 MB of HTML/CLI artifacts after failures, despite also producing a compact diagnostic summary.
- Candidate change on `test-env/compact-e2e-output-20261025`: preserve complete per-gate logs on disk, print a heartbeat every 20 seconds, print a short success summary or at most 80 high-signal failure lines, and preserve the original command exit status. Shell syntax and success/failure exit-code behavior were checked locally with mock commands.
- Candidate verification status: **PENDING exact-head GitHub Actions CI/E2E**. This branch is isolated from `main` and the existing integration/security branches. Do not merge or deploy until the new exact-head run completes and all relevant gates are reviewed.

## Follow-up audit — 2026-10-26

- **Active implementation repository:** `drtamirlan911-cell/DentVision1`; keep separate from `DentVision-`, the simplified prototype.
- **RB-034 baseline:** candidate `security/doctor-agent-tenant-isolation-20261025` at `a539bad954795adbea59399e4bd6eae139ac7f6a`; CI run `40223952465` failed only at the full role/context design gate while backend/frontend lint, unit/type checks, Quality Gate and dedicated RB-034 context diagnostics passed.
- **Verified issues:** 24px Medical Card search target at desktop; E2E role expectations drifting from canonical pages for public Community, partner personal settings, ADMIN/MANAGER BI and assistant lab coordination; read-only `billing.read` exposing Finance/Cashier; Patient Portal lacking a role-context guard; global SUPERADMIN bypassing Supplier context.
- **Remediation candidate:** role policy, billing page derivation, Patient Portal guard, supplier guard and search hit target updated with regression assertions. This is pending CI evidence, not release-ready. Do not close RB-034 before a fresh full gate passes on the exact new HEAD.
- **Release policy:** do not merge while the full gate is red or modify production for these tests. Main branch protection remains a separate manual admin action unless verified through GitHub settings.


### 2026-10-26 — Exact-head role/context verification follow-up
- Current verification branch: `security/doctor-agent-tenant-isolation-20261025`; prior candidate `277bc824aa8e6ec90fd3f280ac9b026a14570454` passed backend/frontend lint, 2,240 unit tests, Quality Gate, dedicated RB-034 IAM-context diagnostics, core E2E, Browser UX and mobile design; role/context was still running when its test policy was reviewed.
- The next candidate corrects the anonymous route matrix for the documented public `/patient-portal` login/registration entry. It asserts the public entry and real login hand-off while preserving the authenticated non-patient redirect and guest denial at clinical APIs.
- Fresh exact-HEAD CI is required after this change. RB-034 and release readiness remain OPEN/NOT READY until all required security, role/context, Visual Agent, business-owner and organization-owner gates pass together.


## 2026-10-30 — PR #330 exact-head re-audit and correction checkpoint
- Active remote candidate remains `fix/d1-d10-trial-archive-signing-api-20261029`, PR #330. Reviewed pre-correction HEAD: `6b02e31eba480084ba57d481b130fcafafe037f5`; `main`: `ac913cc3389a294d0b135a852b035ddddb1018ca`. Local checkout was not mounted; local git status is unknown and must not be described as clean.
- Exact-head run 41004898403: backend/frontend lint, TypeScript/build, system-map validation and Quality Gate passed; unit tests were 2,316/2,326 with 10 failures. Three were stale static assertions in the trial/archive contract test; seven were Express referral middleware mocks without `method`. Candidate test updates correct the assertions/fixtures without relaxing runtime guards.
- Organization archive permission was rechecked against the canonical IAM matrix. Generic clinic `admin` / `org_admin` are daily-admin roles, not organization owners; the candidate removes them from the archive allow-list while retaining self-service Supplier/Academy owner roles and specialized partner-owner roles.
- Exact-head E2E remains failed/incomplete: core 240 pass / 5 skipped / BRANCH-003 viewport timeout; Browser UX 3 pass / one failure with 403 on `/crm/patients` and `/crm/treatment-plans`; mobile design gate succeeded (15 pass, one flaky WebKit navigation); role/context was cancelled and downstream gates skipped. The failing API paths behind the 403 are not present in the compact artifact and remain unresolved.
- PR #328 (workspace picker), #329 (RB-029 portal PHI envelope), and #322 (Codespaces) remain open on their own branches. Their refs were rechecked; no changes were copied, merged, closed or overwritten.
- No merge, staging/production migration, production DB write or deployment. Release remains NOT READY.
- Next checkpoint: validate the new corrective commit by exact-head CI; then resolve the 403s from endpoint-level backend/browser evidence, and independently complete staging/production release gates.
## Main CI follow-up — 2026-10-26
- Inspected exact-head CI for `main` at `ac913cc3389a294d0b135a852b035ddddb1018ca`: backend lint, frontend lint, lint-test and Quality Gate passed; E2E was still running during this inspection.
- The core gate completed 240 tests and skipped 5, but BRANCH-003 timed out because the created branch option was outside the visible viewport in the workspace picker. Browser UX independently reported HTTP 403 resource errors on `/crm/patients` and `/crm/treatment-plans`. These must be fixed rather than ignored.
- Candidate change in `fix/workspace-switcher-menu-overflow-20261026` makes the whole picker scrollable and constrains its height to the viewport. Pending PR/CI; this is not yet a verified fix.
- `RB-029` remains OPEN; no production database read/write, medical-history backfill, or deployment was performed.
- Follow-up in PR [#328](https://github.com/drtamirlan911-cell/DentVision1/pull/328): the picker now opens above its trigger when necessary and scrolls the entire menu within the available height. The UX smoke collector was hardened to dispose per-route listeners and report the URL path/status for failing API responses. Exact-head CI remains pending.
- BRANCH-003 follow-up: PR #328 removes the inner workspace-only scroll area so that one outer viewport scrolls both workspace and branch options. Await exact-head CI before marking the UI defect resolved.
- PR #328 CI finding: the branch test helper previously used `clinicMember.findFirst({ userId })`, which could select an arbitrary membership rather than the E2E Clinic A fixture shown in the UI. Candidate correction resolves Clinic A by fixture name, confirms OWNER membership, then uses that clinic's canonical Organization ID for branch list assertions. This removes dependence on DB row order; exact-head rerun remains required.
- PR #328 CI run `40345409642` confirmed the Browser UX 403 path as `GET /api/crm/{clinicId}/treatment-plans` from both Patients and Treatment Plans. Its route has both permission and clinic-scope 403 branches; next diagnostic candidate records only generic JSON `code` / `error` fields to identify the denial without logging arbitrary response or patient data.
- In the same run, branch-management tests queried legacy `clinicId` after creating branches through the canonical Organization flow. Candidate test change now queries the canonical organization scope; rerun needed before treating branch picker as verified.
- Latest PR #328 Core E2E identified two stale `clinic!.clinicId` references inside the branch-management fixture's subscription upsert; the new fixture queries `prisma.clinic` directly, so that property is undefined. Candidate correction consistently uses validated `ownerClinicId`. Await exact-head CI before marking this test block or the picker fix verified.
- Scoped session-hydration candidate in PR #328: `/api/auth/me` previously returned the first clinic membership even when the JWT was scoped to another clinic. On page reload, frontend clinic ID could then disagree with token scope and trigger valid `CLINIC_MISMATCH` 403 responses. The candidate now returns only the membership matching authenticated `user.clinicId`, and returns null rather than another membership when the active token is not clinic-scoped. Exact-head CI/E2E remains pending.
- UX diagnostics are non-blocking: API error status/path is recorded immediately; generic `code`/`error` fields are appended asynchronously with bounded lengths. The release gate no longer waits on arbitrary error-response bodies to finish.
- CI wrapper review in PR #328 found that `quality-scripts/run-e2e-gate.sh` executed each release-gate command once into its durable log and then launched the same command a second time to produce filtered output. This duplicated browser work/side effects and overwrote the first exit status. Corrected the wrapper to summarize the existing log file instead; exact-head CI must verify the single-execution runner and all remaining gates.
## 2026-10-26 — RB-029 Patient Portal history writer follow-up
- Audited current main `ac913cc3389a294d0b135a852b035ddddb1018ca` against the historical inventory in `docs/security/RB-029_MEDICAL_HISTORY_ENCRYPTION_INVENTORY.md`.
- Found the patient portal profile writer still used `encryptField(String(body.medicalHistory))`; object payloads would become `"[object Object]"` before encryption. Candidate branch `security/rb029-patient-portal-history-envelope-20261026` now uses the shared `encryptMedicalHistory` codec and rejects caller-supplied legacy ciphertext / reserved envelope payloads.
- Added `dentvision-backend/src/modules/patient-portal/patientPortal.history.contract.test.ts` to pin the route-to-codec contract. Shared codec round-trip tests already exist in `dentvision-backend/src/lib/phi.test.ts`.
- This is a narrow consumer-path fix; RB-029 remains OPEN pending exact-head CI, full reader/writer/concurrency audit, backup/rollback review, a read-only staging dry run and explicit reconciliation. No database was queried or modified; no backfill or deployment was performed.
## 2026-10-26 — Full E2E evidence and branch-scope fixture correction
- PR #329 exact-head CI run `40363016216` passed frontend lint, backend lint and `lint-test` (18 steps); the core E2E suite reported 237 passed, 5 skipped and 4 failed. All four failures were branch-management scenarios, and the shared helper failed after successful HTTP 201 creation/UI rendering because it listed the new organization-level branch through the legacy `?clinicId=` API scope.
- Corrected `e2e/tests/branch-management.spec.ts` on this candidate using the organization-scoped setup and `/api/branches?organizationId=...` read already introduced on PR #328. This keeps assertions strict and verifies canonical persistence rather than treating an organization branch with nullable `clinic_id` as absent.
- Exact-head CI must rerun; do not infer the later mobile/role gates passed based on the previous run. The E2E continuation on the superseded SHA was still running Browser UX when inspected.
- RB-029 remains OPEN. No database query/write, backfill or deployment was performed.
## 2026-10-26 — RB-029 API envelope-input guard
- Further source review of the structured medical-history codec found that idempotent internal envelope handling must be paired with strict HTTP input guards. The canonical Patient create/upsert and PATCH routes could otherwise accept a client-supplied root `__dentvisionEncryptedV1` value and pass it through as if it were service-produced ciphertext.
- Code candidate committed as `2368ff723efd5ea02349fd39dfec47c6ff87360e` on the existing RB-029 branch. It adds `isClientSuppliedEncryptedMedicalHistory` and applies it at Patient Portal profile update and canonical Patient create/update boundaries. Root `ENC:` values and reserved envelope markers are rejected; normal structured values and nested clinical fields remain supported.
- Regression coverage added for the shared validator and all three route write boundaries. Await exact-head CI; RB-029 stays OPEN. No database access, backfill, staging write, or deployment performed.
## 2026-10-26 — RB-029 malformed envelope fail-closed hardening
- Source audit found that `decryptMedicalHistory()` recognized a V1 envelope only when `__dentvisionEncryptedV1` already contained an `ENC:`-prefixed string. A malformed value under this reserved root key could otherwise be returned as if it were legacy plaintext JSON.
- Added explicit reserved-marker detection. Valid internal V1 envelopes remain idempotent; malformed reserved markers now throw a bounded, non-PHI error on both encode and decode. Added regression coverage for malformed string and numeric marker values.
- Exact-head CI is required before this candidate is considered verified. No database was queried or modified, and no backfill, migration, staging operation or deployment was performed.
## 2026-10-26 — CI correction: type-safe PatientCreated payload and no-key envelope guard
- CI run `40381667033` for head `d6838bb87b1e4f8fa1b79d3e1639d9e3b3202a12` failed backend TypeScript at `aiEventBridge.ts(36,56)`: the payload interface lacked the index signature required by the durable event bus. The same head passed frontend lint, unit tests and Quality Gate.
- The candidate now makes `PatientCreatedPayload` compatible with `Record<string, unknown>`, and `decryptPatientFields()` passes reserved markers through the shared fail-closed codec when the key is unavailable. A regression test covers malformed reserved markers in that no-key path. Fresh exact-head CI is required before verification.
## 2026-10-26 — Reduce PHI in durable PatientCreated AI events
- The legacy patient-created event no longer includes the complaint narrative. The durable AI event and queued AI Employee tasks now receive only `patientId` and `hasComplaints`; the action handler re-reads the patient using both patient ID and clinic ID, then decrypts history in memory.
- AI action/notification text no longer echoes patient names or complaint text. Focused tests cover the non-PHI event rule contract, clinic-scoped lookup, and absence of raw complaint text in action results.
- This is a scoped derivative-PHI improvement, not RB-029 closure. Other event payloads with clinical fields, notification/AI transcript retention and all-consumer/concurrency review remain open. Exact-head CI is pending; no database operation or backfill was run.

## Role/E2E triage — 2026-10-30
- Exact failing baseline inspected: CI [41041393534](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41041393534) on `dec269318de4b7fd090d898315f7b58aaac63988`. Core E2E 243 passed / 5 skipped; Browser UX 4/4, mobile design 16/16, business owner 11/11, organization lifecycle 7/7 and CLI smoke passed. Role/context: 103 passed, 37 failed, 28 skipped. Visual Agent: 45 passed, 3 failed.
- Artifact review found repeated 403s from clinic LAB's page because `useDataQuery` launched patient, visit, file, inventory, promotions, booking and waiting-list queries without checking effective permissions; the legacy lab API router also incorrectly required `patient.read` / `appointment.read` for lab-order reads. Fixes are now on this existing PR branch: query enablement follows effective permission keys; lab-order read/status endpoints use `lab.read` / `lab.write`; the LAB screen exposes only actions allowed by its permission set and updates status through the dedicated status endpoint.
- The role gate found an unlabeled file input on `/diagnostics/referrals/new`; `FileUploader` now gives it a stable name and accessible label. The test route `/school/course/e2e` requested a nonexistent course; E2E seeding now creates a deterministic general-audience course with ID `e2e`.
- The prior run also recorded isolated `401 GET /api/auth/me` errors for some sessions. These are not yet explained or marked fixed; inspect the next exact-head artifacts. Do not weaken the gate or suppress 4xx diagnostics.
- Code commits in this follow-up: `3fc41805a03c2d0e3a8f21babfa8c904cb2e1f5e` (accessible file input), `7357b67d8eac427c9b4e16ca4d153aec7a6bc3d3` and `99a70f12e2b94a6c1bb4c8060e3c39b554dbb55a` (permission-gated queries), `0a2c819cd3b13f2e38017fbe5a0e948754b6d277` (lab API RBAC), `035fe8305385822fe907ff01ab0cdb61989ba1df` / `53c3ebfabe6c49ed16420056104eaff1204c18e3` (lab UI/status API), and `55e581e1fbecb2840a084f951a89bb636303f46b` (general Academy fixture). The final current code head before this documentation-only commit is `99a70f12e2b94a6c1bb4c8060e3c39b554dbb55a`.
- Next action: verify the live PR head, run fresh exact-head CI, inspect remaining 401/403/404 artifacts, and fix only confirmed causes. No test has yet verified these new changes. `main` remains unchanged; no staging/production migration, PHI backfill or deployment was performed.


## 2026-10-30 — Zod compatibility investigation handoff

- User requested that progress/findings be committed to the repository rather than left only in chat. This checkpoint is recorded on the existing PR #330 branch; no new branch or PR is created.
- Source inspected at the active branch ref: `dentvision-backend/package.json` declares `zod: ^3.24.2` and backend TypeScript `^5.7.3`. This is evidence of the currently declared dependency range only; it does not establish the installed lockfile version or compatibility with Zod 4.
- Root `package.json` does not declare Zod as a direct dependency. Do not upgrade the backend to Zod 4 based only on the manifest. First inspect lockfile resolution, all backend Zod APIs/refinements/transforms, schema inference/type usage, and the exact CI failure that motivated the compatibility check.
- No Zod upgrade, lockfile edit, application-code change, test run, or CI rerun is claimed in this checkpoint. Preserve the existing Zod 3 contract until a compatibility audit supports a minimal patch.
- Release state remains NOT READY. PR #330 remains the only active integration target; `main` must remain unchanged. Do not merge, deploy, run staging/production migrations, or perform PHI backfill without the documented gates and approvals.


### Zod lockfile resolution — 2026-10-30
- Follow-up inspection of `dentvision-backend/package-lock.json` (lockfileVersion 3) confirms `node_modules/zod` resolves to `3.25.76`, within the declared `^3.24.2` range. This is the repository's committed lockfile resolution at the active branch ref.
- GitHub code search returned no indexed source matches for the attempted Zod queries; this is a search-index limitation, not evidence that the backend has no Zod consumers. Continue the API-usage audit using the repository tree/source files before changing dependencies.


## 2026-10-30 — Latest role/Academy/Safari evidence handoff
- Historical run 41041393534 artifacts were inspected. Laboratory had repeated 403 responses on patient, lab-order, medical-visit, file and CRM read endpoints; Academy/School course route returned 404 for /api/school/courses/e2e; WebKit role journeys had access-control page errors on guest-session, IAM-context, AI-proactive and diagnostics-referral requests. Historical role gate: 103 pass / 37 fail / 28 skipped; Visual Agent: 45 pass / 3 fail.
- User-reported Academy/School Course interactive control measures about 92×16 px. Historical text artifacts do not verify that exact element/geometry; locate it in fresh screenshot and DOM geometry before editing. Do not reduce the 36px target rule.
- Current PR #330 head at inspection: fd0b34730c0f65877b18908353a3afdede94c22f. Quality Gate 41099779415 passed; CI 41099779548 and RB-034 diagnostic 41099779647 were still running. E2E had not started, so current-head role/Safari results remain unknown.
- Next: inspect fresh exact-head artifacts, validate Academy fixture, capture Safari request + OPTIONS/preflight + CORS response headers, and resolve least-privilege causes for any 403s. Keep RB-003/RB-025/RB-031 open. No main merge, deployment, or database operation.

## 2026-10-31 — D1 expiry lifecycle consistency follow-up
- On PR #330 / `fix/d1-d10-trial-archive-signing-api-20261029`, source review found two remaining admin paths setting `Clinic.active=false` when subscription status was changed to `expired`. Centralized the distinction so expiry leaves `Clinic.active` untouched, while explicit suspension still deactivates it. Added runtime and route regression tests.
- The previous exact-head run [41141555818](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41141555818) had Core E2E, Browser UX and Mobile Design successful; Quality Gate and RB-034 passed. Role/Context was still reported in progress at inspection, with no failure conclusion available. The new commit requires a fresh exact-head rerun.
- No staging/production migration, database write, PHI operation, Render variable change, merge to `main` or production deployment was performed. Release remains NOT READY.


## 2026-10-31 — Exact-head Role/Context failure analysis
- PR #330 candidate HEAD at the time was `d4cc70d0e50a8edb5c48a059a17ea8f5536a8606`. CI [41143882152](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41143882152) passed 2,378/2,378 unit tests, backend/frontend lint, TypeScript, Core E2E, Browser UX, Mobile Design, Visual Agent, business-owner and organization-owner gates; Quality Gate [41143881924](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41143881924) and RB-034 [41143882023](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41143882023) passed.
- Role/Context failed because its request tracker retained many API requests as pending. The checkpoint artifact [13022010150] and nested Playwright network trace [13022011243] show these calls returned HTTP 200 and response bodies, commonly in ~80–170 ms. The correction uses stable method+URL counters (including duplicate request counts) and excludes only long-lived EventSource/SSE from the finite-request drain check.
- This is a test-harness correction only. Authorization/redirect failures separately listed in the role run (including `/support`, `/bi`, `/security`) are not treated as resolved and will be rechecked on the next exact-head run.
- No `main` merge, production deploy, migration, database change, PHI operation or Render environment edit.


## 2026-10-31 — Role/Context and patient-selection follow-up
- Exact-head CI `41169303762` on `d0a5bc6c030fc3adcac4e13ee9cedffb2cc3e9f9` passed Core E2E, Browser UX, Mobile, Visual Agent, Business Owner, Organization Owner, CLI smoke and visual evidence. Quality Gate and RB-034 passed. Role/Context was the only failed stage.
- The existing PR #330 candidate now scopes E2E request draining to the active document and same-origin lazy JS loads, separates old-document navigation aborts from genuine same-document failures, and removes request draining after a forbidden-route redirect.
- PlanAccessBanner dismiss targets now meet the 36×36 minimum. Normal patient-card selection passes the same least-privilege chart/billing access options as the deep-link path.
- No authorization was broadened. The WebKit diagnostics laboratories access-control error, D1/D2 staging verification, RB-029, D5, D9 and D10 remain open. Overall release remains NOT READY.


## 2026-10-31 — PlanAccessBanner unit-test mock correction
- CI `41173435676` confirmed 2,378 tests passed; only the added PlanAccessBanner suite failed during module import because its mock omitted `initReactI18next`. The test now uses a partial `react-i18next` mock preserving real exports and overriding only `useTranslation`. The next exact-head run must confirm the suite.
