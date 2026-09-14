# DentVision — Implementation Reconciliation

**Date:** 2026-09-14  
**Reference branch:** `feat/iam-role-matrix-v2`  
**PR:** #275  
**Rule:** documentation checkboxes are requirements/evidence pointers, not proof of completion.

## Status vocabulary

- **DONE** — implementation + workflow + verification evidence agree.
- **PARTIAL** — meaningful implementation exists, but the full product workflow is incomplete.
- **BROKEN** — intended path exists but current verification exposes a defect.
- **UNVERIFIED** — implementation may exist, but current evidence is insufficient.
- **NOT IMPLEMENTED** — required capability is absent or only represented by UI/scaffolding.
- **CONFLICT** — repository documents and current code disagree.

## Current release control

| Area | Status | Evidence / reason |
|---|---|---|
| CI on PR #275 | **BROKEN** | Run 1970 fails backend TypeScript and lint-test TypeScript; E2E is skipped after the E2E suite failure. |
| Quality Gate #2347 | **BROKEN** | Fails because CI prerequisites fail. |
| Frontend lint | **DONE for this run** | Run 1970 frontend-lint passed. |
| Frontend production build | **DONE for this run** | Vite build passed; chunk-size warning remains. |
| Backend TypeScript | **BROKEN** | `diagnostics.routes.ts` calls `svc.confirmAiResult`, but `diagnostics.service.ts` does not export it. |
| Design-token TypeScript blocker | **FIXED on branch** | Commit `e373c636e7362f7196b7961b36b83e33d50c3201` restores an explicit `as any` dynamic import so TS7016 does not block the test. Fresh CI still required. |
| Vercel preview | **UNAVAILABLE / EXTERNAL LIMIT** | Vercel reports the free-plan daily deployment limit; this is not a code failure. |

## Product implementation reconciliation

### 1. Control plane / architecture

**Status: PARTIAL → release-hardening still open.**

The repository has a persistent execution plan and execution log. The execution plan explicitly requires implementation → verification → commit → log and states that `main` is the product source of truth. The generated `.dentvision/current-state.json` is stale and still describes Phase 0 / CI stabilization with unknown CI/E2E status, so it must not be used as the current release state without regeneration.

### 2. Economics engine / ledger

**Status: PARTIAL.**

Implemented and evidenced:
- deterministic partner economics engine;
- floors/caps/volume tiers;
- rule versions and transaction snapshots;
- idempotent economics operation ledger;
- diagnostic settlement integration;
- dental-lab `delivered` recognition boundary;
- Platform BI economics endpoint;
- Finance Hub Partner Economics panel.

Still open according to the execution plan and execution log:
- durable accepted → paid → settled verification with immutable rule/version evidence;
- real medical-analysis payment/settlement lifecycle through the existing `Referral + Laboratory + LaboratoryTest + Payment` domain;
- full ledger/reconciliation surface;
- automated reconciliation and anomaly operations.

### 3. Partner onboarding

**Status: PARTIAL.**

The current PR adds/extends the unified IAM role model for specialized diagnostic/medical-lab/dental-lab contexts and real Academy/Marketplace audience policy. Existing E2E coverage has entry points for partner owner and employee workflows.

Not yet release-complete:
- registration → organization → verification → first login → operational workspace for every partner type;
- complete branch lifecycle;
- staff lifecycle with branch assignment and disabled/revoked access;
- partner Finance transparency and payout state;
- operational order/result/settlement lifecycle for every partner type.

### 4. IAM / RBAC / tenant isolation

**Status: PARTIAL.**

Current code contains explicit organization context checks, referral branch checks, role mappings, partner role registries, and negative professional-content checks. The PR specifically targets safe partner role separation and prevents patient context from inheriting professional access.

Still requires release-grade matrix verification for:
- Owner / Admin / Manager / Doctor / Assistant;
- diagnostic center / medical laboratory / dental laboratory operational roles;
- cross-tenant denial;
- cross-branch denial;
- revoked/expired invitations;
- disabled staff;
- auditability of privileged mutations;
- active-session enforcement and all protected routes.

### 5. Clinical OS

**Status: PARTIAL.**

Current repository contains Patients, Medical Card, Visits, Dental Chart/Odontogram, Treatment Plans, Treatment Case Workspace, Diagnostics, Lab, Documents, Finance and related clinical components.

The canonical product requirement is a connected clinical graph centered on **Clinical/Treatment Case**. Presence of individual screens is not sufficient proof of a complete end-to-end case lifecycle.

Remaining verification target:
`Patient → Diagnosis → Imaging → AI Findings → Treatment Plan → Appointments → Procedures → Lab → Materials → Documents → Payments → Communication → Follow-up → Outcome`.

### 6. Odontogram / 3D

**Status: PARTIAL / NOT IMPLEMENTED for requested true 3D.**

A functional dental chart exists, including anatomical SVG tooth rendering and plan synchronization. The current dependency graph does not establish a Three.js/WebGL or Babylon-based natural 32-tooth 3D renderer. Therefore the requested natural interactive 3D odontogram is not considered complete.

### 7. Diagnostics

**Status: PARTIAL.**

Real diagnostics routes, referrals, branch access checks, centers, laboratories, studies, files, AI-result generation and result signing exist. Public diagnostics discovery also exists.

Still requires full vertical verification:
clinic order → center/lab acceptance → scheduled/in-progress/completed lifecycle → result upload → AI interpretation → clinician confirmation → patient record linkage → payment → canonical economics → Finance Hub.

### 8. Medical analysis laboratories

**Status: PARTIAL.**

Referral economics routing to `MEDICAL_ANALYSIS` exists and is covered by focused tests. The repository execution log explicitly records that the current payment callback path does not associate `Payment` with referrals, so the real paid/settled medical-analysis lifecycle remains incomplete.

### 9. Dental laboratories

**Status: PARTIAL.**

The existing `LabOrder` workflow is connected to canonical dental-lab economics at `delivered`, with idempotency and tests. The execution plan deliberately keeps recognition at `delivered` until a real paid/settled callback exists.

Still required: full owner/staff/branch/order/result/remake/cancel/delay/clinic visibility and financial lifecycle E2E.

### 10. AI control plane

**Status: PARTIAL.**

AI workspace, proactive UI, approvals/governance components, AI result generation and multiple AI domain surfaces exist. The canonical operating model requires `Intent → Context → Permission → Plan → Preview → Confirmation when required → Execute → Verify → Audit` and clinician-controlled clinical facts.

The repository still requires verification that this model is consistently enforced across critical AI actions and that the first-load AI experience is functional rather than decorative.

### 11. Marketplace / Academy / Network

**Status: PARTIAL.**

Real Shop, Academy, Jobs and Community surfaces and APIs exist. The current PR strengthens audience policy for Academy and Marketplace. Production completeness still requires transaction/workflow E2E rather than route existence alone.

### 12. Finance Hub

**Status: PARTIAL.**

Platform partner economics are now exposed through the existing BI/Finance surface. The canonical finance model also requires GMV, platform revenue, processing cost, AI inference, storage/data, support/ops, refunds/chargebacks, tax/VAT, contribution margin and net platform revenue, plus reconciliation and alerts. These remain broader than the currently verified partner-economics panel.

### 13. UX / design system

**Status: PARTIAL.**

The repository has a unified visual system and design-token regression tests. The current PR's design-token test itself had a TypeScript import blocker, now fixed on the branch. Release work still requires real browser workflow verification, accessibility, loading/empty/error/success states, responsive behavior and removal of remaining outliers.

### 14. Web release gate

**Status: NOT READY.**

The older `DENTVISION_RELEASE_GATE.md` is stale because it marks every check as PENDING despite later successful CI runs. It should not be treated as current evidence. Current PR #275 itself is not release-ready because the latest CI run is red.

### 15. Android

**Status: UNVERIFIED / NOT RELEASE-READY.**

Android work exists, but a fresh release build/install/runtime verification is still required. Previous Gradle wrapper/network timeout evidence means Android cannot be marked DONE from repository presence alone.

## Immediate blockers

1. **Fix `diagnostics.routes.ts` orphan call to `svc.confirmAiResult`.** The route was added in PR #275, but the service export is absent. Do not add a fake declaration or weaken TypeScript; either implement the real service action using the existing result/AI domain or remove the route if it is outside the PR's intended scope.
2. Re-run backend TypeScript and full CI after the fix.
3. Re-run full E2E; the current E2E suite did not reach the business-owner, organization-owner or browser UX gates because the main E2E suite failed first.
4. Complete the partner role/branch/tenant negative-path matrix before merge.
5. Continue the Economics → Ledger medical-analysis payment boundary and durable reconciliation work.
6. Regenerate `.dentvision/current-state.json` only from verified repository state; do not hand-edit it into a false green status.

## Merge rule

**PR #275 must not be merged while CI, Quality Gate, backend TypeScript, or the required E2E suite is red.**
