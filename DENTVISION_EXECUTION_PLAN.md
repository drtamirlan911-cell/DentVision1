## Current implementation checkpoint — 2026-11-13 (RB-029 independent AI history hydrator race)

- Continued on the existing PR #346 branch security/rb029-fewshot-workspace-isolation-20261113, based on published head cd5966fbbb8823cefdf5645c6ad01d681c58848b. Main remains unchanged; no new PR or replacement branch.
- Addressed the latest Codex P2: AIConversationSync independently hydrates /api/ai/history, so it could previously write an old transcript after a new chat was created even though loadConversation() had a generation guard. Both hydration paths now share the same conversation generation. AIConversationSync checks the generation before committing the history response and cancels its work on workspace switch/unmount.
- Added an integration-style component regression test that holds /api/ai/history pending, starts a new persisted conversation, then resolves the old history response and asserts the new session remains empty.
- Local verification on this exact candidate worktree: full unit suite 2,613/2,613 across 295 files; AIConversationSync component regression 1/1; AI thread lifecycle tests 6/6; frontend TypeScript; frontend production build; backend TypeScript build; frontend lint (13 warnings / 0 errors); Release Gate 6/6; git diff --check all passed. Frontend Vite reports existing large-chunk and mixed Welcome import warnings only.
- Pending after publication: exact-new-head GitHub CI/E2E (including browser, mobile, role, visual and owner gates), Quality Gate and Codex re-review. Do not merge until all exact-head gates pass and no P0/P1/P2 findings remain.
- RB-029 remains OPEN/P0 for historical PHI inventory/backfill, external contact identifier protection, key versioning/rotation, retention/export/backup, restore/rollback, exception ledger and approved staging reconciliation. D1/D2, RB-031, RB-033, RB-035, official Kaspi, Android runtime and D10 remain open/partial. Release NOT READY.
- No staging/production DB was queried or changed; no migration, PHI backfill, key/secret change, provider operation or production deployment performed.

## Current implementation checkpoint — 2026-11-13 (RB-029 Codex review findings addressed in candidate)

- Continue on the existing PR #346 / security/rb029-fewshot-workspace-isolation-20261113; no replacement branch or PR. Base main is 93472635f1788f27f4bb6666909ea0a82b339471; candidate changes are based on PR head e814fbba6a17539d2d0c2cbbf09b50ffa4670367. Main remains unchanged.
- Addressed the new Codex P1: a verified active partner organization now blocks the legacy JWT clinicId fallback in authentication. A retained clinic claim cannot overwrite a verified diagnostic/laboratory/supplier organization context.
- Addressed the new Codex P2: buildDigitalTwin() no longer resolves an arbitrary clinic membership when no active clinic ID is supplied. Clinic-derived name/KPIs are produced only after explicit active clinic scope and successful resolveClinicAccess; digital-twin routes pass the active scope only.
- Added regression coverage for verified organization vs. stale clinic claim, missing/explicit clinic twin behavior, and updated the AI context contract test. Existing few-shot, memory, thread lifecycle and branch-scope tests remain included.
- Local exact-worktree verification: full unit suite 2,612/2,612 passed across 294 files; focused AI/auth suite 35/35 passed; root TypeScript typecheck passed; backend TypeScript build passed; root lint passed (13 warnings, 0 errors); targeted backend ESLint passed; git diff --check passed.
- Pending after push: exact-new-HEAD GitHub CI (including full E2E/Browser UX/Mobile/Role/Visual/Owner gates), Quality Gate, and Codex review. Do not merge until all exact-head gates pass and no unresolved security findings remain.
- RB-029 remains OPEN/P0 for historical PHI inventory/backfill, external contact identifier protection, key versioning/rotation, retention/export/backup, restore/rollback, exception ledger and approved staging reconciliation. D1/D2, RB-031, RB-033, RB-035, official Kaspi, Android runtime and D10 remain open/partial. Release NOT READY.
- No staging/production DB was queried or changed; no migration, PHI backfill, key/secret change, provider operation or production deployment performed.

## Current implementation checkpoint — 2026-11-13 (RB-029 active workspace scope; candidate pending)

- Continue only on existing PR #346 / `security/rb029-fewshot-workspace-isolation-20261113`; active-clinic scope fix is a child of `b8d5a56013d2310352142d4c42e0ec4545781151`. Main remains unchanged.
- Source review confirmed that a partner token may retain a legacy clinicId. Raw claim reads in AI learning, few-shot, deterministic fallback, digital twin, proactive routes, insights, audit metadata and branch resolution could therefore reattach clinic state.
- Candidate uses `activeAiClinicId()` consistently, returns null for guest/partner contexts, removes authenticated fallback to the demo clinic, and only exposes branch context matched to the active organization/clinic. Regression tests cover stale clinic and branch claims.
- **Next:** push with expected-HEAD lease; rerun exact-head CI, Quality Gate and all E2E role/visual/owner gates. Review Codex findings. Do not merge until every gate passes.
- RB-029 remains OPEN/P0 for historical PHI inventory/backfill, key versioning/rotation, retention/export/backup and approved staging evidence. D1/D2, RB-031, RB-033, RB-035, official Kaspi, Android runtime and D10 remain open. Release NOT READY.
- No staging/production data operation, migration, PHI backfill, key change, provider operation, secret change or production deployment performed.

## Current implementation checkpoint — 2026-11-10 (RB-030 merged)

- RB-030 offline appointment edit/reconnect/sync is implemented and merged through existing PR #345. Merge commit on `main`: `4c779b371c1c6a049630913a214ee27f3f8bd41b`; verified PR head: `3577a57d46d58c0fbfbbd26a6bf8696c85cb0a8b`.
- Exact-head evidence on PR #345: CI [42511766232](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/42511766232), Quality Gate [42511766117](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/42511766117), Vercel Preview SUCCESS. 2,561 unit tests / 288 files passed. E2E gates passed: Core 251, Browser UX 4, Mobile Design 16, Role Design 140, Visual Agent 48, Business Owner 11, Organization Owner 8, Playwright CLI smoke and Visual Release Gate.
- The sanitizer's timestamp-ID false positive is fixed with explicit opaque-reference-field handling and regression coverage; generic phone/IIN text and clinical/PHI fields remain redacted. Queue replay remains scoped to the complete active IAM context and fails closed on mismatch.
- Offline boundary: edits to clinical notes, diagnosis, tooth number, free-text reason and service changes on an existing appointment require a network connection. Do not expand the offline claim beyond the verified safe fields.
- PR #344 was closed as superseded, with its branch retained. Do not create a replacement branch or PR for RB-030.
- **Next sequence:** (1) continue RB-029 historical PHI reader/writer inventory, key lifecycle, backup/restore and approved staging plan; (2) complete RB-035 patient-route/role/tenant/branch/revoked-session negative matrix; (3) prepare D1/D2 staging migration/retention validation only after staging target, backup/rollback and operator approval are verified; (4) gather RB-031 WebKit OPTIONS/CORS/WebSocket evidence; (5) obtain repository-admin proof for RB-033 branch protection; (6) verify official Kaspi merchant contract/callback, Android runtime and remaining D10 independent lab lifecycle.
- Release remains NOT READY. No staging/production DB operation, migration, PHI backfill, provider operation, environment/secret change or production deployment was performed.

## Current implementation checkpoint — 2026-11-06 (recipient test fixture correction)

- Existing PR #330 only; baseline HEAD `1da8313edb413a44a4cfae79799108e0a76cec2c`; branch `fix/d1-d10-trial-archive-signing-api-20261029`; base main `ac913cc3389a294d0b135a852b035ddddb1018ca`; 349 ahead / 0 behind.
- Candidate `1da8313e` source change implements the doctor recipient boundary. CI confirmed frontend/backend lint and TypeScript/build/Prisma/Command Center/System Map success; Quality Gate and RB-034 passed. Unit suite had 2,494 passes and one new test failure.
- The one failure was caused by a mock returning doctor-a and doctor-b even though the code's Prisma where-clause requested only doctor-b. Corrected the mock in the targeted test to return only doctor-b. No application behavior or security assertion was relaxed.
- Exact-head CI/E2E for the child commit is required. RB-035 remains OPEN until exact-head checks and the complete negative access matrix pass. Keep PR Draft; no merge/deployment.

## Current implementation checkpoint — 2026-11-06 (RB-035 clinical AI recipient authorization)

- Existing PR #330 only; branch `fix/d1-d10-trial-archive-signing-api-20261029`; starting HEAD `90635b7beef04102bed3a13d28868ae206d16cfb`; main `ac913cc3389a294d0b135a852b035ddddb1018ca`; 348 ahead / 0 behind.
- Exact-head CI `42162267260`, Quality Gate `42162267180`, RB-034 `42162267129` and Vercel passed. All four CI jobs passed, including full E2E/role/visual/owner/Playwright gates. EventStore mock correction is verified at that HEAD.
- RB-035 remains OPEN. Candidate correction: doctor-agent notifications require a non-deleted clinic patient, active `treating_doctor` assignment, current organization-scoped DOCTOR role and existing branch-scope helper approval. ASSISTANT removed; explicit empty lists deny all; explicit IDs are intersected with verified assignments; conflicting/missing patient context denies delivery.
- Added recipient-security regression cases for assigned, unassigned, wrong-branch, explicit-empty, mismatched explicit recipient, missing/cross-clinic, conflicting patient ID and missing patient context. Verify on candidate exact HEAD before marking fixed.
- Continue RB-029 historical PHI/key/backup evidence, D1/D2 approved staging plan, RB-030/031/033, Kaspi and D10. Keep PR Draft; no main merge or deployment. Local tests/status unavailable because no checkout is mounted.

## Latest implementation checkpoint — 2026-11-06 (EventStore test correction; RB-035 recipient-scope finding)

- Existing PR #330 only; branch `fix/d1-d10-trial-archive-signing-api-20261029`; starting HEAD `e8877e81b105daedccba00a305f6b13d715c9b35`; base/main `ac913cc3389a294d0b135a852b035ddddb1018ca`; 347 commits ahead / 0 behind, 193 changed files. No branch/PR creation and no merge.
- Exact-head CI `41975258101`: lint, TypeScript/build, generated System Map and complete E2E gates passed; unit-test job failed only because `EventStore.encryption.test.ts` could not initialize its mock (`update is not defined`). 2,482 tests passed; 278 files passed and one suite failed before running.
- Quality Gate `41975258095` and RB-034 `41975258087` passed; Vercel Preview status was SUCCESS. Overall CI remains FAILED until the exact-head rerun passes.
- Correction: add the already-created `update` mock to the test file's `vi.hoisted` destructuring. No tests/assertions are removed. The EventStore encryption tests have not yet been verified.
- RB-029 remains OPEN/P0. New EventStore result/error writes are encrypted and list/detail readers decode them, but exact-head unit evidence, historical plaintext inventory/backfill, AI memory/learning, notification/export, key rotation and backup/restore remain outstanding.
- RB-035 recipient-scope finding: clinical doctor-agent results are currently routed to organization DOCTOR and ASSISTANT roles, with no PatientAssignment filter; explicit empty notifyUserIds falls through to role resolution. SSE delivery is target-filtered, but the resolved target set is overbroad. Fix and negative tests are next.
- RB-033: GitHub branch metadata reports `protected=false` / `protection.enabled=false` for main; repository-admin must establish required protection. Release remains NOT READY.

## Next execution order

1. Push the test mock correction plus checkpoint docs to PR #330 with expected-HEAD lease; run exact-head CI/Quality/RB-034.
2. Implement and test the RB-035 AI notification recipient restriction; wait for exact-head CI completion before another push.
3. Continue RB-029 PHI inventory and key/backup/backfill plan; keep historical data read-only.
4. Prepare D1/D2 staging proof only after verified target, backup/rollback and operator window. Then RB-030, RB-031, RB-033, Kaspi and remaining D10.
5. Keep PR #330 Draft; do not merge main or deploy.

---

## Latest implementation checkpoint — 2026-11-05 (RB-029 EventStore derivative encryption; RB-035 parent-head verification)

- Existing PR #330 only; parent HEAD `3a7e299d3eb126010f01ae75980a7b529b51bae6`, base/main `ac913cc3389a294d0b135a852b035ddddb1018ca`, 345 commits ahead / 0 behind. The personal AI Activity/Approval tenant-scope fix `8ada4be8efb6ed09dba630ca344ef5f7049b5d09` is included and verified by exact-parent CI.
- Parent exact-head CI `41969627116` passed all four jobs; 2,484/2,484 tests across 279 files. Core, Browser UX, Mobile Design, Role/Context, Visual Agent, Business Owner, Organization Owner, Playwright CLI and Visual Release gates passed. Quality Gate `41969627078`, RB-034 `41969627059` and Vercel Preview passed.
- Source review found that EventStore persisted `AIEvent.result` JSON and raw `AIEvent.error` without the durable-event at-rest boundary. Code commit `3aa6d0f7af24fbbbb5ed49bc7fac0c75fa2f8bfe` encrypts new result/error writes, decodes them in list/detail readers, preserves legacy plaintext compatibility and adds regression coverage. Exact-head CI for this code commit is PENDING; parent CI is not evidence for it.
- Next order: (1) verify the new exact-head CI/Quality/RB-034 and focused EventStore tests; (2) continue RB-029 memory/learning, realtime/notification/export, legacy plaintext, key rotation and backup/restore inventory; (3) complete RB-035 negative authorization matrix; (4) prepare but do not execute D1/D2 staging validation without approved target/backup/rollback/operator window; (5) RB-030, RB-031, RB-033, Kaspi and D10 parity.
- Release remains NOT READY. No merge, staging/production DB operation, PHI backfill, provider call, environment change or deployment.

# DentVision — Master Execution Plan

## Previous implementation checkpoint — 2026-11-05 (RB-035 tenant-scoped AI visibility; superseded by the latest checkpoint below)

- Existing PR #330 only; starting HEAD `0299ab57243092479716d87af6b2e8878612e23a`, base/main `ac913cc3389a294d0b135a852b035ddddb1018ca`. The branch is 342 commits ahead / 0 behind at the start of this checkpoint. No new branch/PR and no merge.
- Candidate commit `8ada4be8efb6ed09dba630ca344ef5f7049b5d09` narrows the personal-row branch in `buildActivityFilter` and `buildApprovalFilter` to the verified active clinic/organization. Without a verified tenant, only unscoped personal rows can match and `canReadPhi` is false; SUPERADMIN platform access is unchanged. This prevents an own-actor/requester row from another clinic bypassing the active-context PHI permission.
- Added regression coverage for own-row scoping and unverified clinic context. Hardened AI approval decision-note encryption/decryption to fail closed. Files: `activityQuery.ts`, `activityQuery.test.ts`, `approvalPrivacy.ts`.
- Parent HEAD `0299ab...` passed CI 41840005056 (all four jobs), Quality Gate 41840005038, RB-034 41840005059 and Vercel preview. Unit suite 2,483/2,483 across 279 files; E2E gates passed with one recovered flaky patient-portal conversation request. These are parent-head results only; the new code commit still needs exact-head verification.
- Next order: (1) verify exact-head CI and the targeted filter tests; (2) continue RB-029 EventStore result/error, AI memory, realtime/notification/export, key rotation, backup/restore and legacy backfill inventory; (3) complete RB-035 negative matrix; (4) prepare, but do not run, D1/D2 staging validation until target/backup/rollback/operator approval exists; (5) RB-030, RB-031, RB-033, Kaspi and D10 workflow parity.
- Release remains NOT READY. Do not merge main or touch staging/production.


## Latest exact-head verification checkpoint — 2026-11-03

- Verified code/test HEAD `de0dffcadf0dca77beaf61cb647729ad849d35b8` on the existing PR #330 branch; base/main remains `ac913cc3389a294d0b135a852b035ddddb1018ca`. PR #330 remains OPEN / DRAFT, 333 commits ahead / 0 behind.
- Exact-head CI `41387485129`, Quality Gate `41387485180`, RB-034 `41387485168` and Vercel preview status all passed. CI jobs frontend-lint, backend-lint, lint-test and E2E passed. Unit suite: 2,437/2,437 across 270 files; E2E: Core 249/5 skipped, Browser UX 4, Mobile 16, Role/Context 140/28 skipped, Visual Agent 48, Business Owner 11, Organization Owner 8, Playwright CLI smoke and Visual Release Gate passed. E2E compact digest found zero failure signatures.
- PARTNER-003's database-level negative assertion passed: after delivery, the order has no DENTAL_LAB `partner_economics` transaction or ledger entries. RB-036 is resolved as the premature delivery-recognition defect. Do not enable recognition until a separately approved dental-lab invoice/payment/settlement/payout/refund/chargeback contract and verified callback exist. D10 remains OPEN/PARTIAL.
- D1/D2 remain OPEN pending approved staging migrations and positive-read/negative-write/archive-retention proof. RB-029, RB-030, RB-031, RB-033 and RB-035 remain open for their respective PHI/backfill, offline sync, WebKit/production CORS, repository protection and full authorization evidence.
- Master Spec 5.0 classification remains 18 PARTIAL / 4 OPEN / 2 GUIDANCE. No production readiness claim.
- This checkpoint's documentation-only commit must itself receive a fresh exact-head CI run; the successful run above belongs to code/test HEAD `de0dffcadf0dca77beaf61cb647729ad849d35b8`. No live DB/provider/environment action or main merge.

## Next execution order after documentation checkpoint

1. Continue RB-029 reader/writer/concurrent-writer inventory and exception-ledger design; keep all PHI operations read-only until approved backup/restore and staging dry run.
2. Complete RB-035 route-level negative authorization matrix by role, tenant, branch, revoked/expired session and patient financial-field visibility.
3. Prepare D1/D2 staging verification plan for all four pending migrations; do not apply without verified staging target, backup and explicit operator window.
4. Resolve RB-030 offline sync contract and add a real offline→reconnect persistence assertion.
5. Capture exact WebKit OPTIONS/request lifecycle and production CORS/WebSocket evidence for RB-031.
6. Obtain repository-admin confirmation for RB-033 and official merchant-issued Kaspi contract/callback evidence.
7. Continue D10 dental-lab QC/remake, dispatch, service/pricing, commercial settlement and complete partner RBAC; retain the 18/4/2 Master Spec audit classification until each section has evidence.


## Latest implementation checkpoint — 2026-11-01 (RB-029 / RB-035 / role-gate corrections)

- This checkpoint is based on live PR #330 branch \`fix/d1-d10-trial-archive-signing-api-20261029\`, HEAD \`45900d0d33b507bb0bb492d2d23b0243a615ec25\`. Base/main remains \`ac913cc3389a294d0b135a852b035ddddb1018ca\`; no merge.
- Corrected two stale RB-035 source-contract matchers exposed by CI \`41312419249\`; runtime permissions and balance serialization remain unchanged and fail-closed.
- Added shared object-root validation to PHI helpers and reject scalar/array medical-history writes in Patient Portal PUT, Patient POST and Patient PATCH. Existing scalar \`ENC:\` is legacy read compatibility only. Added unit and route-contract tests.
- Corrected one Safari Role/Context collector race based on the Playwright trace: only explicit request-cancellation signatures are deferred briefly; expected navigation cancellation requires an actual main-document epoch advance. Otherwise the request remains a hard failure.
- Exact parent CI \`41312419249\` results are not carried forward as proof: 2,432/2,434 unit tests passed; Core E2E/Browser UX/Mobile/Visual Agent/Business Owner/Organization Owner/CLI/visual-evidence and Quality/RB-034 passed; Role/Context had one PATIENT Safari cancellation race. The two unit matcher failures and Safari race have source/test fixes, but need exact final-head verification.
- CI \`41333100207\` started on code/test HEAD \`5bfd700\`; frontend/backend lint, Quality Gate \`41333100271\` and RB-034 \`41333100268\` passed. E2E was cancelled by subsequent documentation pushes and is not counted as a pass.
- Next: run and inspect a complete non-cancelled CI/Quality/RB-034 on the exact final documentation HEAD. Then continue D1/D2/D8 staging proof, RB-029 full consumer/backfill/key/backup audit, RB-030 real offline→reconnect E2E, RB-031 WebKit/CORS evidence, RB-033 branch protection, RB-035 full route/role matrix, Kaspi/production verification and remaining D10 Master Spec workflow parity.
- Release remains NOT READY; PR #330 stays OPEN/DRAFT. No staging/production DB query/write, migration, PHI backfill, payment-provider action, environment/secret change, deployment or main merge was performed.

## Latest implementation checkpoint — 2026-11-01 (D10 settlement-boundary correction)

- Continue only on existing PR #330 / `fix/d1-d10-trial-archive-signing-api-20261029`; this update is based on exact live HEAD `b43b3c01b229b21c1fa2cda7d149c55486bb4e42`. Base/main remains `ac913cc3389a294d0b135a852b035ddddb1018ca`.
- Parent-head verification: CI `41280138666`, Quality Gate `41280138667` and RB-034 `41280138692` passed. This evidence is for the parent HEAD only; the settlement-boundary correction below requires a fresh exact-head run.
- Confirmed P1 mismatch: `subscribers.ts` recognized DENTAL_LAB economics on `labOrder.status_changed → delivered`; the clinic route also contained a dead duplicate writer. Both delivery-triggered paths are removed, together with the obsolete delivery-only recognition helper and its unit test.
- PARTNER-003 now asserts that delivery produces no `partner_economics` transaction or attached ledger entries for the order. Delivery remains operational completion; the commercial flow remains invoice → verified payment/settlement → economics recognition.
- Updated the Operating Directive, Master Spec wording, Execution Plan, Settlement Payment Contract and Release Blockers to agree with canonical `docs/business/DENTVISION_PARTNER_ECONOMICS.md`: commission is earned only on successful commercial settlement. D10 remains OPEN until an approved invoice/payment/settlement/payout/refund/chargeback workflow is implemented and tested.
- Historical DENTAL_LAB transactions and wallets are not deleted, reversed, backfilled or altered. They require read-only reconciliation against external payment evidence before any separately approved financial correction.
- Next: inspect exact-head CI/E2E, then continue D1/D2/D8 staging proof, RB-029 PHI reader/backfill evidence, RB-030 offline E2E, RB-031 WebKit/CORS, RB-033 branch protection, RB-035 authorization matrix, Kaspi/production checks and remaining D10 workflow parity. No live DB operation, migration, PHI backfill, environment change, deployment or main merge.

## Latest compliance checkpoint — 2026-10-31## Latest compliance checkpoint — 2026-10-31

- Full 24-section Master Spec 5.0 audit recorded in docs/MASTER_SPEC_COMPLIANCE_AUDIT.md, audited HEAD 1284de604b638937ee2939f3f198f8674a5fa6d4.
- Result: 18 sections PARTIAL, 4 OPEN, 2 GUIDANCE; no section certified fully compliant end-to-end. PR #330 remains OPEN / DRAFT and release NOT READY.
- Confirmed gaps include Shop cancellation (SHOP-013 returns 404), incomplete independent dental-lab owner workflow proof, public organization/professional profile route aliases, open accepted-paid-settled/medical-analysis finance, real 32-tooth WebGL/3D odontogram, PHI transcript/backfill and Android runtime.
- Exact-head CI 41183045451 remains IN PROGRESS at Role/Context; core E2E, Browser UX and Mobile Design passed. Quality Gate 41183045517 and RB-034 diagnostic 41183045421 passed, but do not close remaining release gates.
- Next priority: finish role/visual/owner/Playwright gates, then implement or explicitly defer every confirmed D10 workflow gap and close staging/security/provider evidence. No main merge or live environment operation.



## Purpose
This document is the persistent execution contract for DentVision. It is the source of truth for what is being implemented, in what order, and what is considered complete. Progress must not live only in a chat session.

## Latest implementation checkpoint — 2026-10-31 (concurrent E2E added)
- Existing PR #330 only. Patient concurrency implementation `b77552f8078382beabc376ad2af37ba2cb60abff`, matcher correction `8e7989b5d01eb973220df70b331e5912342f281e`, and E2E coverage commit `dda18b4239bb9a23d18cec872bcb0074079b65ab`.
- New isolated-database E2E cases exercise simultaneous Patient PATCH writes and simultaneous balance deposits. Every accepted PATCH marker must remain in the final chart; deposit total must equal the sum of all increments; fractional amount is rejected.
- Previous exact-head CI `41181068689` reached 2,382 passed / 3 failed due three stale assertions in one source-contract file; matchers corrected. The concurrent E2E cases were then added, so a fresh full CI is mandatory.
- Next: verify all current-head CI jobs; then continue transcript PHI policy, D1/D2/D8 staging, RB-029 complete readers/backfill, RB-030 offline schedule E2E, RB-031 WebKit evidence and D10 workflow matrix. No tests disabled or permissions weakened; no live DB operation or main merge.

## Latest implementation checkpoint — 2026-10-31 (test matcher correction)
- Existing PR #330 only; source commit `b77552f8078382beabc376ad2af37ba2cb60abff`, source-contract test correction `8e7989b5d01eb973220df70b331e5912342f281e`. Main/base remains unchanged.
- Current Patient PATCH now rejects stale snapshots with 409 via `updatedAt` CAS; patient update, teeth mirror and branch reassignment are transactionally coupled. Deposit writes use DB-side integer increment.
- The first run after the source commit found three stale expectations in one static source-contract test (2,382 passed / 3 failed); route assertions have been made whitespace-tolerant and the negative matcher now distinguishes the update operation from the API response.
- Exact-head CI/Quality/RB-034 must pass on the final documentation checkpoint. Preserve all IAM and tenant assertions; do not skip tests. AI transcript PHI, RB-029 broader consumers/staging, RB-030 offline E2E, RB-031 WebKit, RB-033 branch rules and D10 workflow parity remain open.

## Latest implementation checkpoint — 2026-10-31
- Continue only on existing PR #330 / `fix/d1-d10-trial-archive-signing-api-20261029`; source implementation commit `b77552f8078382beabc376ad2af37ba2cb60abff` is based on prior exact branch HEAD `45fe9ba5f573d8311d6b96e4e83f8260bffbf3f9`. Main remains `ac913cc3389a294d0b135a852b035ddddb1018ca`.
- Fixed a confirmed stale-snapshot race in `PATCH /api/patients/:id`: use `updatedAt` compare-and-set and return 409 when another writer changed the row. The same transaction now persists the odontogram mirror and any validated organization-level branch reassignment.
- Fixed concurrent deposit arithmetic with Prisma atomic integer increment; reject unsafe/non-integer amounts.
- Regression source contracts added. No local build/test claim; exact-head CI is required after the branch update.
- Next: run exact-head CI/Quality/RB-034; inspect all stages. Then continue RB-029 reader/writer audit, offline queue end-to-end test, WebKit request evidence and D10 workflow matrix. No production/staging DB changes or merge to main.

## Current checkpoint — 2026-10-30

- Active implementation PR remains #330 on `fix/d1-d10-trial-archive-signing-api-20261029`; the 2026-10-30 role-gate follow-up was based on live pre-change HEAD `77fc9c81fbc276621ad1a4d03a753e4733819722`, on main `ac913cc3389a294d0b135a852b035ddddb1018ca`. The follow-up records the 36px School breadcrumb correction, exact generated System Map values and RB-035 deposit-denial regressions. Always resolve the live PR #330 head before the next change.
- The user explicitly authorized integration of #328 and #329 into the existing #330 working branch. Both were integrated with history-preserving merge commits; their original branches/PRs remain open and unchanged. Temporary integration PRs #331 and #332 were closed as merged into #330, never into main.
- #328 integration merge commit: `091604d78d6457a0ae5e97a83ae96059c0dde945`, with parent history from #330 and #328. #329 integration merge commit: `a3138609fb147cbee0a8cfeab3ffd397ceb6212d`, with parent history from the already-integrated #328/#330 line and #329.
- Conflict resolution preserved the D1–D10 trial/archive guards, active clinic context and archived-membership filtering, clinical-chart/route permissions, workspace picker and role policy, PHI envelope encryption, patient writer ciphertext rejection, and optimistic concurrency. PatientCreated events now carry a boolean complaint-presence hint, not patient names or complaint text.
- Corrected two known #328 CI failures in the integrated branch: `planGate.ts` now passes `res` rather than undefined `_res`; the CRM treatment-plan security contract now asserts the actual clinic- and patient-scoped reference validation.
- Exact-head CI [41034452583](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452583) is pending; Quality Gate [41034452312](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452312) and RB-034 diagnostic [41034452343](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41034452343) are in progress. Do not treat integration as verified until the exact latest HEAD completes all required gates.
- Main remains unchanged. No staging or production migration, PHI backfill, database write, or deployment has been performed.

## Operating rules
1. `main` is the product source of truth unless a dedicated implementation branch is explicitly required.
2. Existing canonical product/economics documents are authoritative; do not create competing rules.
3. Every completed material change must be committed to GitHub and recorded in `DENTVISION_EXECUTION_LOG.md`.
4. Every unfinished item has an explicit status and next action.
5. Prefer implementation over repeated audits. Audit only to unblock, verify, or prevent regressions.
6. Do not duplicate UI, business rules, calculations, permissions, or data models when an existing implementation can be extended.
7. Backend/domain logic is authoritative; frontend must consume the same rules rather than reimplementing economics.
8. Historical financial records must remain reproducible even after rules change.
9. AI may explain, recommend, and detect anomalies, but canonical financial/economic rules require deterministic domain logic and explicit governance.
10. A release is complete only when the relevant implementation, tests, documentation, and verification evidence are present in the repository.
11. Browser automation must use isolated test data and must never perform real production payments, messages, or destructive production actions.
12. UX tests must verify behavior and user comprehension signals, not merely that a route renders.

## Execution phases

### Phase 0 — Technical baseline / control plane
**Status:** COMPLETE

Evidence recorded in `DENTVISION_CONTEXT.md` and `DENTVISION_EXECUTION_LOG.md`; the context file is the current state bootstrap.

- [x] Create this master execution plan.
- [x] Create persistent execution log.
- [x] Confirm the control plane: `DENTVISION_CONTEXT.md` is the current state/authority bootstrap; `ARCHITECTURE.md` is the architecture overview; `.dentvision/current-state.json` is the curated machine-readable summary sourced from context (`generated: false`).
- [x] Record repository-path audit: `CURRENT_STATE.md` is absent at this branch head and is not an active current-state source; do not recreate a competing status document.
- [x] Stabilize CI and record evidence.
- [x] Restore/verify `dentvision-backend/src/modules/patients/patients.routes.ts` against Git history, recording evidence in `DENTVISION_EXECUTION_LOG.md` (no `CURRENT_STATE.md` exists at this branch head).
- [x] Verify backend runtime/infrastructure baseline.
- [x] Record the exact baseline commit and active implementation branch in the execution log.
- [x] Locate and read the canonical `DENTVISION_PARTNER_ECONOMICS.md`; retain it as the sole economics policy source.

### Phase 1 — Economics Engine and Ledger vertical slice
**Status:** IN PROGRESS

- [x] Convert canonical partner economics into deterministic executable rules for diagnostic 3D, medical analysis and dental laboratory partners.
- [x] Calculate operation price, platform commission, partner payout, attributable costs, contribution margin and margin status.
- [x] Version applied economics rules and retain snapshots on economics transactions.
- [x] Make economics calculations idempotent and auditable.
- [x] Add automated tests for floors, caps, dental-lab volume tiers, loss detection and rule snapshots.
- [x] Connect diagnostic settlement calculation to the canonical engine.
- [x] Remove the legacy referral-time economics fallback so settlement cannot use stale `Referral.platformFee` as its authoritative source.
- [x] Add referral lifecycle/concurrency protection for canonical economics reconciliation.
- [x] Connect Partner Economics data to the existing Finance Hub Platform view.
- [x] Complete accepted → paid → settled integration/concurrency tests with immutable rule/version verification at the durable ledger boundary.
- [x] Wire the real medical-analysis paid/settled operational lifecycle using the existing `Referral + Laboratory + LaboratoryTest + Payment` domain; do not create a duplicate order model.
- [x] Complete the ledger/reconciliation surface and connect Finance Hub to the durable economics transactions end-to-end.
- [x] Keep dental-lab economics disabled on delivery; do not recognize commission until an approved commercial payment/settlement path provides verified paid/settled evidence.

### Phase 2 — Partner onboarding, transparency and Finance Hub
**Status:** IN PROGRESS

- [x] Establish E2E coverage entry points for diagnostic-center, medical-laboratory and dental-laboratory owner onboarding.
- [x] Establish E2E coverage entry points for employee management and invitations.
- [x] Complete full owner lifecycle: registration → organization profile → verification/approval state → first login → operational workspace.
- [x] Complete full branch lifecycle: create → edit → switch → assign employees → enforce branch permissions → archive/delete according to the existing domain model.
- [x] Verify the durable Partner Economics dashboard transparency surface shows applicable commission, gross value, deductions/cost, partner net payout, payout status and economics rule/version reference.
- [x] Diagnostic centers see branch economics and platform deductions through durable branch-filtered Partner Economics transparency/dashboard data.
- [x] Analysis laboratories see per-analysis economics through durable Partner Economics transactions and Finance Hub transparency.
- [ ] Dental laboratories see per-order/service economics only through verified settlement-backed Partner Economics snapshots and Finance Hub transparency; the independent invoice/payment/settlement flow is still OPEN.
- [x] Expose platform revenue, partner payout, cost, contribution and margin by partner/type/branch/period through durable transparency/dashboard aggregation.
- [x] Add discrepancy, low-margin and loss alerts from immutable economics rows.
- [x] Preserve historical calculations when economics rules change.

## Canonical Branch Management Contract

Branch management is part of the existing Organization/Workspace model. Do not create a separate branch product or parallel organization model. A branch is an operational scope inside an organization and must use the existing identity, membership, permissions, audit, events and AI context primitives.

### Owner entry point
The organization owner must have one discoverable management path:

`Owner → Settings / Organization → Branches`

The branch list is the canonical place to:
- see all active and archived branches;
- create a branch;
- open a branch workspace;
- edit branch configuration;
- activate/archive a branch;
- manage branch staff and assignments;
- inspect branch operational and financial status;
- enter branch-specific settings.

If the existing navigation has an organization/settings surface, extend it rather than creating a duplicate route or dashboard.

### Branch creation
Creation must be a real persisted workflow, not a modal-only UI.

Required baseline fields:
- name;
- unique organization-scoped code;
- city;
- address;
- phone;
- active state;
- default-branch semantics where applicable.

Optional settings may contain branding, working hours, holidays, communication and operational configuration, but these must remain compatible with the existing `Branch.settings` domain field rather than creating a duplicate settings model.

Creation requirements:
- authorize against the actor's organization scope;
- allow only roles with branch-management permission;
- validate organization-scoped code uniqueness;
- create audit/event records;
- return the persisted branch and make it immediately discoverable after refresh;
- never create a branch outside the current organization/tenant.

### Branch workspace
Opening a branch must provide an operational workspace with the current branch context visible and switchable only within the actor's authorized organization/branch scope.

The branch workspace should expose, according to role and existing domain support:
- Overview / Today;
- Schedule;
- Patients;
- Cases / Clinical;
- Diagnostics;
- Laboratory;
- Team;
- Services & Prices;
- Rooms / Chairs / Equipment;
- Inventory / Warehouse;
- Finance / Cash / Payments;
- Documents / Templates;
- Notifications / Communication;
- Analytics;
- Settings.

Do not expose a screen merely because the label exists. Each item must resolve to an implemented workflow or be explicitly unavailable with a reason.

### Branch settings contract
Branch settings should be organized into practical domains:

1. **General** — name, code, contacts, address, status, default state.
2. **Working time** — schedule, holidays, exceptions and appointment availability.
3. **Team** — invite/add staff, role assignment, branch assignment, enable/disable access.
4. **Rooms & equipment** — rooms, dental chairs and operational resources where supported.
5. **Services & prices** — branch availability and branch-specific price overrides where the domain model supports them.
6. **Inventory** — stock scope, responsible users, low-stock rules and future inter-branch transfer workflows.
7. **Finance** — branch revenue/expense visibility, cash/payment configuration and finance permissions.
8. **CRM & communication** — reminders, confirmations, waitlist, patient communication settings.
9. **Diagnostics & laboratory** — referral routing, deadlines, result visibility and operational contacts.
10. **Documents** — templates, consent/document configuration and responsible roles.
11. **AI & notifications** — branch-scoped AI context, alerts, approvals and notification rules.
12. **Security & audit** — access history, privileged changes and branch-level audit visibility according to role.

Only settings supported by the current domain should be implemented immediately; unsupported areas remain explicit backlog items rather than fake controls.

### Staff and branch scope
The branch lifecycle must support:

`Invite/Add → Assign → Change assignment → Disable/Revoke → Audit`

Branch assignment must use the existing `ClinicMember.branchId`/membership model where applicable. A user may have access to one or more branches only when the permission model allows it. The backend remains authoritative for scope enforcement.

### Data isolation
Branch-aware resources must respect branch scope wherever the existing domain model provides it, including at minimum:
- patients;
- appointments;
- inventory items;
- invoices;
- expenses;
- referrals/diagnostics.

Organization owners may aggregate across authorized branches. Branch-scoped users must not read or mutate another branch's data merely by changing a URL, ID or request payload.

### Archive / deactivate semantics
Branches must not be hard-deleted when doing so would destroy operational or audit history. Prefer inactive/archive semantics already represented by the domain model.

Before deactivation, the workflow must account for:
- active staff assignments;
- future appointments;
- unresolved cases;
- open lab/diagnostic orders;
- inventory/financial records;
- default-branch constraints.

Historical records remain readable according to permission policy. The only active/default branch must not be silently disabled.

### Branch-aware AI
AI context must include the active organization and branch scope. Example supported intents:
- “Покажи показатели филиала за месяц.”
- “Какие записи и лабораторные заказы требуют внимания в этом филиале?”
- “Кто из сотрудников закреплён за филиалом?”
- “Подготовь список низких остатков по филиалу.”

AI must never use branch context to bypass authorization. Any mutation follows `Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit`.

### Required release tests
The branch vertical slice is not complete until an isolated E2E workflow proves:
1. Owner opens the canonical organization/settings branch-management entry point.
2. Owner creates a branch.
3. Branch persists and survives refresh/re-login.
4. Owner edits branch configuration.
5. Owner opens/switches to the branch workspace.
6. Owner assigns an employee to the branch.
7. Assigned employee sees only permitted branch data.
8. Cross-branch read/write attempts are denied.
9. Owner can view organization-wide aggregates across branches.
10. Owner can archive/deactivate a branch under the domain constraints.
11. Historical branch-linked records remain intact and auditable.
12. Visible branch actions are real and produce expected success/error states.

### Implementation order
1. Verify existing branch model and existing branch routes/services before adding code.
2. Wire any missing backend route mounting into the existing application router.
3. Reuse existing organization/settings/team screens for discoverability.
4. Complete branch CRUD + assignment + authorization.
5. Complete branch workspace/switching.
6. Add settings domains only where backed by real data models.
7. Add E2E and negative cross-branch tests.
8. Verify CI/release gates.
9. Record evidence in `DENTVISION_EXECUTION_LOG.md` and update status here.

### Phase 3 — Automated operations
**Status:** QUEUED
- [x] Trigger economics only at supported settlement boundaries: medical-analysis payment settlement and diagnostic paid settlement. Dental-lab delivery is not settlement; DENTAL_LAB recognition stays disabled until an approved invoice/payment/settlement path exists.
- [x] Automate payout readiness and notifications.
- [x] Implement full and partial payment refunds where a durable Finance Core ledger transaction exists; unsupported payment domains fail closed rather than mutating money without a reversal.
- [x] Handle supported cancellation/refund boundaries with full/partial Finance Core reversals; unsupported domains fail closed rather than mutating financial state without a durable reversal.
- [x] Add scheduled reconciliation and anomaly detection.

### Phase 4 — Product-wide UX and navigation
**Status:** IN PROGRESS
- [x] Add browser-level UX coverage for the existing critical route matrix.
- [x] Add Playwright CLI as a complementary browser-exploration/smoke layer without replacing `@playwright/test`.
- [x] Expand UX coverage from route reachability to real user workflows and outcomes; organization/branch, partner onboarding, partner lifecycle and Finance Hub journeys are covered in Playwright suites.
- [x] Verify the first-load AI workspace flow is functional, not decorative; authenticated root lands in the real `/ai` workspace and first-action failures are surfaced.
- [x] Remove duplicate navigation shell and establish one canonical information architecture; SuperAppSidebar now aliases the canonical EcosystemSidebar and the IA/token contract is documented.
- [x] Ensure role-specific navigation and permissions are consistent; RBAC and branch-management negative-path coverage exists.
- [x] Establish the canonical web/mobile DentVision design-system and Figma handoff contract, reusing existing --dv-* tokens and one shared IA; connected-Figma canvas execution remains gated on an available Figma file.
- [x] Verify visible buttons/links/forms have understandable labels and critical onboarding/branch/owner actions are exercised by browser tests.
- [x] Verify loading/error/success behavior on critical owner, partner and AI workflows; remaining broad UI state execution is release-gated.
- [x] Verify responsive behavior and accessible button naming on critical screens through browser UX coverage.

### Phase 5 — Core clinical workflows
**Status:** QUEUED
- [x] Patient → treatment case → appointment → completed visit → patient summary workflow is covered by a dedicated E2E journey.
- [x] Treatment plans and odontogram persistence/history contract: treatment-plan CRUD/status/tenant tests plus tooth 16 status/surface round-trip through the canonical patient write/read model.
- [x] Diagnostics ordering/results workflow is covered by the partner lifecycle and referral/result E2E/API journeys.
- [x] Laboratory and dental-lab lifecycle workflows are covered by canonical transition and delivery/remake/delay tests.
- [x] Notifications/reminders: preference-aware in-app/channel dispatch, reminder cron/manual endpoint and reminder idempotency are implemented; waitlist is persisted in the canonical WaitingList model. Invoice partial payments/installments and patient prepayment consumption are now implemented and covered by E2E contracts. [ ] Final debt/prepayment/installment release execution evidence remains; implementation now includes durable partial refunds and idempotent Finance Core reversals.
- [x] Audit trail and medical-data safety controls: compliance routes, medical-file access logging, consent/version enforcement, AI action confirmation and security dashboard are implemented. [ ] Final browser/security execution evidence remains.

### Phase 6 — Ecosystem modules
**Status:** QUEUED
- [x] Marketplace/shop API workflow suite covers catalog, order creation, server-side pricing, stock boundaries, idempotency and supplier discovery.
- [x] Academy workflow suite covers course discovery, enrollment, progress, completion/certificate and duplicate enrollment behavior.
- [x] Jobs/community routes and screens are present; workflow coverage remains release-gated where no canonical seeded mutation contract exists.
- [x] Finance Hub durable partner economics dashboard, reconciliation and transparency workflows are covered.
- [x] Partner onboarding registration forms and owner/organization lifecycle are covered by browser/API workflows.
- [x] AI domain modules and orchestration: role agents, persona routing, context/data scope, permission-gated tools, confirmation-gated mutations, verification/merge lifecycle and deterministic fallback are implemented. [ ] Final live-provider/browser execution evidence remains.

### Phase 7 — Release hardening
**Status:** IN PROGRESS
- [x] Backend/frontend integration checks exist in CI.
- [x] Critical workflow E2E verification exists and runs in CI.
- [x] Full owner/partner lifecycle E2E entry points and operational lifecycle coverage exist for diagnostic center, medical laboratory and dental laboratory; execution evidence remains release-gated.
- [x] Full employee/role/permission/branch matrix coverage has been extended with organization branch management negative-path tests; release execution remains gated.
- [x] CRUD verification coverage exists for owner/staff/branch lifecycle and persistence; remaining domain-specific CRUD is release-gated.
- [x] Negative-path verification covers unauthorized, cross-tenant, cross-branch and expired/revoked invitation boundaries.
- [x] Button/action audit covers visible button naming and critical owner workflow actions.
- [x] Browser console/request-failure collection is integrated into critical owner lifecycle coverage; broad route audit remains execution-gated.
- [x] Android build/release pipeline is implemented: debug/preview/release variants, Gradle unit-test + preview APK workflow, artifact publication and manual workflow dispatch. Final hosted run/device installation evidence remains release-gated.
- [x] Security/permissions/audit checks: cross-tenant/cross-branch, invitation revocation and disabled-member boundaries plus audited medical-record access are implemented; final execution evidence remains release-gated.
- [ ] Production readiness and rollback evidence: deployment/rollback execution must still be captured from the current release candidate.

## Business-owner lifecycle release matrix

Every partner type must be tested from first contact to daily operation in an isolated E2E environment.

### Diagnostic center owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state using existing workflow.
- [ ] Login as owner.
- [ ] Create/edit/archive branch where supported by the canonical domain model.
- [ ] Add, invite, edit, disable and remove staff according to existing permissions.
- [ ] Assign staff to branch(es) and verify access boundaries.
- [ ] Configure services/diagnostic capabilities using existing screens.
- [x] Receive/create diagnostic orders.
- [x] Process order through the actual status lifecycle.
- [x] Produce/attach result where supported.
- [x] Verify clinic-side diagnostic result visibility after signing through the canonical referral read contract.
- [x] Verify payment/settlement/economics and Finance Hub records.

### Medical laboratory owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state.
- [ ] Login as owner.
- [ ] Manage branches and staff.
- [ ] Configure analyses/services using existing domain screens.
- [x] Receive/process analysis workflow.
- [x] Publish/attach results using the existing workflow.
- [x] Verify referral and clinic visibility.
- [x] Verify medical-analysis economics and settlement lifecycle.

### Dental laboratory owner
- [ ] Register owner account.
- [ ] Complete organization profile.
- [ ] Submit/verify onboarding state.
- [ ] Login as owner.
- [ ] Manage branches and technicians/staff.
- [x] Receive lab order.
- [x] Process order through existing statuses.
- [x] Verify delivery does not create a DENTAL_LAB partner-economics transaction or ledger snapshot before settlement (PARTNER-003 negative E2E).
- [x] Verify remake/cancel/delay behavior does not create premature economics.
- [x] Verify clinic-side visibility and financial records.

## Patient experience release matrix

The patient is a first-class product context, not a clinic staff role. The patient account is linked to exactly one patient card per clinic through the existing patient-portal identity/link contract and must never inherit clinic-staff navigation or permissions.

Required release checks:
- [x] Canonical PATIENT account role exists in the UserRole model.
- [x] Patient permissions are limited to self-service profile, marketplace/academy discovery and public diagnostics discovery; medical data remains behind patient-portal ownership checks and consent.
- [x] Demo patient account is linked to a real seeded patient card.
- [x] Patient login routes directly to /patient-portal rather than /ai.
- [x] Patient portal consent gate is exercised before protected medical data tabs.
- [x] Patient design gate checks appointments, treatments, visits, payments, documents, diagnostics and access contexts.
- [x] Patient negative-path design gate verifies clinic CRM, staff, finance, inventory, lab and platform-admin routes are not exposed.
- [ ] Fresh CI execution of the patient role/device matrix.
- [ ] Final interactive production patient login/portal evidence.

PATIENT must not be a clinic ClinicMember; the Patient.userId link is the ownership boundary for the portal. Staff access remains governed by clinic/branch permissions.

## Role and security matrix

- [x] Owner: organization-wide management, branch management, staff management and finance visibility are enforced/covered by the current IAM/RBAC contracts and owner lifecycle tests; final live execution evidence remains release-gated.
- [x] Admin/manager: operational and administrative scopes are permission-gated; branch-management negative-path coverage exists.
- [x] Doctor/clinical user: clinical and assigned organization/branch scope is enforced by shared branch authorization and negative-path tests.
- [x] Assistant: permission-gated workflow access is covered by the RBAC contract; final browser execution remains release-gated.
- [x] Partner operational roles: organization/branch isolation is enforced through shared authorization gates and partner lifecycle tests.
- [x] Patient role: patient-portal access is isolated from clinic staff permissions and covered by a dedicated role/design gate.
- [x] Cross-tenant reads/writes denied at the shared branch authorization gate.
- [x] Cross-branch reads/writes denied at the shared branch authorization gate.
- [x] Expired/revoked invitations denied; invitation revocation is atomic and audited.
- [x] Disabled organization-branch staff denied active branch scope without deleting audit history.
- [x] Privileged branch/invitation/organization mutations have audit actions and applicable idempotent/race-safe boundaries.

## Definition of done
A phase is complete only when:
- implementation is committed to GitHub;
- relevant tests/checks exist and pass or documented blockers are recorded;
- user-facing behavior is connected to the real domain logic;
- no duplicate competing source of truth was introduced;
- `DENTVISION_EXECUTION_LOG.md` records what changed, commit, verification, and next action.

## Current execution priority
**Now — P0 candidate D1–D10 plus integrated #328/#329 work, existing PR #330 only:** continue on `fix/d1-d10-trial-archive-signing-api-20261029`, current exact HEAD `415e4a9dc938de0d3c71cd6b795fd4f9c7f0e8cb`, based on `main` at `ac913cc3389a294d0b135a852b035ddddb1018ca`. The user authorized integrating #328 and #329; both histories are preserved in merge commits on this branch. Their original PRs remain open and unchanged. Do not merge to main until exact-head CI/E2E and all release gates pass.

The candidate implements the 30-day Enterprise trial/backfill and read-only expiry behavior (D1), organization soft archive (D2), document-signing route/token alignment (D3), guarded route aliases (D4), supplier helper correction (D6), invitation-route ownership reconciliation (D7), and the nullable archive/backfill migrations (D8). D9 is still open because the full CI/E2E gate has not passed. D10 remains open because aliases and route existence do not prove every Master Spec workflow is functionally complete. D5 remains open for PHI staging backfill, production CORS/WebSocket verification, official Kaspi contract/callback validation and repository-admin branch protection.

**Latest confirmed candidate fix:** `/api/auth/demo-clinic` searched only for `Clinic.plan = DEMO`, while the shared creation service now creates `ENTERPRISE` trials and the legacy migration upgrades eligible DEMO rows to ENTERPRISE. That mismatch could create a second clinic/trial on repeat calls. The existing-clinic lookup now recognizes both DEMO and ENTERPRISE; archive-aware IAM test contracts were aligned and explicit archived-organization denial tests were added. Commits: `c83cbd010f59399d4d1647366f3a6752e8e892a6`, `e6c3147604f21acf0bf8766048f802540c54c015`, `411ae782f2bdb9964c4c8e5b40378c267ae8aaa1`.

**Verification gate:** the last full candidate run was [40870315832](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/40870315832), on PR merge ref `51a4e1f8dcc53b6284932127f482ccbb48d46c80` for head `469b32d3403614a67151b649de9bf73f03ef9d15). Frontend lint, backend lint, Quality Gate and RB-034 context diagnostic passed. Unit tests had 2,301 passed / 4 failed in `orgContext.test.ts` and `auth.diagnostics-endpoints.contract.test.ts`. E2E's overall job was cancelled after core and Browser UX sub-gates failed: branch-picker option outside viewport; 403 resources on `/crm/patients` and `/crm/treatment-plans`. Mobile design gate passed. The fixes above require a new exact-head run; the prior run is not evidence for the new head.

**Parallel work preserved:** original PR #328 remains open at its original head `966512b54a2937472732e2c94d23fd819de2edb0` on `fix/workspace-switcher-menu-overflow-20261026`; original PR #329 remains open at its original head `c2e5951ba631da1762bd3380c3bbc35c51953770` on `security/rb029-patient-portal-history-envelope-20261026`. Both histories are now ancestors of the #330 candidate through the integration merge commits; neither source branch was rewritten or closed. Temporary integration PRs #331/#332 are closed as merged into the #330 branch. PR #322 remains an isolated Codespaces draft and is not part of this integration. PR #326 is already merged.

**Next sequence:** (1) inspect the new exact-head CI and fix only confirmed failures without removing assertions; (2) obtain staging approval, apply both timestamped migrations and verify migration counts/rollback; (3) prove expired-clinic GET/read access and rejected write/public-booking/signing paths with authenticated E2E; (4) finish RB-029 consumer/concurrent-writer audit and read-only staging dry run; (5) verify production CORS/WebSocket and the merchant-issued Kaspi contract; (6) complete the D10 route-to-workflow matrix from the Master Spec. Keep every item open until its evidence exists.

The work proceeds in vertical slices: implement → targeted verify → full relevant gates → commit → update this plan and the persistent log → move to the next slice.

## Ecosystem support operations — inventory-first workstream (2026-10-23)

**Status:** DESIGN RECORDED; implementation inventory and runtime verification NOT STARTED. Do not treat this as a shipped feature.

Canonical design: `docs/operations/DENTVISION_ECOSYSTEM_SUPPORT_OPERATIONS.md`. This is a bounded operations model, not a competing roadmap or source of product/economic policy.

- [ ] SUP-01 inventory existing support, feedback, incident, admin, notification and knowledge capabilities in code and tests.
- [ ] SUP-02 verify tenant-scoped case lifecycle and immutable audit history.
- [ ] SUP-03 prove server-side role/domain authorization and cross-tenant denial.
- [ ] SUP-04 approve severity/service-hours policy before enabling SLA clocks.
- [ ] SUP-05 verify incident ownership, timeline, customer updates and postmortem workflow.
- [ ] SUP-06 verify assignment, backup ownership, overdue detection and escalation delivery.
- [ ] SUP-07 verify safe attachments, PHI redaction and restricted clinical evidence access.
- [ ] SUP-08 define and reconcile dashboard metrics against source records.
- [ ] SUP-09 verify knowledge search, article permissions, ownership and review lifecycle.
- [ ] SUP-10 verify notification delivery, retries, deduplication and PHI-safe payloads.
- [ ] SUP-11 verify defect-to-PR-to-CI-to-release traceability.
- [ ] SUP-12 verify AI triage remains advisory, evidence-grounded and human-approved for high-risk actions.
- [ ] SUP-13 verify mobile, offline/retry, accessibility and all ecosystem participant contexts.
- [ ] SUP-14 verify retention, deletion, export and legal-hold controls.
- [ ] SUP-15 assign primary/backup operational owners and rehearse incident recovery.

Definition of DONE for each SUP item: exact code path + owning service + authorization scope + tests + current CI/runtime evidence + known limitations. A route, screen or document alone is insufficient. Update this existing plan and the execution log; do not create another status register.


## 2026-10-30 — Current exact-head continuation (PR #330)

This checkpoint supersedes the older CI evidence in the priority notes above. Continue only on `fix/d1-d10-trial-archive-signing-api-20261029` / existing PR #330. The pre-correction candidate reviewed for this pass was `6b02e31eba480084ba57d481b130fcafafe037f5`; `main` was `ac913cc3389a294d0b135a852b035ddddb1018ca`. The local checkout is not mounted, so local `git status` remains unverified.

- Exact-head run [41004898403](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41004898403): frontend/backend lint, TypeScript/build, generated inventory checks, Quality Gate and RB-034 diagnostic passed; unit tests were 2,316/2,326 with 10 failures.
- Corrective candidate: update three brittle trial/archive source-contract assertions; add Express `method: 'GET'` to referral-access test requests (runtime access middleware unchanged); restrict organization archive to scoped owner-level roles rather than generic `admin` / `org_admin`, per IAM matrix, with a regression contract. Re-run exact-head CI before accepting.
- E2E 41004898403 is not green: core 240 passed / 5 skipped / BRANCH-003 failed because the branch option was outside viewport; browser UX 3 passed / one test failed on 403 resources at `/crm/patients` and `/crm/treatment-plans`; mobile design gate passed with 15 passed / one flaky WebKit attempt; role/context was cancelled and later gates skipped. Do not disable assertions. PR #328 owns the separate workspace-picker remediation; preserve it.
- Parallel candidates preserved: #328 open (CI failed, Quality Gate passed); #329 open (CI cancelled, Quality Gate passed; RB-029 staging/backfill still open); #322 open draft. No branch/PR creation, merge, deployment, DB migration or production write.
- Next: exact-head correction CI; endpoint-level tracing and least-privilege diagnosis for CRM 403s; complete full E2E/role/owner gates; then approved staging verification of trial/archive migrations, PHI backfill dry run, production CORS/WebSocket, official Kaspi contract/callback, branch protection and D10 workflow parity. All remain release blockers until evidenced.



## Integration reconciliation — 2026-10-30

Historical priority notes retained from parallel branches; they do not supersede the current D1–D10 priority.

### Preserved 329 branch change

## Current execution priority — reconciled 2026-10-26
**Now — P0 security/release integrity:** complete fresh exact-HEAD CI for PR #328 (workspace picker, active IAM context and canonical organization-branch E2E). The prior core E2E evidence on PR #329 exposed a test helper that created an organization-scoped branch then queried it with the legacy clinic-scoped endpoint; the candidate updates the helper to list by canonical organization ID. This correction is not release evidence until a fresh full run passes. RB-034/RB-031/RB-032 remain open until the full role/context, WebKit/CORS, Visual Agent, business-owner and organization-owner gates pass together. Keep main unchanged until required checks complete and only merge the intended PRs.

**Next — P0 data protection (RB-029):** the versioned encrypted JSON envelope codec, backwards-compatible reads, canonical Patient CRUD/odontogram writers and guarded dry-run-first backfill already exist on main. PR #329 corrects the Patient Portal structured-history writer; rejects caller-supplied ciphertext/envelopes at the Portal and canonical Patient create/update HTTP boundaries; minimizes PHI in durable PatientCreated AI events; and adds fail-closed envelope validation and regression contracts. The latest candidate's backend TypeScript gate exposed an event-payload typing issue; the follow-up also hardens the no-key malformed-envelope path and corrects the inventory. Fresh exact-head CI must pass before further closure work. After exact-head CI passes, complete the broader review of every Patient history reader/writer, AI/event/transcript/report/export copy and concurrent legacy writer; review backup/rollback; run only an explicitly verified read-only staging dry run; reconcile counts, round-trip and integrity. Never backfill production or deploy without explicit approval and verified rollback evidence.

### Preserved 328 branch change

**Immediate verification dependency — existing PR #328:** the current IAM/page-surface candidate is `56ab3ecfe5d1f0d02cc8be00816151a69dd30dce` on `fix/workspace-switcher-menu-overflow-20261026`. It reconciles the ASSISTANT/LAB page surface and the role-gate policy oracle. Exact-head CI, role/context and Visual Agent evidence are pending; RB-031 and the unnamed Clinic Settings controls remain open. Keep `main` unchanged.

**Now — P0 security and release integrity:** continue the dedicated RB-034 verification on the existing branch `security/doctor-agent-tenant-isolation-20261025` after the current role-gate candidate is checked. The exact candidate SHA must pass targeted DoctorAgent negative-path tests, TypeScript, backend lint, unit tests and the full role/context E2E gate before RB-034 can be closed. The PR #328 page-policy change alone does not close RB-034. The generated system map must match the generator on any candidate branch.

### Preserved 328 branch change

**Next — P0 data protection:** continue RB-029 on the existing medical-history candidate. Complete the full Patient.medicalHistory read/write/AI/report/export inventory, verify encryption-envelope compatibility and concurrent writers, review backup/rollback, then run an approved read-only staging dry run with count/round-trip/integrity reconciliation. Do not run a production backfill or deployment without explicit approval. Repository-admin action for RB-033 (required branch checks on main) remains manual and release-blocking; verify actual required-check names and prove a failing check blocks merge.

### Preserved 329 branch change

**Manual release control — RB-033:** required branch-check protection on main remains a repository-admin task. Read and record the exact required-check names and demonstrate a failing check blocks merge; do not assume this can be completed through application code.


## 2026-10-30 — Role/E2E failure repair

- Inspected the exact-head CI artifacts for run [41041393534](https://github.com/drtamirlan911-cell/DentVision1/actions/runs/41041393534), not only the summary. The role/context gate had 103 passed, 37 failed, 28 skipped; Visual Agent had 45 passed and 3 failed. Core, Browser UX, mobile design, business-owner and organization-owner gates passed.
- Confirmed causes: permission-incompatible background queries in `useDataQuery` created 403 console errors for the LAB role; clinic lab-order endpoints required unrelated patient/appointment permissions; the diagnostics referral file input lacked an accessible name; the role matrix visited a nonexistent Academy course ID.
- Implemented targeted fixes in the existing #330 branch: gate data queries by effective permissions, use `lab.read` for lab-order reads and `lab.write` for status transitions, hide create/edit/delete controls when permissions do not allow them, use the dedicated PATCH status endpoint, label the file input, and seed the general-audience `e2e` Academy course.
- These changes are **UNVERIFIED** until a fresh full CI/E2E run on the new exact HEAD completes. Isolated `401 GET /api/auth/me` errors in the prior artifact remain open for follow-up. Do not relax assertions or treat this as release-ready.
- Preserve #330 as the only active code target; do not touch `main`, do not create a replacement branch/PR, and do not run staging/production migrations or deployments.


## 2026-10-31 — D1 expiry consistency correction (PR #330)
- [x] Centralize the distinction between subscription entitlement expiry and Clinic tenancy activity: expired subscription no longer writes `Clinic.active=false`; explicit suspension remains separate.
- [x] Cover the service transition and the superadmin subscription API route with regression tests.
- [ ] Re-run exact-head CI, full role/context, Visual Agent, business-owner and organization-owner release gates.
- [ ] After approval, validate D1 migrations and expired-clinic positive GET / negative mutation behavior on staging; do not run production migrations or PHI backfills from this candidate.


## 2026-10-31 — Role/Context test-harness lifecycle fix
- [x] Inspect exact-head artifacts and verify that requests recorded as pending actually returned HTTP 200 with bodies in the nested Playwright network trace.
- [x] Replace object-key pending tracking with method+URL counters that safely reconcile duplicate requests and request-finished/request-failed events; exclude only EventSource/SSE from finite request draining.
- [ ] Re-run exact-head full CI. Re-evaluate route-policy/forbidden-redirect failures without weakening IAM assertions.
- [ ] Keep PR #330 draft and overall release NOT READY until the complete current-head gate set passes and remaining D1/RB evidence is closed.


## 2026-10-31 — Role/Context lifecycle and accessibility follow-up
- [x] Track finite API and same-origin lazy-module requests per main-document epoch; don't attribute prior-document completions to the route loaded after navigation.
- [x] Keep current-document network/API/page/server errors as hard failures; record only old-document navigation aborts separately.
- [x] Stop draining prior-shell requests after the protected-route redirect has been proven.
- [x] Increase all PlanAccessBanner dismiss targets to 36×36 and add a regression test for the three dismissible states.
- [x] Pass the already-computed least-privilege clinical/billing options when a patient is selected by ordinary list click.
- [ ] Re-run exact-head CI and verify Role/Context, Visual Agent, Business Owner and Organization Owner.
- [ ] Capture the exact WebKit OPTIONS/request headers for `/api/diagnostics/laboratories`; no speculative CORS changes.
- [ ] Keep D1/D2 staging, RB-029, D5, D9 and D10 release evidence open until explicitly verified.


## 2026-10-31 — PlanAccessBanner test harness fix
- [x] Preserve real `react-i18next` exports in the dismiss-target regression test; only stub `useTranslation`.
- [ ] Re-run full unit and exact-head release gates after this mock-only correction.

 
## 2026-10-31 — D1 null trial-deadline repair (PR #330)
 
- Re-audited the 30-day expiry contract after confirming canonical CLINIC authentication hydrates the linked legacy clinic ID before `planGate`; the earlier organizationId concern was not a confirmed bypass.
- Confirmed a separate edge case: a non-DEMO clinic subscription with `status='trialing'` and `periodEnd=NULL` had no finite deadline. The privileged subscription upsert route accepts an omitted periodEnd, and the access resolver previously fell back to Clinic.createdAt only for legacy DEMO clinics.
- The resolver now uses `Subscription.createdAt + 30 days` for a trialing subscription with no periodEnd, persists the derived deadline, and still uses Clinic.createdAt for legacy DEMO rows. Existing explicit periodEnd values are never reset.
- The legacy-trial migration now backfills non-DEMO trialing rows with null periodEnd from Subscription.createdAt. Regression tests cover expired and still-active windows plus migration SQL. The existing migration remains unapplied in staging/production.
- Parent candidate `0093f7e974b7cb6f0b79c7734125a99394b78fcb`: Quality Gate and RB-034 passed; lint/unit/build, Core E2E, Browser UX and Mobile Design passed. Role/Context was still running when this follow-up superseded the parent run; its result is not claimed. The diagnostic collector also preserves React console arguments so any future missing-key warning retains its component-owner stack.
- Fresh exact-head CI, Quality Gate and RB-034 are required for the resulting commit. D1 remains OPEN until approved staging verification proves post-expiry positive reads and rejected writes.
- No staging/production migration, database write, PHI backfill, Render environment change, merge to main or production deployment was performed.


## Follow-up execution slice — 2026-10-31

- [x] Add buyer cancellation for pre-fulfilment, unpaid cash-on-delivery orders with owner-scoped API and transactional stock restoration.
- [x] Add retryable DentCash refund marker and visible Shop Orders cancellation/retry controls.
- [x] Guard payment settlement and supplier status writes with compare-and-set order-state transitions.
- [ ] Pass exact-head unit, E2E, browser UX, role/context and visual release gates.
- [ ] Implement provider-backed cancellation/refund for online/Kaspi payments after the official merchant contract and callback semantics are verified.


## RB-029 AI history API follow-up — 2026-10-31

- [x] Filter AI thread enumeration by the active workspace scope.
- [x] Require authentication on the legacy AI history route.
- [x] Decrypt transcript content on the history response and bound pagination.
- [x] Add regression tests for encrypted/legacy reads, malformed ciphertext, pagination and route scope.
- [ ] Audit and restrict PHI in free-form learned preferences and all AIMemory writers.
- [ ] Complete legacy transcript and Patient medicalHistory dry-run/backfill only after approved backup/restore and staging evidence.
- [ ] Keep RB-029 OPEN until all consumers, keys, retention, backup and data reconciliation evidence are reviewed.


## RB-029 AI memory protection follow-up — 2026-10-31

- [x] Encrypt all new MemoryEngine short/session/long JSON values with the shared PHI field cipher and versioned envelope.
- [x] Decode encrypted values on all MemoryEngine read paths and preserve legacy plaintext compatibility.
- [x] Fail closed on malformed envelopes and production writes without ENCRYPTION_KEY.
- [x] Keep explicit free-form learned preferences clinic-scoped; only generic style preferences are global.
- [ ] Inventory/backfill existing plaintext AIMemory records after approved staging dry-run and backup/restore proof.
- [ ] Complete retention/deletion, key-rotation and direct-consumer review; RB-029 stays OPEN until verified.


## CI browser-server stabilization — 2026-10-31

- [x] Synchronize generated docs/SYSTEM_MAP.md with current route inventory (692 unique handlers, 654 mounted HTTP registrations; Shop router 38 handlers).
- [x] Change browser-gate frontend host from Vite on-demand dev server to a built production bundle served by vite preview.
- [ ] Verify the next exact-head full CI completes the same exhaustive role/context route and responsive gates; do not close RB-024 from the configuration change alone.


## 2026-11-01 — Role/Context gate efficiency and diagnostics

- [x] Retain the exhaustive role-1280 route/permission matrix for all declared and discovered routes across all 16 roles.
- [x] Retain all eight role viewport projects and all required per-role/per-viewport screenshots; keep Mobile Design and Visual Agent gates separate and unchanged.
- [x] Restrict repeated route journeys on additional viewports to representative role-specific workflows; keep request-failure, HTTP, console/page-error, tenant-isolation and 36px target assertions intact.
- [x] Add request resource type, elapsed age and response status/content-type/timing diagnostics to failed drain reports, retaining the Playwright request lifecycle as the sole completion authority.
- [ ] Re-run full exact-head CI and verify Role/Context, Visual Agent, Business Owner, Organization Owner, Playwright CLI and final visual-release gates before closing RB-024/RB-025.


## D1 — direct payment endpoint parity (2026-11-01)

- [x] Audit specialty `/api/payments` branch separate from router-level `blockClinicWrites`.
- [x] Block new clinic cashier payment intents on expired/suspended subscription.
- [x] Block clinic-scoped refund and staff-entered static confirmation while read-only.
- [x] Preserve SaaS renewal checkout and provider-backed settlement/callbacks for already-paid transactions.
- [x] Add route-level regression tests for expired clinic payments and allowed subscription renewal.
- [ ] Pass exact-head CI and approved staging post-expiry positive-read/negative-write verification; D1 remains OPEN until both exist.

## D1 — complete clinic write-surface follow-up (2026-11-01)

- [x] Guard clinic cashier payment-intent creation, clinic-owned refunds and manual static confirmations.
- [x] Preserve SaaS subscription renewal checkout and callbacks/API settlement of already-paid transactions.
- [x] Fail closed for legacy clinic payments missing clinic scope metadata.
- [x] Guard scoped dashboard creation and doctor confirmation of clinical AI actions.
- [x] Preserve personal session, consent and medical-file access audit operations.
- [x] Add route/source-contract regressions.
- [ ] Pass full exact-head CI/E2E on current PR #330 HEAD.
- [ ] Obtain approved staging migration/backfill dry run and prove expired-clinic positive reads / negative writes. D1 stays OPEN until both are verified.
 
## D1 — clinic-to-dental-laboratory assignment (2026-11-01)

- [x] Require clinic permission before outbound lab assignment.
- [x] Resolve the active clinic membership and 30-day subscription write state.
- [x] Enforce current branch visibility for the source lab order.
- [x] Reject assignment to inactive laboratories.
- [x] Preserve lab-owner status/technician work on already-assigned cases.
- [x] Add contract regressions for both clinic assignment and partner completion boundaries.
- [ ] Pass latest exact-head CI/E2E and approved staging positive-read/negative-write verification; D1 remains OPEN.

 
## D1 — medical-laboratory clinic-side write boundary (2026-11-01)

- [x] Block new clinic-originated medical-lab orders after trial expiry.
- [x] Block clinic-side status, result, verification and interpretation writes after expiry.
- [x] Require the active clinic context; reject a body clinicId override.
- [x] Preserve reads and already-assigned laboratory-context partner processing.
- [x] Add source-contract coverage for all mutation paths and the partner exception.
- [ ] Pass exact-head CI/E2E and approved staging positive-read/negative-write verification; D1 remains OPEN.

 
## D10 — Dental Laboratory PARTNER-003 (2026-11-01)

- [x] Shared event-table reconciler repairs note / nullable fromStatus for both clinic and partner writers.
- [x] Additive migration prepared for previously created event tables; live migration not run.
- [x] PARTNER-003 covers clinic assignment to independent dental-lab owner.
- [x] Cover dashboard/orders, team visibility, technician assignment and production progression to delivered.
- [x] Assert delivered creates no DENTAL_LAB partner-economics transaction/ledger before verified settlement.
- [x] Verify durable event history, final clinic visibility and cross-laboratory isolation.
- [ ] Add QC checklist and authorized sign-off.
- [ ] Add explicit remake authorization / feedback loop.
- [ ] Add dispatch, shipping, pickup tracking and proof of delivery.
- [ ] Add independent services catalogue and pricing management.
- [ ] Complete invoice → payment → settlement → payout for the laboratory.
- [ ] Verify durable idempotent notifications and AI operational exception summaries.
- [ ] Complete owner/manager/technician RBAC and desktop/mobile acceptance. D10 remains OPEN.
