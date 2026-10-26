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


## Appendix A — Preserved branch census (2026-10-25)

This is a read-only census of all branch refs returned by GitHub at the time of capture. It records **current branch HEAD SHA** separately from PR history; branch names and PR titles are not proof that a branch's unique content has landed. Nothing in this census deletes, rewrites or force-pushes a branch.

- Repository: `drtamirlan911-cell/DentVision1`
- Main HEAD at capture: `d273a4ecdd1daf8b3269d223c06a7a9c43a162e7`
- Integration train HEAD at capture: `e47746354cd91e1d66a641e2084f481638611880`
- Branch refs captured: **241**.
- PRs captured across all returned pages: **300**; open **2**, merged **268**, closed without merge **30**.
- Each branch below is retained. “no PR match” means no PR head ref match in the returned PR history; it does **not** mean the branch is empty or safe to delete.
- This is a preservation inventory, not a claim that all 241 branches have completed ahead/behind and semantic diff review. The priority diff review remains separate below.

| Branch | Exact current HEAD | PR history match |
|---|---|---|
| `синхронизация-с-базой-данных-0ee69` | `063551493637daf9019f7216e096880ee285b962` | #8 merged |
| `фронтенд-и-бэкенд-интеграция-3fd94` | `e8c6b4497a00a75d2fc5ea4e8d84d8175436a041` | #13 merged |
| `критические-ошибки-и-улучшения-532ea` | `21344fe6bbbc1e47bd532253a1728435794d2ece` | #10 merged, #9 merged |
| `ошибки-в-системе-записи-93495` | `1304af24f4bf5b4985bdbda1c9b0cb19129779a4` | no PR match in 300 returned PRs |
| `обновление-базы-данных-8b4ee` | `3f544e0b215fadd019bf328d255ae0cfbb6b7309` | #12 merged, #11 merged |
| `проверка-всех-данных-8cd9c` | `befae67bb6570771ffe0b7f6334c55c0b6a88d84` | #152 merged |
| `проблемы-добавления-сотрудников-302b7` | `771c313e29be7e924354527a82c446ca1e6622ca` | #15 merged, #14 merged |
| `реализация-доработок-дашборда-a82b0` | `36bca927dc7f481cbd5cb4d4771a61d182ebd35b` | no PR match in 300 returned PRs |
| `улучшение-рекомендаций-adc63` | `87e4c9ff3ed0b9824a8a0ff1eca52516fe76f0ee` | #18 merged |
| `agent/release-gate-fix-2026-09-23` | `205cd8d28f3595df48e1108285e2917080a12c16` | #282 merged |
| `android-guest-shell-ui-alignment-7928342359698286807` | `69ad6c3ddd8c64f61442f914928eecd2c90d768d` | #237 merged |
| `audit/full-parity-2026-09-08` | `f9d1d65b04c949b2b90dfc62903145ef06fb12d9` | #242 closed-unmerged |
| `audit/iin-patient-20260916` | `f5b84d1515ee1b95021474393b8858787ef91fa6` | #278 merged |
| `audit/pre-launch` | `c3f90b0d4bf664bd81827536f0b7e8cd5f9b8153` | #189 merged |
| `audit/safe-sync-2026-09-09` | `67b2a918d79f9e4936c633d5d15295b9da971088` | #243 merged |
| `audit/ui-functional-parity-20260916` | `e6881db7b7a81cebff59a1dc7be6064b0465eca4` | #277 merged |
| `autonomous/ai-employee-safety-20260910` | `fb83ac7b7248616eaef41c9e63e82d00c8c8dc65` | #267 merged |
| `autonomous/android-release-ci-20260910` | `69cbd1a8d18ce184e069d3c8cc0788303e95234f` | #264 merged |
| `autonomous/design-system-ux-20260910` | `1322a4fb04adf72b7f589308eec33e608947a703` | #269 closed-unmerged |
| `autonomous/mobile-ui-polish-20260910` | `e8141213d4f1084125f37292ed96ac978f3421c2` | #265 closed-unmerged |
| `autonomous/reconcile-pr247-20260910` | `4050e072cc70775a9a6b18f12c8fdea247c29531` | #263 closed-unmerged |
| `autonomous/release-control-audit-20261024` | `f30119b4f6752e540327666f9f34afe4a17bfe96` | #309 closed-unmerged |
| `autonomous/release-hardening-2026-09-10` | `8309f16793c0a85b9519232ceefb91ce56dcb418` | #261 merged |
| `autonomous/restore-execution-log-2026-09-09` | `31797ad3cd8b5a574821a6032e458d9d13fde670` | #249 merged |
| `autonomous/superapp-foundation-2026-09-09` | `3c3f9ec211cd9d84ca58d71662972706bcb9eba8` | #247 closed-unmerged |
| `chore/release-evidence-20260929` | `6353243c684ddb58ab6c5e69b6dc0cdf19863aea` | #295 closed-unmerged |
| `chore/repo-cleanup` | `b78a0434a59a940cea84aed2cc9fc05055e146fc` | no PR match in 300 returned PRs |
| `ci/ai-employee-task-gate` | `192d0bd2e78805cbee7b23315c9918bae94f21d4` | #268 closed-unmerged |
| `claude/business-logic-functions-review-xck4wl` | `a544ea4980b4496de9af9b7db1983257a29f0ec3` | #235 merged, #234 merged, #233 merged, #232 merged, #231 merged, #230 merged, #229 merged, #228 merged, #227 merged, #226 merged, #225 merged, #224 merged, #223 merged, #222 merged, #221 merged, #220 merged, #219 merged, #218 merged, #217 merged, #216 merged, #215 merged, #214 merged, #213 merged, #212 merged, #211 merged, #210 merged, #209 merged, #208 merged, #207 merged, #206 merged, #205 merged, #204 merged, #203 merged, #202 merged, #201 merged, #200 merged, #199 merged, #198 merged, #197 merged, #196 merged, #195 merged, #194 merged, #193 merged, #192 merged, #191 merged, #188 merged, #187 merged, #186 merged, #185 merged, #184 merged, #178 merged, #177 merged, #176 merged, #175 merged, #174 merged, #173 merged, #172 merged, #171 merged, #170 merged, #169 merged, #168 merged, #167 merged, #166 merged, #165 merged, #164 merged, #163 merged, #162 merged, #161 merged, #160 merged, #159 merged, #158 merged, #157 merged, #156 merged, #155 merged, #154 merged, #153 merged |
| `claude/diagnostic-workspace` | `244535da0e7a3980a7e65b527f26c9a727cb4591` | #183 merged |
| `claude/fix-page-lockout` | `7b707e0ffc23d19c8381d9d4075a07045ceaeb20` | #179 merged |
| `claude/person-compensation` | `f76c6d73e256c2ad2217df9a090acf9b9255808c` | #180 merged |
| `claude/platform-page-parity` | `ede9b8033a74185578d8bfa1f2f32145f6f98b5b` | #182 merged |
| `claude/server-page-parity` | `cc29c09f09e840ee6e4129c427a757b753438a92` | #181 merged |
| `cleanup/flatten-repo` | `3c908315c4e5d605959b46efd8436ecfadfc9779` | #151 merged |
| `codex` | `b8df8a51a627d2df70119ce3b234036c899c0869` | #16 merged |
| `codex-9eqne9` | `078350d4936219729253e9174f17016a0c290a3c` | #17 merged |
| `cursor/academy-os-63e2` | `1b6157156ed1849566c6ac7545c7c336c0d21c03` | #82 merged |
| `cursor/academy-payment-qr-ff74` | `c0f627d23c9ce4823bf79d62a3f22a4a37ce177a` | #112 merged |
| `cursor/ai-agents-os-spec-63e2` | `7cf3710fb1cfa08b76925727ce7b189a2d26f809` | #32 merged |
| `cursor/ai-alerts-compact-ff74` | `885b10ea24798c46ac62523c1a5a7b4bc4ff7bca` | #127 merged |
| `cursor/ai-clinic-load-data-ff74` | `7c22823e8e04e3a97dd4b7262f1fd260894b19ad` | #134 merged |
| `cursor/ai-inline-nav-buttons-ff74` | `7f8cb040527c031ccfd74b75901534eb92a8e54a` | #111 merged |
| `cursor/ai-jobs-query-ff74` | `6f9b7d26edba4aaa40faaa88998f2e160a247f53` | #140 merged |
| `cursor/ai-memory-school-tutor-63e2` | `4b91c29c6098846cb955016722027eef7f7078b9` | #22 merged |
| `cursor/ai-os-orchestrator-63e2` | `8f15eb40900978045a37638622e407a593bd5d30` | #34 merged, #33 merged |
| `cursor/ai-preference-learning-ff74` | `56723ef8dff5106b45f2393241669eb47573e017` | #121 merged |
| `cursor/ai-proactive-clinic-load-ff74` | `73f650a57f95115e7c4cf5ae4099d2c24294d41d` | #135 merged |
| `cursor/ai-smart-platform-ff74` | `0bfaedecf9a0002b477472e2dba39d0bd8d4c729` | #146 merged |
| `cursor/ai-strategy-personas-ff74` | `2e31ed205fb4557beb359405fffc9a9415cdf592` | #149 merged |
| `cursor/ai-workspace-premium-ff74` | `2f78f17397b8e5f5018b27eee8cbb8860ff4f0c6` | #74 merged |
| `cursor/app-polish-63e2` | `746f0be4ea2f6f9d6ac90733c994354e47455825` | #71 merged |
| `cursor/audit-api-contracts-63e2` | `156686524f0176a133c64dff01f1c4e0f7c64c7f` | #31 merged |
| `cursor/chunk-load-recovery-ff74` | `a10b06a460e12db09c9c80df0923836266491784` | #108 merged |
| `cursor/clean-test-clinic-63e2` | `e1ace06c97a1d997f48f0e1af3752db9401c6aa8` | #28 merged |
| `cursor/clean-test-users-63e2` | `8f1391a6078dde1e9af28bf6836e73ac56de6de0` | #27 merged |
| `cursor/clinic-kaspi-merchant-ff74` | `baacd5579d336ea00a8b5be84404abfc3f861d0d` | #113 merged |
| `cursor/clinic-pricelist-staff-invite-63e2` | `81e1e3eac0b9c4e35dffc47320ba5c32fba40146` | #42 merged |
| `cursor/clinic-subscription-billing-8deb` | `166a202a1d1b4ad5b2527a344a601122f6e822a7` | #72 merged |
| `cursor/clinic-switcher-chat-scope-ff74` | `314ab4ad9fb8cfe92ca88857417f0f1aa7cb6a0a` | #123 merged |
| `cursor/crm-chairs-cron-offline-ai-63e2` | `c2ba7656e097dd6422560eb173b3351163b87e8a` | #38 merged |
| `cursor/crm-clinic-settings-no-cashier-63e2` | `64c7f820cdc099965895bb5090c86d00ff55192d` | #39 merged |
| `cursor/crm-competitive-ideal-63e2` | `a6d587af70cb0dc6e77eb0dc8051084e9da48ed1` | #35 merged |
| `cursor/crm-production-ready-63e2` | `34a076bead182e66a8bc5a95284ee1d9376d5b3f` | #45 merged, #44 merged |
| `cursor/crm-realtime-recall-63e2` | `b0b2a2d22cdd414df810e2d87bfaa3741dea2664` | #37 merged |
| `cursor/crm-role-tabs-ff74` | `8ad1e47c05385becdb1c47d5a397a7c2e515a2a5` | #117 merged |
| `cursor/crm-week-lab-reminders-63e2` | `75812144c00d3ce7893cf88302b16996b1ce5f3b` | #36 merged |
| `cursor/dentvision-platform-spec-63e2` | `d11ae59805e3574d6bb073bdd901e3b43c83b4bb` | #21 merged |
| `cursor/doctor-payroll-63e2` | `db481802d8660700450e672a9b6c99a221f86594` | #78 merged |
| `cursor/doctor-role-guardrails-ff74` | `01c087ce699f06af1cd9a089524c46d53c984bcb` | #150 closed-unmerged |
| `cursor/ecosystem-finance-iam-integration-plan-48fa` | `6c2f58fb09108b6eeb098b04c7e3650bfd2d8298` | #23 merged |
| `cursor/feat-ai-cheap-model-router-8deb` | `b3f32566eefe65c89a115afc975a4eaf61682f53` | #106 merged |
| `cursor/feat-community-social-dm-8deb` | `efe309d4c5c0b26f5e4ea55d4a8b77d9c3587b48` | #101 merged |
| `cursor/feat-dentcash-wallet-8deb` | `f01653efd0b3978c7f79bf7935d78afb7ee7d62d` | #90 merged |
| `cursor/feat-jarvis-role-briefing-8deb` | `427456315f2a045c7f44cacc2a2314eba6be8fe1` | #102 merged |
| `cursor/feat-shop-school-buy-photos-8deb` | `69e66a3b4f5b33320d8691fcea6bb2a6166b24b9` | #103 merged |
| `cursor/finance-block-ff74` | `9c2d154694ec8d160b87d332c5ba18af5a4af0da` | #148 merged |
| `cursor/fix-admin-prisma-import-63e2` | `3cd0c0761d70b553d2425dc0f01d555c8afc6bb6` | #29 merged |
| `cursor/fix-ai-currency-kzt-8deb` | `6196c0f8f93ab80cbd6fe1f722d01ac3be2acbf0` | #93 merged |
| `cursor/fix-ai-runtime-ff74` | `4ad621e252c9f2c5ca789634822bbba4adfe1dc0` | #143 merged |
| `cursor/fix-ai-timezone-greeting-8deb` | `bc3d7e497a682951747948e3c22b18a3b84c2b44` | #105 merged, #104 merged |
| `cursor/fix-alert-bell-ff74` | `757500ae04f8f5cbb28f15c21b6aa48944d218bb` | #141 merged |
| `cursor/fix-alert-dropdown-syntax-ff74` | `6c585df9a8e2dddde0f457f939d8aabab9274737` | #144 merged |
| `cursor/fix-alerts-crm-auth-63e2` | `26c63ac8cbd4f4a4eece268f7b930f63f83d7bdb` | #89 merged |
| `cursor/fix-api-ai-cashier-63e2` | `80849ac7f8f86f39734f97b83b6e97c2142fa67a` | #30 merged |
| `cursor/fix-api-cors-8deb` | `2dd1b3f0857f5f10ef5cefb2b4b9487d7f644bf1` | #73 merged |
| `cursor/fix-avatar-mobile-ff74` | `765f10522099b5e7a08acbfe36caf025f1900753` | #142 merged |
| `cursor/fix-blank-outlet-transition-8deb` | `4aeec264c7c39826aa892f7473b3be256bc02d36` | #92 merged |
| `cursor/fix-cashback-visibility-8deb` | `bd5e6078c6e5b4b1123e85bc6ce0e7cf84cdd971` | #98 merged, #97 merged |
| `cursor/fix-clinic-settings-visible-63e2` | `71d49e5653ef06e2b75c747fe7c1863a026ae7d9` | #41 merged |
| `cursor/fix-collapsed-sidebar-ff74` | `f2330b81e411c885260b6b4f09e8b2186ebc7a70` | #118 merged |
| `cursor/fix-community-lab-ai-session-63e2` | `8d04ae5f11dc4c51d617071be633b94ea34871e9` | #40 merged |
| `cursor/fix-cors-staff-delete-ff74` | `2f309cca6359edde73a20bd77b5c456fbaaf6632` | #130 merged |
| `cursor/fix-dentcash-import-ff74` | `d9b229a722560e94d498860a2b5132bd6bfca9fa` | #125 merged |
| `cursor/fix-digital-twin-roles-8deb` | `8e07098618cc1e0a04d6197720af9b356edb5c9d` | #84 merged |
| `cursor/fix-empty-ai-message-8deb` | `9b0c802e1d93f1e3d09e171f71ce97ad61c99e15` | #86 merged |
| `cursor/fix-guest-ai-welcome-8deb` | `ed2c1459d6708d8fa1c479a8060cd52a7eed18e5` | #96 merged |
| `cursor/fix-interface-settings-ff74` | `40329cfebfbad24b21ad6c01ffb416c4c39232df` | #120 merged |
| `cursor/fix-login-memberships-63e2` | `3184a01e6509d6f5f4805950025b7a29a98a5409` | no PR match in 300 returned PRs |
| `cursor/fix-missing-router-imports-8deb` | `1c36e823f259d7329cbd0b8d6dfb14e77bbf2560` | #62 merged |
| `cursor/fix-mobile-ux-8deb` | `adab1d70e28d0563e470dfb7222b7efcc67e4ce9` | #99 merged |
| `cursor/fix-ops-lecturer-name-8deb` | `7f153dfd09fa669606ef837897a02be136d970d0` | #91 merged |
| `cursor/fix-ops-superadmin-check-8deb` | `16d913b778c7d9552c5ff70e3ecf7add698cef6a` | #69 merged |
| `cursor/fix-payment-accept-save-8deb` | `9003c5639b8c8e0d0b35f2fe4e6bcc4f7cc5795f` | #94 merged |
| `cursor/fix-payment-admin-only-8deb` | `7d74e49eaabdc9907aa05aa7247bc21940751c7e` | #88 merged |
| `cursor/fix-plan-access-banner-ff74` | `1a4a59d0ded51308dac5db02bcac55f308d3c4ee` | #126 merged |
| `cursor/fix-plan-banner-ai-guest-ff74` | `e23730e73643339da0ac78043afd66134cedb43a` | #129 merged |
| `cursor/fix-proactive-execute-ff74` | `3ff109b894c5a87600ab955fc231bf92dc802aed` | #110 merged |
| `cursor/fix-profile-odontogram-8deb` | `491474203565907bd4c91470f7e4f3f89582d2aa` | #100 merged |
| `cursor/fix-profile-supplier-jobs-8deb` | `45e2426d4c1210608b0997239dd304a1d153cf0d` | #66 merged, #65 merged |
| `cursor/fix-render-prisma-63e2` | `5286adb4c53051ef8adcf916da881fc2f223094b` | #25 merged |
| `cursor/fix-safe-prisma-cjs-63e2` | `4eb986510daf483841e3379da60568ece4586a5f` | #26 merged |
| `cursor/fix-schedule-bookings-63e2` | `b63bff84e43b034a48629c50db854a916dabee0b` | #61 merged |
| `cursor/fix-schedule-doctors-8deb` | `046d9b145ee16b8592bf23ba0505ecf75abbc719` | #83 merged |
| `cursor/fix-schedule-payroll-lecturer-8deb` | `ad10771581228a93f2f18a540c4c1ff1eb696269` | #87 merged |
| `cursor/fix-select-contrast-b83b` | `f76f1fc3eaad1bda5ed21101eaf5302dd214e22d` | #77 merged |
| `cursor/fix-staff-delete-ff74` | `a67359ce7b02848ead5be9243e1e79849f1ed822` | #116 merged |
| `cursor/fix-staff-invite-async-63e2` | `ea07769685f5b128fdf66797aa0d3e6fd869fc19` | #47 merged |
| `cursor/guest-acl-security-ff74` | `5aed3a9cea5bc0952f9d0da81bf40423add44872` | #128 merged |
| `cursor/guest-acl-unknown-ff74` | `e55ec75ba9069177ad4e1f970c211a18cc0aef34` | #107 merged |
| `cursor/icd10-directory-fix-ff74` | `288defd43220aac529ff2881de09d9b4c8705b3e` | #115 merged |
| `cursor/jarvis-live-greeting-ff74` | `ac5a17d469604cf8b0a1c84f153dff361300ccf0` | #139 merged |
| `cursor/launch-polish-ff74` | `32dc901d144f45c402502018fcf99da724a0b970` | #147 merged |
| `cursor/lecturer-webinars-textbooks-ff74` | `17841691e9e00e20cdbf0c7d5596adc2fb2fcf47` | #122 merged, #119 merged |
| `cursor/marketplace-kaspi-cabinet-63e2` | `d845d17a002170f047abf42fbe883259e2b51dc5` | #81 merged |
| `cursor/odontogram-plan-ai-402-ff74` | `c7361706abb67ee2740b3d92373317c3e55d8eb8` | #136 merged |
| `cursor/odontogram-polish-ff74` | `3bf9c0cd1051b09e3ac060cc0a1fdb3f871b4070` | #133 merged |
| `cursor/online-booking-patient-63e2` | `1205d8bfa0d3f1a60feaa8342498a9b1a5309ca5` | #46 merged |
| `cursor/platform-ops-command-center-8deb` | `4c75248481d6cf7bf322f30c704bb02b43d19078` | #70 merged |
| `cursor/promo-feature-videos-ff74` | `61f6d3f5956f1308d1059db76a5663ce69dad7c7` | #64 merged |
| `cursor/promo-videos-audiences-ff74` | `6b2daf49967269a0900b172fe39c47a9f5349df9` | #95 merged |
| `cursor/release-harden-ff74` | `25ba26c4639772e71dd5f9094ea0a5c310f854f2` | #145 merged |
| `cursor/release-prep-b83b` | `5d0249a35f3cf7afcb0197b350dcd8427da7dc0d` | #68 merged |
| `cursor/remove-ai-team-ff74` | `54b94365fbe080e06bf8f71ab4926a70d371d576` | #132 merged |
| `cursor/render-server-bridge-63e2` | `0c4545f67b80b39b9712fb66bb5e1a4cb6ffd220` | #24 merged |
| `cursor/responsive-device-polish-ff74` | `b62e1ea88fe59e542800de3b49d2bc0d11da071c` | #124 merged |
| `cursor/restore-phase-prisma-models-8deb` | `1450ae9ac9e58fad277ccd812732552bbb6f9897` | #63 merged |
| `cursor/ru-section-labels-ff74` | `fe739272a54f7318f4c8b90a2f54957d0e37f89b` | #109 merged |
| `cursor/saas-plan-gating-ff74` | `c34781549092ebee1de47d89431a0f6284b57397` | #114 merged |
| `cursor/schedule-payment-accept-8deb` | `6da202fbb5f3330f02d0f37d7ba7fbae5e519b43` | #85 merged |
| `cursor/school-cabinet-context-panel-8deb` | `0176bdc95ab73c71521f1417ca722d7480c53ad1` | #80 merged, #79 merged |
| `cursor/shop-guest-stock-ff74` | `8fc154ca7171e081799cbeba0a301d7fa7bd5fb2` | #131 merged |
| `cursor/shop-stock-seller-only-ff74` | `39f55eb0c9d2a59153d3fea131c92a0af9aade53` | #138 merged |
| `cursor/sidebar-beauty-ff74` | `6075c75c5e87c462935591a654f976d483871072` | #137 merged |
| `cursor/stabilization-phase-0-5-fixes-48fa` | `e5268460cead34e9fe30056e30a83624cf4500a3` | #43 merged |
| `cursor/treatment-plan-editor-63e2` | `3ba4a7380e80a7ceb345738544d1695c0cdc29ce` | #75 merged |
| `cursor/v2-phase1-iam-permissions-48fa` | `cad0aa7f1fe34fa2075b328269671d6619c7f3df` | #48 merged |
| `cursor/v2-phase2-suppliers-48fa` | `d9e3657901150c933cb4337e5e17d1caa79878b6` | #49 merged |
| `cursor/v2-phase3-academy-48fa` | `309d0a69f6fa041bc09cbfcc2af70cf837eaff48` | #50 merged |
| `cursor/v2-phase4-finance-48fa` | `5d1be486a8c55038871c66727eadcad91ef3828e` | #51 merged |
| `cursor/v2-phase5-payments-48fa` | `ec644502c681152fdab3e46b59cbfc95c59912bb` | #52 merged |
| `cursor/v2-phase6-ai-governance-48fa` | `f73df6bcd1a1e764fa5814924b3f511cfd461044` | #58 merged |
| `cursor/v2-phase7-compliance-analytics-48fa` | `f4a44fb8966e45f46fec574155a6b430f9dd8c69` | #54 merged |
| `cursor/v2-phase8-developer-platform-48fa` | `0bda3ff41e826fe740308a7a3f95503a35e0de81` | #53 merged |
| `cursor/v2-phase9-workflow-48fa` | `f279acf7cc5fe7e731324c644643baea3e148c1b` | #56 merged |
| `cursor/v2-phase10-data-intelligence-48fa` | `ff9362761f443b8ac6c729bea1ca4ed8a6373d8c` | #57 merged |
| `cursor/v2-phase11-partners-48fa` | `27c115ff0f6805dff78d0733aba15e3625fcf857` | #55 merged |
| `cursor/v2-school-workspace-48fa` | `fef49c93ec1da185e7bc27619474eb2db8db000b` | #60 merged |
| `cursor/v2-supplier-workspace-48fa` | `710a7f24259394885ef473fd25e494617dd0df63` | #59 merged |
| `cursor/vercel-spa-rewrite-8deb` | `24f32134745676349e4d401afc70dc08836ca6ae` | #67 merged |
| `cursor/verify-subscription-payment-8deb` | `8860414382ef4bfb5dba3861e1359a233e77c7b5` | #76 merged |
| `dentvision-superapp-release-641431333165904803` | `8e432e4e5e28fd216871200380973d79cf1c0d1d` | #238 merged |
| `devin/blueprint-audit` | `e99897475e3c1c10f083fb50e4e64930a5d2f928` | #19 merged |
| `devin/p0-fixes` | `97878bb9fa44542f980109b8b99d072c6f3d7cc4` | #20 closed-unmerged |
| `docs/ai-employee-task-lifecycle-recovery-20261025` | `d184d6156537d2a1412039e2a87e58eeec277678` | #316 merged |
| `docs/branch-management-current-main` | `e88bc986eba39a7bdbc65c059521ee24752cb91f` | no PR match in 300 returned PRs |
| `docs/log-finance-hub-20260912` | `e4b79493c05f4aad3cd3a7c7942bb9fe1ebe5672` | #274 merged |
| `feat/branch-management-control-plane` | `d4cf46d7fe49ffce467867486b9a5c7d86e8f668` | no PR match in 300 returned PRs |
| `feat/branch-management-documentation` | `21cead16df30159a5bed1664f991aa053345a3dc` | #281 closed-unmerged |
| `feat/clinical-odontogram-20261004` | `d3b50d7cde0065e2c93d215e78f9973902ce3ba7` | #301 merged |
| `feat/content-access-hardening` | `57615fd02ea9811a9102ead5bca07982149377a8` | no PR match in 300 returned PRs |
| `feat/dental-lab-economics-vertical` | `bc933e5f3396043c60f21d91e77ad34e69cae74b` | #273 merged |
| `feat/ecosystem-support-ops-20261023` | `1b984c200d5c5469684de3ab5abd7e8326a4f156` | #308 closed-unmerged |
| `feat/enterprise-superadmin-complete` | `b4822b4ad07a72c5bf71dcb42b139d5384edb69f` | no PR match in 300 returned PRs |
| `feat/home-dashboard-ai-services` | `35bb02408da8fcf62ad9873c91ecbdfd7cb0470d` | #241 merged |
| `feat/home-dashboard-proactive-ai-custom-grid-14172438245139088814` | `226ddbb5fd58c034aa477890c59b44b0b9c98ac4` | #244 closed-unmerged |
| `feat/iam-role-matrix-v2` | `b1e465e20cc8940926ca62e76897199a05629266` | #275 merged |
| `feat/invitation-service` | `6c730102255dda43aceeaf4e10987b25e66a2144` | no PR match in 300 returned PRs |
| `feat/unified-dentvision-visual-system` | `d6007e364d4e5341db1e96df8c536b7406b11bd1` | #245 merged |
| `feature/cross-clinic-patient-history` | `afb4befd5c2d176e6346a7264f3d2c39a6566e8e` | #190 merged |
| `fix/ai-provider-circuit-breaker` | `659d7bcde14d8c2fedaafd9de322976f291183b0` | #291 closed-unmerged |
| `fix/ai-provider-circuit-breaker-current-main` | `7986605cb5be2e706646bda002a2310e337012bd` | #292 merged |
| `fix/appt-006-diagnostics` | `8de0ee698b4e75c152405f6f382df4a1fdc09ae4` | #276 merged |
| `fix/auth-refresh-origin-2026-09-10` | `03b77825f279586244770b94edb282f588b40c5c` | no PR match in 300 returned PRs |
| `fix/clinical-diagnostics-signoff-p0` | `140af15c5c2369d8a7d94fdcab61f999878f26ad` | no PR match in 300 returned PRs |
| `fix/durable-event-bus` | `f997feac1fa3a3b268206047c1eb72a13577c61d` | #290 merged |
| `fix/e2e-branch-seed-schema-alignment` | `0a4e904ff4295d405aaa0f3c8db9f0ff43a2e8c4` | #299 merged |
| `fix/e2e-response-capture-mobile-targets-20261025` | `848e58cfd8d8b841821ddeeaa82190daab508dbf` | #315 merged |
| `fix/iam-supplier-context-test-contract` | `0a2ba23a712166ccedf17b410bf4cbac5709aa2e` | #298 merged |
| `fix/laboratory-workspace-context-2026-09-25` | `a97da5b948fc2262fd39608d702fb880612443c9` | #283 merged |
| `fix/lecturer-academy-org-backfill` | `6097bff8e9c751e16004ee235607f1f061be648c` | #296 closed-unmerged |
| `fix/lecturer-canonical-academy-scope` | `c1cfe12bd6c790d7275f35d9847aaa39a709b220` | #297 merged |
| `fix/mobile-sidebar-section-state-20260911` | `1cbaa49be68e90064f0b6603fb21465a13d1e354` | #270 closed-unmerged |
| `fix/p0-security-and-mobile-sidebar-20260911` | `50a587f2a21632314cc19fbc264eb94298594db1` | #271 closed-unmerged |
| `fix/partner-role-switch-matrix-2026-09-25` | `c8c08ec1fb8a86ede268410d9ef07f925ab183fc` | #284 merged |
| `fix/payment-integration-gates-20261025` | `3bab6fed540465a6817fe925bf18f350510bfef4` | #314 merged |
| `fix/payment-route-reconciliation-20261025` | `510f8756c8a76070d536ed92438a9ff5f14a7c1e` | no PR match in 300 returned PRs |
| `fix/release-blockers-20261006` | `8855e522dce91b01652520bef2ccec6e21f5630f` | #302 closed-unmerged |
| `fix/release-blockers-cycle2-20261008` | `b8103432fe312e26d365c82374fda76377cd8c63` | #304 closed-unmerged, #303 merged |
| `fix/release-blockers-cycle3-20261008` | `79981c83ccf9327f60bf0654c563c1755a282487` | #305 closed-unmerged |
| `fix/release-blockers-cycle4-20261008` | `4a1b2358e2c18718acf76805d200f73e532325b9` | #306 merged |
| `fix/release-evidence-reconciliation-20261025` | `c9336da421f1955a57c224fc095a6ec7026faa47` | no PR match in 300 returned PRs |
| `fix/release-gate-and-accessibility-9211833639157158689` | `83d45be4344f039ce5fe7ef48cbdfcd54f3b3585` | #236 merged |
| `fix/release-gate-owner-label-2026-09-25` | `a397abce83061fe23b7c3b0e0ae89702932fb05b` | #285 closed-unmerged |
| `fix/release-gate-owner-label-main-2026-09-25` | `7594cf448ec393d55845f5bb653fbd3eebe9788d` | #286 closed-unmerged |
| `fix/release-gate-partner-context-ux` | `ebc2d2c72833ae2ded04d91a0d2ca2e8e10203d4` | #287 merged |
| `fix/role-visual-gate-notifications` | `ba56f21aa8ad9fb5157db3440d102320be3036a7` | #289 closed-unmerged |
| `fix/session-expire-ownership-20261025` | `6168efae76efec4e798d0ab31ddb4b8ba956f7ed` | #319 open |
| `fix/support-api-contract-20261025` | `1f5efb66d052965fd6e19351bd05c9cb85b1c6cf` | #312 merged |
| `fix/system-map-sync-20261001` | `2d1a838d96603983c2907758424ae8004dc620d6` | #300 merged |
| `fix/vercel-branches-alignment-1790140788188047040` | `9fd96f725f89d365094adadbe6fcc5b134180cf2` | #240 merged |
| `iam-action-revocation-hardening` | `882e3b2dae16ebdc9ae997a6d2c76c948d7373fa` | #279 closed-unmerged |
| `iam-action-revocation-hardening-main` | `9827a0eb0cd8ffed3c4c33aa8a47bf0b03ed6fe2` | #280 merged |
| `integration/merge-all-20261025` | `41bd18baaddc22e97c4f09df7541e56f3aa0bb0c` | no PR match in 300 returned PRs |
| `integration/merge-train-20261025` | `e47746354cd91e1d66a641e2084f481638611880` | #317 open, #313 merged |
| `jules-16144970178050850721-5c39dcbf` | `1ad98522426c76ba3c4fbed2bfa2aa06220442e1` | #246 merged |
| `jules-8394512741542577388-45c90105` | `fc630cc25ccc89ddca225fd1708e4e85d7aac15f` | #250 merged |
| `kaspi-superapp-ux-upgrade-441408188398633409` | `c16830a8a019ed5b1d4eece9bfb647224fd1a6cd` | #239 merged |
| `main` | `d273a4ecdd1daf8b3269d223c06a7a9c43a162e7` | #262 closed-unmerged |
| `master` | `27e69f3347a3c2c578f4fb8d0d03e3b48ffa0958` | no PR match in 300 returned PRs |
| `migration-only` | `09c3c3ce117fe385080a3984165d5ddf8ce25396` | no PR match in 300 returned PRs |
| `onboarding-277-rebased` | `fe384994bb0bcb7adaac545be42a5c6b6003c3ca` | no PR match in 300 returned PRs |
| `reconcile/pr247-main-20260910` | `e915c5d7ce31e2ec2190d352692be8e00650fbec` | no PR match in 300 returned PRs |
| `refactor/master-spec-v5-organization-scope` | `003d5fe31b770e99b7ccb855b67e0435a1a9d894` | #288 merged |
| `release/verification-20260929-b` | `000d928cf280e3cf6a1090b86d4cad11e5f4cf21` | #294 closed-unmerged |
| `release/verification-20260929` | `62a002cfe8a5a1f99d6b7436445b80a558bf0a3f` | #293 closed-unmerged |
| `security/doctor-agent-tenant-isolation-20261025` | `bf65526de39628201a94ab986c77cc38d73cbfbe` | #310 merged |
| `security/payment-hardening-20261017` | `adaaa90794018911451d9faa649aa880d9b093de` | #307 closed-unmerged |
| `security/staged-release-fixes-20261023` | `dbe5cd7259f7702e9a1835940a32d3f822251b3a` | no PR match in 300 returned PRs |
| `test/clinical-tenant-idor-main-20260911` | `45aa3ddfadb19094fc7cad901a8b33afdefa10ab` | #272 closed-unmerged |
| `test/preserve-payment-checkout-regression-20261025` | `25d253558a607d40e8562356790665c163917a3f` | #318 merged |
| `tmp/cleanup-247-2` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | no PR match in 300 returned PRs |
| `tmp/cleanup-247-3` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | no PR match in 300 returned PRs |
| `tmp/cleanup-247-4` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | no PR match in 300 returned PRs |
| `tmp/cleanup-247` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | no PR match in 300 returned PRs |
| `tmp/merge-main-into-247` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | no PR match in 300 returned PRs |
| `tmp/rebase-247-20260910` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | no PR match in 300 returned PRs |
| `tmp/247-main-base` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | no PR match in 300 returned PRs |
| `tmp/247-main-into-head` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | no PR match in 300 returned PRs |
| `tmp/247-merge-main` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | #260 closed-unmerged |
| `tmp/247-merge-main-check` | `7a03535f7e42c6643c3c60de3f5db15bd2f10825` | no PR match in 300 returned PRs |

### Explicit integration guardrails

1. Preserve every branch listed above until its unique commits/content have been compared to `main` and the integration train, test evidence has been reviewed, and the reconciliation is recorded.
2. A merged PR does not prove its current branch tip is merged: refs may have advanced after merge or the PR may have multiple historical uses. Compare the exact SHA, not just PR state.
3. A closed-unmerged PR or a branch with no PR match remains reviewable work, not disposable clutter. Group identical tips (for example, the `tmp/*247*` family) as shared snapshots; do not delete them during reconciliation.
4. Do not merge the integration train until its divergence from current `main` has been reconciled and required exact-head CI/E2E/role-context/visual/Android gates pass. Current state remains NOT READY.

## Appendix B — Selective source-tree audit and security port (2026-10-25)

### Audited outcomes (exact blob SHA/content comparison, not commit-count heuristics)

| Source branch | Audit result against current `main` | Integration disposition |
|---|---|---|
| `fix/payment-integration-gates-20261025` | Payment route and the creation-security/refund/settlement test blobs were verified identical to canonical `main` at audit time. | Already represented; do not copy duplicate files. |
| `fix/payment-route-reconciliation-20261025` | Contains older billing and Academy price assumptions, older branch-role normalization, and fewer appointment/invoice ownership assertions than `main`. | Preserve ref; do not merge stale files wholesale. Main's newer contract remains canonical. |
| `security/payment-hardening-20261017` | Large older-tree divergence; many paths have old content and current-main-only files are absent. | Preserve ref and selectively inspect only concrete non-duplicated security changes. |
| `security/staged-release-fixes-20261023` | `fieldEncryption.ts` is already identical to `main`; branch `phi.ts` returns an encrypted payload after decryption/integrity failure, whereas `main` fails closed. | Keep main's stronger behavior. RB-029 (clinical-history JSON encryption and audited backfill) remains open. |
| `security/doctor-agent-tenant-isolation-20261025` | `doctor.agent.ts` and its security test are blob-identical to `main`. | Already represented; preserve historical branch ref. |
| `feat/dental-lab-economics-vertical` | Economics service, service test, and event subscriber are blob-identical to `main`. | Already represented; no duplicate port. |
| `fix/ai-provider-circuit-breaker` | Older version lacks the current `aiProviderUnavailableUntil` fast-path guard present in main's `eventOrchestrator.ts`. | Keep newer main implementation. |
| `fix/lecturer-academy-org-backfill` | Branch's migration script has a narrower lecturer→academy lookup; main also recovers explicit owner and course→lecturer relationships. | Keep current main script; do not regress recovery behavior. |
| `feat/content-access-hardening`, `iam-action-revocation-hardening`, `feat/branch-management-control-plane`, `feat/branch-management-documentation` | Old tree families have hundreds of path differences and omit newer main-only content. Their path-only files are largely legacy plans/tests/screens, not a safe replacement for current application code. | Preserve refs. Selectively cherry-pick only a verified missing behavior, never restore the branch tree wholesale. |
| `feat/clinical-odontogram-20261004` | Holds an older odontogram implementation/file family; it is not a safe whole-branch merge over the current application. | Preserve ref and compare individual clinical requirements before selective port. |
| `feat/enterprise-superadmin-complete`, `feat/invitation-service`, `feat/home-dashboard-proactive-ai-custom-grid-14172438245139088814` | Commit comparison reports zero commits ahead of main. | No unique commits to port at present; keep refs until census confirms no subsequent change. |
| `docs/ai-employee-task-lifecycle-recovery-20261025` | `docs/AI_EMPLOYEE_TASKS.md` exists in main's tree. | Already represented in integration tree. |
| `fix/session-expire-ownership-20261025` / PR #319 | Added a real session-owner authorization gap fix not present in main. | Selectively ported the service, auth-refresh and compliance-route changes plus focused unit and E2E regressions into this train; source PR/branch remains preserved for independent review. |

### Session ownership fix ported to the train

- `expireSession(sessionId, userId)` now uses a scoped `updateMany` predicate (`id + userId + active expiration`) and returns false when no owned active session is changed.
- Refresh rotation stops with 401 if the refresh-token session cannot be expired for its authenticated user.
- Compliance session-expiration returns the same 404 for missing/foreign/inactive sessions and audits only a successful expiration.
- Added unit coverage in `dentvision-backend/src/modules/compliance/session.service.test.ts` and an end-to-end cross-user check in `e2e/tests/session-security.spec.ts`.
- Port commits: `e730deff2da74161df104eb6c16ef4582067e53b`, `e6c05365af9150f4e9233ed7acb3d67021e221de`, `765aa7768e9ff437c1bd87e4c54e1073714a2f3c`, `c520dadeb4635d3cf7aa98e956e4209fcada055c`, `e6779ef9eaa19a5cb07476ace01757f2e2dec778`.
- Verification status: **not yet validated by exact-head CI**. PR #319 remains open/draft; no claim is made that the complete E2E suite is green.

### Current integration gate status

- Latest fully completed gate: Quality Gate on merge commit `fd1ad330d4cfc9c954127ee902e7f2432575e259` passed.
- On that same SHA, backend-lint, frontend-lint and lint-test passed; the E2E core suite failed while subsequent role/context gate was still running at last inspection. The post-port changes produce a new SHA and require a fresh complete run.
- E2E failure patterns from the prior completed run include late Playwright response-body reads after navigation, a login-form selector timeout in the organization-owner journey, and duplicate test fixture uniqueness keys (users, appointments, idempotency records). These must be repaired at source; do not weaken assertions or disable coverage.
- No source branch has been deleted, force-pushed, rebased, or rewritten. Release status remains **NOT READY**.

## Appendix C — E2E contract corrections after log review (2026-10-25)

| Failing check | Evidence | Change |
|---|---|---|
| Branch-management BRANCH-001/002/003 readback | `GET /api/branches` requires `clinicId` or `organizationId`; the test omitted both and also made unauthenticated Playwright API calls. | Add explicit clinic scope and the browser's Bearer access token to test API calls. |
| Branch-management create diagnostics | UI create failure previously only surfaced as “branch name not visible”, obscuring the API failure. | Capture the matching POST response and include status/body in the test failure while preserving the 201 contract. Use a stable alphanumeric unique code. |
| Notification detail NOTIFY-001 | Client POST to the notifications endpoint returned 403; notifications are operational records and this scenario only needs an existing owner-owned record to verify display/navigation. | Seed the fixture record in the test database and clean it up in `finally`; the test still exercises the actual UI details and linked navigation. |
| Partner lifecycle PARTNER-001 | Refresh token was read from a shared API request context after logging in a radiologist, so refresh correctly returned the radiologist role. | Capture the diagnostic owner's refresh token immediately after self-service onboarding and use that token in the owner refresh assertion. |

These are test-contract/data-isolation corrections, not bypasses of server authorization. Finance partner-economics test FIN-003 still needs an authorized fixture to distinguish parameter validation (400) from the expected authorization denial (403); its assertion is intentionally not weakened.
