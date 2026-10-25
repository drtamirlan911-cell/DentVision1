# DentVision1 integration reconciliation — 2026-10-25

## Purpose
This file is an integration checkpoint on `integration/merge-all-20261025`. It is not a competing roadmap and is not evidence of release readiness. Preserve source branches until the complete integration is verified.

## Canonical documents checked
The current-main files were read through GitHub: `DENTVISION_OPERATING_DIRECTIVE.md`, `DENTVISION_CONTEXT.md`, `DENTVISION_EXECUTION_PLAN.md`, `DENTVISION_EXECUTION_LOG.md`, `docs/RELEASE_BLOCKERS.md`, `docs/SYSTEM_MAP.md` and `docs/DENTVISION_MASTER_SPEC.md`.
The operating directive requires inspect → implement → test → fix → verify → document → continue. `docs/SYSTEM_MAP.md` is generated and must be regenerated from code, never resolved by manually selecting a stale copy.

## Exact baseline
- Main HEAD when this checkpoint was started: `b27f9b920ee08388dfb560c4ad0ff6243f461844`.
- Already merged:
  - PR #300 → `22c1350abf311859a791ff773d43e2b1fb1487b9`.
  - PR #310 → `f1276fdb9ab2d7761f7e6c3f77e82eff752ac835`.
  - PR #301 → `b27f9b920ee08388dfb560c4ad0ff6243f461844`.
- Original source branches remain: `fix/system-map-sync-20261001`, `security/doctor-agent-tenant-isolation-20261025`, `feat/clinical-odontogram-20261004`.
- Integration branch is intended as the reconciliation workspace. Do not force-push or delete branches. Do not treat the earlier merge order as proof that their E2E gates passed.

## Open PR inventory and evidence captured
| PR | Branch | Change set | Latest available CI evidence | Integration decision |
|---|---|---:|---|---|
| #307 | `security/payment-hardening-20261017` | 99 files, 222 commits since base `d47aec8` | CI run 40064469652 failed: role/context release gate; lint jobs pass. Android and Quality Gate pass. | Do not blindly merge. GitHub merge endpoint reports conflicts. |
| #302 | `fix/release-blockers-20261006` | 106 files, 380 commits since base `d47aec8` | CI run 37791379352 failed: core E2E, role/context, business-owner and visual gates. Quality Gate and lint jobs pass. | Do not blindly merge. GitHub merge endpoint reports conflicts. |
| #309 | `autonomous/release-control-audit-20261024` | 6 files | CI run 40163222925 was in progress at the last exact check; lint/test checks had passed, E2E incomplete/failed steps reported. | Docs conflict with canonical files changed by other PRs; reconcile after code tree is stable. |
| #308 | `feat/ecosystem-support-ops-20261023` | 2 files | CI run 39928387786 failed at generated system-map validation; E2E/browser/mobile gate steps reported failure/cancellation. | Design-only proposal, not shipped runtime functionality. Merge its unique design document and plan items only after reconciliation. |
| #310 | `security/doctor-agent-tenant-isolation-20261025` | 8 files | CI run 40164023070: lint/type/unit passed; E2E was in progress when merged. | Already merged. Re-run exact-main CI/E2E and retain RB-034 open until verified. |
| #301 | `feat/clinical-odontogram-20261004` | 9 files | CI run 37469591391: lint jobs passed; E2E was cancelled. | Already merged. Re-run exact-main clinical, responsive and role/context verification. |
| #300 | `fix/system-map-sync-20261001` | 1 file | Partial Vercel success only; no complete post-merge CI proven in this checkpoint. | Already merged. Revalidate generated map after code integration. |

## Three-way-diff findings (base `d47aec8dc310731516f3a46cd0e3855781dd171e`)
The source trees were compared at the Git blob level, not inferred from PR titles:
- Main differs from the base in 16 tracked file blobs, including DoctorAgent, odontogram files, context/log/plan, blockers and generated system map.
- PR #307 differs from that base in 99 files; PR #302 differs in 106 files.
- PR #307 and #302 both changed 28 file blobs differently. Four changed blobs are identical across both branches (inventory branch scope, patient branch scope, patient routes, E2E factories), so duplicate work can be retained once.
- Their different edits overlap in: CI workflow, context/log, package manifests/lock, Prisma schema, permission and RBAC helpers/routes, payments/shop, release blockers/system map, E2E branch/content/RBAC/role-design suites, workspace switcher, city filter, app entry, layout, role access, community, auth store, and API utilities.
- Against current main, #307 has different changes in 6 existing file blobs: Context, Execution Log, Execution Plan, Release Blockers, System Map and `src/store/auth.store.ts`.
- Against current main, #302 has different changes in 9 existing file blobs: Context, Execution Log, Release Blockers, System Map, NotificationCenter, Odontogram3D, AnatomicalToothSvg, toothMorphology and auth store.

These counts exclude directory tree nodes and are from the Git blob tree, not just textual patch heuristics. They identify where a semantic merge is required; they do not mean every overlapping file is a textual conflict.

## Required integration method
1. Keep `main` untouched while reconciling.
2. Use the base tree plus current main and each source branch for a three-way comparison. Where only one side changed a file, preserve that change. Where both sides changed it, merge hunks semantically or retain the unresolved item for review; never overwrite a full file just to make GitHub accept a merge.
3. Resolve payment creation/settlement/access and IAM/tenant logic first. Preserve server-derived payment identity/scope, idempotency, audit, and cross-tenant denial tests.
4. Resolve the clinical UI conflicts without losing either the curved natural FDI odontogram work or the newer selected-tooth clinical context; preserve the existing `Patient.teeth` / treatment-plan contract.
5. Merge CI workflow changes without disabling checks or deleting artifact uploads. Keep logs/artifacts per run and in compact slices.
6. Reconcile documentation after implementation: retain the historical log by append-only updates, merge all unique blocker evidence, update the Context's exact SHA only after verifying the ref, and regenerate `docs/SYSTEM_MAP.md`.
7. Run targeted tests on the integration branch, then full exact-head CI/E2E/role-context/visual/Android checks. Keep production deploy and release status separate from branch integration.
8. Only after the integration branch passes required checks, open/update one final PR to main. Do not delete the original branches before that PR and all evidence are preserved.

## Open status
- Overall release: NOT READY / exact-head release evidence incomplete.
- RB-029 medical-history JSON encryption, RB-033 branch protection, RB-034 DoctorAgent tenant isolation, and the existing P0/P1 entries remain open until their own fix and verification evidence are recorded.
- This checkpoint itself changes documentation only. It does not close a blocker and does not prove a passing build.
