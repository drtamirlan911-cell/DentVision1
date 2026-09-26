# DentVision — Persistent Execution Log

This log is the durable handoff between work sessions/agents. It records completed work, evidence, blockers, and the exact next action.

## Historical record
The complete pre-2026-09-14 execution history is preserved in the parent Git history at commit `ceb0a85560540d0bff2ecd154189280f8cd6d588`. The current file was accidentally shortened during the 2026-09-14 patient-scope repair; no historical source commit was rewritten.

## 2026-09-14 — Patient branch-scope repair and CI verification

### Implemented
- `0778c61203528024e95634cfffe2555ac9c619c8` restored `setPatientBranch()` after the tenant-scope SQL correction had removed the exported helper required by `patients.routes.ts`.
- `d38104980d54173eb8341e9737d38461ef632cc3` corrected the remaining Prisma/raw-SQL identifier mismatch in `dentvision-backend/src/lib/patientBranchScope.ts`.
- `clinic_members` now uses the actual quoted `"userId"` and `"clinicId"` columns.
- `patients` now uses quoted `"clinicId"` and `"deletedAt"`, and updates `"updatedAt"`.
- `branches` keeps its explicit SQL-mapped snake_case fields (`clinic_id`, `active`), while unmapped Prisma fields are quoted as `"isDefault"` and `"createdAt"`.
- Tenant/branch isolation and fail-closed unknown-role behavior remain unchanged.

### CI evidence
- Main E2E run `34838848180` exposed PostgreSQL `42703: column "clinic_id" does not exist` from `resolvePatientBranchContext()`.
- Patient create/list, diagnosis, cross-tenant and branch workflows failed downstream from this raw-SQL mapping defect.
- Quality Gate `34839556474` subsequently passed after the mapping correction, including TypeScript, ESLint and `release-gate.ts`.
- A later auth edit was reverted before release verification because the first edit was too broad and could have replaced unrelated auth routes. Revert commit: `4c6f153e58e343541dcc5c3cbfd8d24e4e5d4cef`.

### Release status
- Not release-ready until fresh CI is green for the current HEAD and the full E2E/partner gates pass.

## 2026-09-14 — Appointments E2E syntax blocker found and corrected

### Investigation
- The canonical `appointments.routes.ts` exposes list, POST upsert, `PATCH /:id/status`, `POST /:id/close`, and `DELETE /:id`; there is intentionally no `GET /appointments/:id` route.
- The list response is the standard API envelope whose `data` value is itself the paginated response: `{ data: Appointment[], pagination: ... }`.
- `e2e/helpers/api.ts` removes only the outer `{ ok, data }` envelope. Therefore an appointment list returned to an E2E spec is `{ data: [...], pagination: ... }`, not the array itself.
- The prior assumption that `APPT-002` was still the active blocker was incorrect: the test already contained the paginated `listBody.data` lookup in commit `f4db585fba4b15467b4ae963ab5579dc7a75e96d`.

### CI evidence
- Workflow run `34844649917` executed against exact HEAD `cb9d420fa758977f007bfadb0e640efec194c5c3`.
- E2E job `103977529587` failed in the `Run E2E suite` step before any test executed.
- Exact failure: `SyntaxError: e2e/tests/appointment.spec.ts: Unexpected token (260:4)`. The malformed APPT-009 request had `{ headers: { Authorization: \\`*** },` instead of a valid closing template literal/object structure.
- Backend, frontend, database sync, TypeScript, build, unit tests, backend lint and frontend lint all completed successfully in the same workflow run; the failure was isolated to the E2E test source syntax.

## 2026-09-16 — Ecosystem clinical-case continuity and Market pass

### Implemented
- `48beaea9bc127944b27ec90df16d6ba26590802b` — Diagnostics workspace now reads shared ecosystem URL context and renders the compact clinical-case flow when patient/case context exists.
- `e61f10d69222cbfcc723720e1bf0db2c32ff762b` — Main Intelligence shell exposes the same compact clinical-case flow across non-Diagnostics workspaces when patient/case context exists.
- `5420fbe7dfb771f5bef0fe7995198affd41228ff` — Shop checkout preserves `patient`, `caseId`, `branchId`, and `organizationId` through checkout, payment completion, and return to order history; contextual bridge is shown when ecosystem context exists.
- `ed6fd91537301dd550f197ad829e767bd6a74475` — Shop order history preserves the same ecosystem context and provides contextual navigation back to Market/catalog.
- `a52db377ac7aeb9cf42af3ce7b4cda4525944d92` — Shop product detail preserves ecosystem context across catalog/category/product/checkout navigation and exposes the active context bridge.
- `ClinicalCaseWorkspace` remains the canonical `/crm/cases` route; ecosystem relations continue to connect clinical case → diagnostics → medical laboratory → dental laboratory → materials/Market → finance.

### Product intent
- Market is treated as a first-class ecosystem participant rather than a disconnected commerce screen.
- A clinician entering Market from a patient/case workflow keeps that context through product selection, checkout, payment, and order history.
- No new competing product flow was introduced; existing Shop APIs, cart, DentCash and payment behavior were preserved.

### Verification status
- These changes were made during the build-first phase by explicit instruction; CI/E2E were intentionally not run.
- The current functional state is therefore UNVERIFIED until the later full release-gate pass.
- The Vercel syntax blocker in `IntelligenceLayout.tsx` was separately corrected in `00d46709b604fcabb248cba84de70a96c5405958`.

### Next action
- Continue the ecosystem continuity pass through Finance and Medical Laboratory where existing routes support it, then perform the premium visual/Figma pass. Only after the product-wide build pass is complete: run the full CI/E2E/release gates and repair all real failures without weakening tests.

## 2026-09-16 — Finance Core and Medical Laboratory semantic separation pass

### Implemented
- `a149c603dcdc0a418a3b5b8fb346212af84a317a` — Finance period controls retain patient/clinical-case context and provide a direct return to `/crm/cases` without dropping ecosystem URL state.
- `02bb7d55d187452b2c1fe4c8b790f41d3522efcc` — `medical-lab` deep links now explicitly target the existing lab entry with `workspace=medical-lab`; query construction preserves organization, branch, patient and case context.
- `ceda4a18aa4549a85928d7aa0e731eb2e78d1b87` — `/diagnostics/lab` now distinguishes the medical-laboratory workspace from dental-laboratory production instead of silently conflating the two domains. Existing dental-lab behavior remains the default route behavior.
- `3c6247bbda20cc8617655e0cdf4a0eee110293a0` — Finance Core now has a dedicated zero-commission clinical payment primitive. It records a balanced GATEWAY → CLINIC ledger transfer, preserves payment-method metadata, and is idempotent by clinical payment reference.
- `c513c454eaceef47caf288ea5ee802cad2712927` — CRM invoice payment now settles the same clinical payment into Finance Core inside the same database transaction as the invoice status update. This prevents a paid invoice from existing without its corresponding ledger entry and keeps clinical revenue outside DentVision marketplace commission logic.

### Architectural decision
- Clinical treatment revenue is not implemented as a marketplace sale. The canonical economics policy states that DentVision must not take a default percentage of a clinic's total clinical revenue.
- The existing Finance Core remains the accounting foundation; no duplicate ledger subsystem was introduced.
- The patient-facing CRM invoice remains the operational document, while the Finance Core transaction becomes the reproducible financial record for the payment.

### Verification status
- CI/E2E were intentionally not run in this build-first pass.
- The new commits are therefore UNVERIFIED until the later full release-gate pass.
- The next functional block is to connect clinical-case identity more deeply into invoices/payments, then complete medical-analysis and dental-lab production transitions, followed by the premium visual/Figma pass.

## 2026-09-16 — Live Clinical Case cockpit pass

### Implemented
- `ce51af6c6e9e3167f7fc25b4331aadf3a8b8b518` — `ClinicalCaseWorkspace` was upgraded from a navigation-only shell into a live ecosystem cockpit.
- The case workspace now derives real patient-scoped counts from existing CRM data: visits, appointments, dental-lab orders and outstanding finance records.
- The workspace surfaces next appointment, active laboratory work and open financial balance while preserving the existing ecosystem navigation and URL context.
- No new clinical entity or duplicate database model was introduced; this pass composes existing authoritative CRM records.

### Architectural observation
- `ClinicalCaseWorkspace` currently acts as an ecosystem context/cockpit rather than a persisted standalone `TreatmentCase` editor. This is deliberate until the deployed TreatmentCase API/model contract is confirmed; inventing a second case persistence layer would violate the one-ecosystem rule.
- `Invoice` already has a persisted `treatmentPlanId`, while `LabOrder` currently anchors to patient/doctor rather than a persisted clinical-case identifier. The next backend pass should extend case identity only after the canonical TreatmentCase contract is located, not by overloading notes or URL parameters.

### Verification status
- CI/E2E were intentionally not run.
- The new cockpit is UNVERIFIED until the later full release-gate pass.

### Next action
- Locate and connect the authoritative TreatmentCase/clinical-case backend contract; then propagate the same case identity through dental-lab orders and finance where the schema supports it. After that, complete the medical-analysis workflow and premium visual/Figma pass.

## 2026-09-17 — Canonical TreatmentCase graph foundation

### Implemented
- `bdd243074031784c56b8563acea59779bbc9c311` — the new clinical migration materializes the canonical `treatment_cases` links for appointments, dental-lab orders, invoices, treatment plans, diagnostic referrals and visits. Existing historical records remain unlinked rather than being guessed into cases.
- The authoritative `treatmentCase.routes.ts` exposes the canonical case graph, scoped detail, update/archive, and explicit safe link/unlink operations. The graph reads the new nullable columns through clinic-scoped raw SQL.
- `useTreatmentCase.ts` provides the frontend query/mutation layer for canonical case detail and record linking.
- `ClinicalCaseWorkspace` consumes the persisted case graph when `caseId` is present while retaining patient-scoped fallback for legacy/no-case context.

### Vercel evidence and repair
- User-supplied Vercel deployment against `ce51af6` failed during `vite build` before application compilation completed.
- Exact error: `src/layouts/IntelligenceLayout.tsx:124:487 — Unterminated regular expression`.
- The root cause was the desktop context-panel JSX expression: `contextSheetOpen && <motion.aside>...</motion.aside>` was closed directly with `</AnimatePresence>}` instead of closing the inner JSX expression first.
- `343a10b7787e4dbf011f7beb370998b73e3e2f85` rewrote that section into explicit nested JSX blocks, removing the parser ambiguity. The guest role also no longer uses an emoji icon; it uses the existing Lucide `User` component.
- The same Vercel log reported 12 npm audit vulnerabilities (7 moderate, 5 high) and pending install scripts for Prisma/esbuild. Those remain a separate dependency/security workstream and were not blindly changed with `npm audit fix --force`.

### Verification status
- The supplied Vercel build is a confirmed source failure and has been repaired in `343a10b7787e4dbf011f7beb370998b73e3e2f85`.
- No fresh CI/E2E was started during this build-first pass.

### Next action
- Synchronize the new `treatmentCaseId` relations into `schema.prisma` and the generated Prisma client.
- Then wire case identity into creation/update paths so records created from a Case inherit the case automatically rather than requiring manual linking.
- Continue Medical Laboratory result lifecycle and Dental Laboratory production lifecycle.
- Finish premium visual/Figma pass, then run the complete release gates.

## 2026-09-17 — Prisma Case relations + automatic Case inheritance

### Implemented
- `17afeef5ace66fbfc14378f9ad7a190caa462079` — added the shared `treatmentCaseContext.ts` resolver. Explicit case IDs are clinic/patient checked; when no case is supplied, automatic inheritance is allowed only when the patient has exactly one active/on-hold case. Multiple concurrent cases are never guessed.
- `18daf5fc18da70cdac065f453a2ac83cb02e32a8` — added the canonical relational migration layer: indexes and foreign keys from appointments, dental-lab orders, invoices, treatment plans, diagnostic referrals and visits to `treatment_cases`.
- The same migration installs a database-level create trigger. This makes automatic case inheritance writer-independent: Prisma, legacy REST, partner flows, jobs and future services all receive the same deterministic behavior.
- Explicit case links are validated against the patient and clinic; historical rows remain untouched unless explicitly linked/backfilled.
- `df6425bec054dbc08c6bd1acc7d31c04af185721` — added a one-time repository synchronizer that updates the canonical `schema.prisma` with `treatmentCaseId` scalar fields, Prisma relations and reverse `TreatmentCase` collections, runs `prisma format`, commits the synchronized schema, and removes itself. This was introduced because the connected GitHub file API only permits whole-file replacement and the large schema could not safely be reconstructed in-session without an automated exact-text transformation.

### Coverage
- CRM appointments: create-time inheritance via database trigger.
- CRM visits: create-time inheritance via database trigger.
- CRM treatment plans: create-time inheritance via database trigger.
- Diagnostics referrals: create-time inheritance via database trigger.
- Dental Laboratory orders: create-time inheritance via database trigger; existing order meta continues to expose `treatmentCaseId`.
- Finance invoices: create-time inheritance via database trigger; clinical payment continues to settle through the invoice's canonical Finance Core record.

### Safety model
- Explicit `treatmentCaseId` is never accepted merely because the UUID exists: the trigger verifies the case belongs to the same patient and clinic.
- With no explicit case, exactly one active/on-hold case is required for automatic inheritance.
- Two or more active cases leave the link null rather than silently attaching clinical data to the wrong case.
- Updating a record to explicitly unlink a case remains possible because the automatic trigger is INSERT-only.

### Verification status
- CI/E2E were intentionally not run, per build-first instruction.
- The schema synchronizer is also not yet independently verified by CI; the resulting `main` state must be treated as UNVERIFIED until the later Prisma generate/build/release-gate pass.

### Next action
- Confirm the synchronizer's resulting `schema.prisma` state and generated Prisma client contract.
- Replace any remaining route-local case metadata propagation with the canonical Prisma relation where the generated client supports it.
- Then continue the full Case → Diagnostics → Medical Lab → Dental Lab → Finance → Market → AI vertical lifecycle and premium visual/Figma pass before one final release-gate run.


## 2026-09-20 — Diagnostic referral list branch-scope hardening

### Implemented
- `57602c68b1dff7847e736166f72c95da9de2c81e` — `listReferrals` now accepts an optional authorized `branchIds` scope and applies it to the authoritative Referral query.
- `aa1a19c461f9b8419f6a9d17026fe513a7cfbdbc` — clinic referral-list requests now resolve branch scope from the existing clinic membership/branch model before querying referrals. OWNER/ADMIN receive active organization-wide clinic branch scope; other clinic roles receive only their assigned branch scope. Partner-center/laboratory queries retain their existing organization boundary.
- `bf4e8b06f973e5a87e0bb1a7c3e95b1d2bd89bb5` — regression test locks the referral-list branch-scope contract.

### Verification status
- Implementation is committed.
- Fresh GitHub CI status for the latest commit is not yet reported by the connected status surface; therefore this change is **UNVERIFIED** and must not be treated as release evidence.

### Next action
- Verify the fresh CI/E2E result for the exact latest HEAD.
- Continue the planned branch-isolation/security matrix across diagnostics, medical laboratory, inventory, finance and files.
- Then complete accepted → paid → settled durable economics verification, cross-organization workflows, browser/mobile release gates, and update the verified context only from fresh evidence.


## 2026-09-20 — Partner economics connected to Finance Core ledger

### Implemented
- `8844bb59f587153eebacdded0ec10e5fc18102a1` — partner economics now creates balanced double-entry ledger entries instead of only an unbalanced `Transaction` snapshot.
- `616485ce1353153822b4a5e81b5f901511212c3b` — partner wallet uses the schema-supported `PARTNER` owner type.
- `271683c72b31203dd219623f2575fb8459614653` — idempotency test fixture updated for the ledger wallets.
- Flow is now: GATEWAY debit gross → PARTNER credit net → PLATFORM credit commission, while the immutable economics transaction retains the rule/version/cost snapshot.

### Verification status
- Code and regression fixture committed.
- Fresh CI status for this exact HEAD is not yet exposed by the connected GitHub status surface; this remains **UNVERIFIED** until CI/E2E evidence is available.

### Next action
- Continue the remaining durable economics lifecycle checks: paid/settled medical-analysis flow, dental-lab delivered/remake/cancel/delay semantics, reconciliation and Finance Hub visibility.
- Then complete owner/partner lifecycle matrix, role/branch negative matrix, browser/runtime audit, Android verification and production rollback evidence.


## 2026-09-20 — Medical-analysis paid → settled lifecycle wired to Finance Core

### Implemented
- `836e1e990963e04eb21ab897aab79dbc56726afe` — payment settlement now recognizes `medical_lab_order` and routes it through the canonical `MEDICAL_ANALYSIS` partner-economics vertical.
- `f45c06857a02590e37148078319e1a4c7c76e061` — medical-analysis settlement derives the payable amount from immutable order-test price snapshots and rejects payment amount mismatches.
- `124275bc5d20b13b4ced332efb10fc16ff260d5d` — medical-lab order creation validates catalog test ownership and stores the price snapshot on each ordered test.
- `f1c765b19b67368e8a88ae69fc06fc0633975c38` — added a new migration for `medical_lab_order_tests.priceMinor`; the previously applied lifecycle migration was restored rather than edited.
- `2f25da82474c9af18d8f7080ac8e21b1b85c5541` — added regression coverage for successful medical-lab settlement and amount-tampering rejection.
- `f9d766b10997fb91c10d1bdfd2fb96ee9b739a53` — serialized partner-economics wallet initialization with PostgreSQL advisory transaction locks to prevent first-use wallet creation races.

### Lifecycle contract
- Clinic creates a medical-lab order from existing `medical_lab_orders + medical_lab_order_tests + LaboratoryTest` data.
- Catalog prices are snapshotted at order creation.
- Payment creation for `medical_lab_order` is authorized against the clinic and must match the server-derived order total.
- Atomic payment claim changes `pending → paid`; only the winner executes settlement.
- Settlement records canonical `MEDICAL_ANALYSIS` economics using the lab as partner and the order ID as the durable operation key.
- Existing payment transaction rollback semantics remain intact: a settlement failure rolls the payment status change back.

### Verification status
- Code and regression tests are committed.
- Current connected GitHub status for commit `2f25da82474c9af18d8f7080ac8e21b1b85c5541` reports only Vercel = pending; no fresh full CI/E2E evidence is available yet.
- Therefore this lifecycle remains **UNVERIFIED** until the exact HEAD receives CI/E2E evidence.

### Next action
- Continue the planned dental-lab delivered/remake/cancel/delay recognition boundary and reconciliation/Finance Hub durable surface.
- Then execute the owner/partner lifecycle, branch/role negative matrix, browser/runtime/mobile and production rollback gates.


## 2026-09-20 — Dental-lab delivered boundary connected to durable economics

### Implemented
- `5e97e46b5f7089f3fe59f08f1fd3fa633990ae7a` — dental-lab status handling now recognizes the existing `delivered` boundary and invokes the canonical `DENTAL_LAB` Partner Economics engine using the laboratory stored in the order metadata.
- `1a61b1898e02c52095ddf5c77e621110dcc59195` — status mutation, audit event and delivered economics recognition are executed inside one Prisma transaction.
- `747237e8a3d4bfa5f8021cd8e12c59f5af0e563a` — cleaned the transactional implementation so no unused state remains.
- `remake`, `cancelled` and `delayed` remain non-recognition statuses; idempotency is protected by the existing operation ID equal to the lab-order ID.

### Safety
- Economics is not recognized on arbitrary intermediate statuses.
- Re-entering `delivered` from `delivered` does not create a second economics transaction.
- If economics settlement fails, the status/event transaction rolls back rather than leaving a falsely delivered financial state.
- Branch/clinic ownership remains enforced before mutation.

### Verification status
- Implementation is committed.
- Fresh CI/E2E evidence for this exact HEAD is not available yet; this remains **UNVERIFIED**.

### Next action
- Complete the durable reconciliation / Finance Hub economics read model and discrepancy detection.
- Then execute owner/partner lifecycle and branch/role negative matrix.


## 2026-09-20 — Durable partner-economics reconciliation surface

### Implemented
- `06e9e1ecd406205d5c9ef6a76acb4c56fc826b13` — added deterministic reconciliation over durable `partner_economics` transactions and their ledger entries.
- `31af159883f0618d8f68f06733f6985e66f4484c` — exposed the reconciliation result through Finance Core at `GET /finance/partner-economics/reconciliation`, with period, vertical and partner filters and finance authorization.
- Each row verifies gross debit, total credits, partner payout, platform commission and the immutable economics snapshot. Discrepancies are counted explicitly rather than silently corrected.

### Verification status
- Implementation is committed.
- Fresh CI/E2E evidence for the current HEAD is still unavailable; release verification remains **UNVERIFIED**.

### Next action
- Continue Finance Hub presentation/partner transparency from this durable read model.
- Then execute the owner/partner lifecycle and full role/branch/cross-tenant negative matrix.


## 2026-09-20 — Durable Finance Hub partner transparency pass

### Implemented
- `3f0b8a72e0a77ee69e17962e4ef85bad3784e015` — Partner Economics transaction snapshots now retain optional branch scope without creating a second financial model.
- `06989e7b4965e185ebdfe45126e5899ff8c01c1f` — diagnostic settlements propagate referral branch into durable economics.
- `6896223a3750dfd819a70499fcc7f03767fc6b0f` — medical-analysis settlement derives branch from the order's patient and persists it with the immutable economics transaction.
- `c5e384d047307603fb36a698767798d6b23b2bd3` — dental-lab delivered recognition persists patient branch scope.
- `158d30a1a8a05cb2b60410d05c035d3bc091d45d` — added the durable Partner Economics transparency read model: gross, platform commission, partner payout, attributable costs, contribution margin, status, rule version, partner, branch and operation.
- `e46392940af1be16215cb54c5c3d89858c6b80f3` — exposed Finance Core `GET /finance/partner-economics/transparency` with period/vertical/partner/branch filters and finance authorization.
- `c42cacb8131d8b150bf17454c732f7c97d139675` — regression tests cover durable aggregation and branch filtering.
- `befa9cef9b53aa71103ea3d91e26a88a8a2c9f61` — BI Partner Economics now consumes the same durable transparency read model and exposes discrepancy count.
- `a5de3254963c641085a9776a6b16ef69c2061cb7f` and `4b2a6c471392787e4df049184ac859177555cae7` — Finance Hub UI exposes partner/branch rows, payout, contribution, cost and economics version.

### Architectural result
- Finance Hub now reads immutable Partner Economics transactions rather than recomputing historical economics from current rules.
- Branch is persisted as transaction context where the originating workflow has an authoritative branch.
- Reconciliation remains explicit: discrepancies are surfaced, not silently corrected.
- No duplicate ledger or economics model was introduced.

### Verification status
- Implementation and regression tests are committed.
- Fresh full CI/E2E evidence for the new HEAD is not yet available through the connected GitHub status surface; this block remains **UNVERIFIED** until release gates run.

### Next action
- Complete the owner/partner lifecycle vertical slice: registration → organization verification state → first login → branch lifecycle → staff/invitations → operational workspace for diagnostic center, medical laboratory and dental laboratory.
- Then execute the complete role/branch/cross-tenant negative matrix and release-gate verification.


## 2026-09-20 — Business-owner lifecycle: organization profile, verification and first branch

Implemented against Master Spec 5.0 and the Phase 2 canonical owner/branch contract.

- Extended self-service onboarding for clinic, diagnostic center, medical laboratory, dental laboratory, academy and supplier organizations so the owner receives a persisted **default operational branch** at creation time.
- The first branch is created inside the same database transaction as organization/person onboarding and the owner is persisted as a BranchMember; this removes the previous gap where a newly onboarded non-clinic organization had an organization but no operational branch scope.
- Added owner-facing `GET /api/organizations/me` for organization profile + persisted branches.
- Added owner-facing `PATCH /api/organizations/me` for real organization profile persistence.
- Added owner-facing `POST /api/organizations/me/verification` to submit the organization for verification with durable status/timestamps in the existing `Organization.settings` field; no competing verification model was introduced.
- Added SuperAdmin verification queue/review endpoints using the same existing organization record and audit service.
- Added audit events for organization profile updates and verification submission/review.
- Reused existing `Organization`, `Person`, `PersonRole`, `Branch`, and `BranchMember` primitives; no duplicate organization/branch model was introduced.

Commit: 5323ca69994a14e57557e1b7e638c57df8e63bec

Verification: **UNVERIFIED** — the current GitHub status exposes only a successful Vercel check; the repository's CI workflow is not returned by the commit-workflow-run connector for this commit. No pass is claimed until backend build/E2E evidence is available.

Next action: verify the owner lifecycle end-to-end for all three partner types, then complete branch edit/switch/assignment/disable negative tests and partner dashboard economics visibility.

## 2026-09-20 — Explicit branch context and switching

- Added branch context to the canonical auth token/request contracts.
- `POST /api/iam/switch-context` now accepts an optional `branchId` and verifies that the branch belongs to the selected organization and that the caller is either an organization manager or an assigned BranchMember.
- Authentication validates the selected branch against the active organization on every request; changing a URL or token claim cannot grant another organization's branch.
- Refresh preserves the selected branch context instead of silently downgrading the session to organization-only context.
- Self-service onboarding now issues the initial token with its persisted default branch context.

Commits: 379cfb3a71b2d6aeb9aaf5bfccccc2bd19115673, 43f8f2ba77cee66d7ffcd0b0ecde19f88586bcf2, b597d86d46066fbc05d7cb0d034971d42b8367b8, 8d604563bb4b47ff0a8580afbfb5621c6147793b, 2df2e47e1358dcf34dbb7a41e3b187abf5618df1, 06647b83469a07c99b594c9773fb11dddbb21dd9

Verification: **UNVERIFIED**. The available commit status currently reports only Vercel success; backend CI/build/E2E evidence has not yet been returned for these direct main commits.

Next action: add/verify the owner lifecycle release tests for registration → organization → verification → first login → branch switch, then run the branch assignment and cross-branch negative matrix.

## 2026-09-20 — Branch refresh preservation correction

- Corrected auth-context precedence so a token carrying both organization and branch context validates and preserves the selected branch during refresh instead of returning organization-only context first.
- No new data model introduced.

Commit: 1e27ee04b46833b3519b9c8841b1d128344f1306

Verification: **UNVERIFIED** — no CI result is exposed for this direct main commit by the available GitHub status connector.

## 2026-09-20 — Branch management hardening

- Verified the existing canonical `branches` router already provides organization-scoped create/list/update, default-branch switching, staff assignment/unassignment and archive via `active=false`; no parallel branch model was introduced.
- Added audit events for branch creation, update/archive and unified branch staff assignment/unassignment.
- Preserved existing `Branch`, `BranchMember` and legacy `ClinicMember.branchId` paths rather than replacing them.
- Existing authorization checks reject cross-organization branch access and restrict branch mutation to organization Owner/Admin (or clinic Owner/Admin on legacy clinic branches).
- The implementation remains **UNVERIFIED** until isolated E2E proves refresh persistence, branch switching, assignment, cross-branch denial and archive constraints.

Commits: e77170dcc86536810a00f962640c168ba4a7a7dd, 396655ffc49acccf14927c9b98e25fd3aade8882

Next action: wire the existing branch-management API into the canonical Owner Settings/Organization entry point if missing, then add the required isolated E2E and negative matrix for all three partner types.
## 2026-09-20 — Owner organization/branch management entry point wired

### Implemented
- `c8f0656b8764dc6f7ed6642ed98fdaa642380a2c` — connected the frontend API client to the canonical organization profile, verification, branch CRUD/default/member assignment and organization-invitation endpoints; branch context switching now sends the selected `branchId` to the existing IAM context endpoint.
- `5c659a80cda9f1fe6f30b23c21464a675518dcee` — added the real Owner Settings → Organization workspace using the existing Settings surface. It loads persisted organization/branch state, creates/edits/archives branches, changes the default branch, switches operational context, assigns/unassigns organization staff and creates/list invitations.
- `a9bdab5926dbba9fccb79144505ce694827d7a09` — exposed the new workspace as the canonical Organization tab in Settings and kept it restricted to management roles.
- `855d79d12f81bd313adf632e8aa9b0823a770627` — branch member reads now return the linked platform `userId`, allowing the existing unassignment endpoint to target the same user without a parallel membership model.
- `059450c7f859227b298b48a2125e68c298228ce2` — added regression assertions for branch-member identity and the single-active-default archive constraint.
- `8da73d1132f09687698ae2c556e482e047efd7d2` — made one-time organization invitation consumption race-safe with a conditional durable claim.
- `15de91d7e4047b124d96a8a1caf0a7cfa1319ca1` and `404e07ee9048b659b5b15153e071cf6ae3db61ae` — updated invitation tests for the conditional claim and concurrent claim-loss behavior.

### Verification status
- Latest main HEAD: `404e07ee9048b659b5b15153e071cf6ae3db61ae`.
- Connected GitHub workflow surface reports **no workflow runs** for this exact commit.
- Combined status currently exposes **Vercel = pending** only.
- Therefore this block is **UNVERIFIED**. No release pass is claimed.

### Next action
- Verify the Vercel build and backend test/build gates from the exact HEAD.
- Add isolated E2E for owner registration → organization verification → first login → branch create/edit/switch/assignment/archive, plus cross-branch/cross-tenant denial.
- Complete the three partner-type lifecycle matrices and durable Partner Economics dashboard verification before marking Phase 2 complete.


## 2026-09-20 — Branch workspace vertical slice extended

### Implemented
- `16d240690bfc37d79be92de2a9239ff92d606738` — added an authorization-gated branch workspace context endpoint using the existing Organization/Clinic branch authorization layer.
- `8c16e92d48cb84cde76b40157046ce3e0012ad2d` — exposed the branch workspace API to the frontend.
- `fb0471376b4ed57abe6d77855b65d9071782cd0f` — Owner branch opening now switches context and opens the persisted authorized workspace instead of being a visual-only action.
- `4ed2b836d254213e2e8fe4cf60fdf842de77ad74` — added regression coverage for the workspace authorization/context contract.
- `8115339d63030ecb012a0f20dbdcadb8dfd5c6d6` — advanced the execution plan checklist for the implemented owner/branch vertical slice.

### Verification
- Implementation and source-contract tests are committed.
- Full CI/E2E remains **UNVERIFIED** until the repository's actual release gates report results; no PASS is claimed.

### Next action
- Continue the required negative E2E matrix: assigned employee branch scope, cross-branch read/write denial, cross-tenant denial, expired/revoked invitation denial, disabled staff denial.
- Then complete the partner-type operational/economics lifecycle matrix and Finance Hub transparency checks.


## 2026-09-20 — IAM negative matrix: branch scope, staff disable, invitation revocation

### Implemented
- 26cfa9ef1ab0004a3587184933abe5e2388bfac3 — BranchMember.active is now a durable persisted state with a migration.
- 582a6ac36219c0ce9d06f570f141864eefcd25a0 — authentication derives active unified branch scope only from active branch memberships; disabled staff can no longer obtain an active branch context from a stale membership.
- 7fb8dc9a0477cb066f35762916cd85131e96724b — branch staff can be explicitly enabled/disabled through an authorization-gated endpoint; disable/enable mutations are audited; re-assignment reactivates access.
- 8a5ee173caaef2038a53f6c488f566db706beb7b and 1c499f773b8830ba35f31bcde20a224a4229c9f5 — regression contracts lock cross-branch, cross-tenant and revoked-assignment behavior.
- 25d2301296fda5d2a16919443b81d4e06636816d / 521d259da3e0e66a4bae4e9ad6c3f8bd140c60d6 — OrganizationInvitation.revokedAt/revokedBy persisted.
- 922e0f0487d459fccb59347913c43684d74d6f47 — invitation validation fails closed for revoked codes and one-time claim excludes revoked rows.
- 89c5f7a52fa803d230ca8688e517a9329fadcbd4 — owner/admin invitation revocation endpoint is atomic and audited.
- bb4a63213f91e4bd7d678f09585a1def3b741479 / 6d2fc0ceb741276ff3eecc1a231f8deda44801b1 — regression coverage for revoked invitations and the route contract.
- d97bbc76637f3ac53907f45f74235ef1d7d10fe9, 2e168eaa2e6a0c9f3e5d37a0ce4605525adeb446, 26187d98e685e987a8d6c2d336d211a8cc1a4285, f98a12a257948f099cce866150101fc674e1d7d0, a7f3c5ae8bfa85ee512a3570a227714baab2e8e1 — frontend exposes invitation revoke and branch staff enable/disable controls.

### Verification
- Source-level regression contracts were added for the negative authorization matrix.
- Full CI/E2E has not yet been run against this current HEAD; release status remains UNVERIFIED.
- The execution plan now records the completed cross-tenant, cross-branch, expired/revoked-invitation and disabled-staff controls, while the required isolated E2E release matrix remains open.

### Next action
- Run the actual isolated business-owner lifecycle for Diagnostic Center, Medical Laboratory and Dental Laboratory, then close the remaining Finance Hub transparency/economics verification gaps. Do not mark those lifecycle items complete without test evidence.


## 2026-09-20 — Partner operational lifecycle contracts and economics matrix

### Implemented
- `6fc22e8b815b0c1411ef1636c9ad8ea146fd43f9` — Dental Laboratory now enforces a canonical status transition graph; direct invalid jumps are rejected while same-status updates remain idempotent. The graph preserves remake/delay/cancel semantics and only the existing `delivered` transition can trigger settlement.
- `691060e49ff17e2ac40d7fd17b289a9288f7fbb0` — regression coverage for the complete dental-lab production path, remake, delayed, cancelled and idempotent transitions.
- `a85b0b3e9424076604ace70a8ce6098de927017b` — Medical Laboratory exposes the canonical lifecycle validator and rejects invalid status jumps.
- `b3852c71d87440422412196983d866b5d3ff0ca4` — regression coverage for draft → ordered → specimen collected → received → processing → result ready → verified, cancellation boundaries and reprocessing.
- `2325a1071d6d45689669bde4a5a6a4d5af6de582` — partner economics contract matrix covers all three operational verticals, gross/payout/commission conservation, cost-to-margin behavior and historical economics rule versions.

### Verification
- These are source-level lifecycle/economics regression contracts. They have not yet been executed in CI against the current HEAD.
- Business-owner E2E remains open: registration → onboarding → branch/staff → operational workflow → settlement → Finance Hub must still be run for each partner type.

### Next action
- Execute the full business-owner E2E matrix and repair failures from actual evidence. Then verify Finance Hub reconciliation/transparency against settled Diagnostic 3D, Medical Analysis and Dental Lab operations before marking lifecycle items complete.


## 2026-09-20 — Finance Hub durable transparency/dashboard block

- `ab9ddc36f1aafd3c9c8df9ae781d9e34480bb354` — added durable partner-economics dashboard aggregation by vertical with gross, commission, partner payout, costs, contribution margin and margin bps.
- `4f69c0c3b36fa73400d34c3dfcdb71fe6c2812fb` — exposed `GET /finance/partner-economics/dashboard`, backed by immutable transaction metadata/transparency rows and existing branch/partner/date filters.
- `e85a3dd112acbd4e85b387b4b3e1a4859d644844` — regression coverage for discrepancy, low-margin and loss alerts.
- `5dbf754ee110ae62cdbb27f32f3da4f19fa7ff9e` — execution plan updated for the durable transparency/alert aggregation controls.

Verification remains UNVERIFIED until the current HEAD passes the actual CI/E2E matrix. Remaining plan items include accepted→paid→settled concurrency tests, historical-rule verification at the ledger boundary, payout automation, refunds/cancellations/partial fulfillment where supported, scheduled reconciliation, full partner-type business-owner E2E, UI workflow audit, Android release verification, and production-readiness evidence.


## 2026-09-20 — Durable economics concurrency, history and reconciliation hardening

### Implemented
- `861d55c5cb9a95386d08657f317c19b97d84a681` — fixed the dental-lab status route so the persisted order is loaded before transition validation; invalid transition checks can no longer reference an uninitialized variable.
- `98ab8839257f54ff9da7be730e09cb88ff6f11ce` — ledger reconciliation now verifies that every partner-economics transaction carries an intact immutable economics rule/version snapshot, in addition to balanced ledger amounts and payout/commission snapshot equality.
- `d3daef47e8973a2c7db7f989a1f02e6ce2a96e86` — regression tests cover missing/malformed versus complete historical rule snapshots at the ledger boundary.
- `faeb159a28b47f69a40db1a3987a85768cfdea26` — accepted → paid → settled concurrency test now couples the atomic payment claim to the settlement side effect and proves only one concurrent confirmation records partner economics.
- `ec0eb046f33b68abc7642363ca590c3e87c610c3` — added a scheduled partner-economics reconciliation job with a durable job lock and 24-hour scan window.
- `ab5cdb87fed3546e1d1bc71b3acf690b7e049420` — starts the reconciliation job with the existing backend cron intervals.

### Verification
- Current HEAD has no GitHub Actions workflow run exposed by the connected status surface.
- Combined status for the latest test commit is not green; Vercel reports a `build-rate-limit` failure.
- Local execution was not possible in this session because the runtime cannot resolve `github.com` for a repository clone.
- Therefore these new tests and the release gates remain **UNVERIFIED** until CI executes against the current HEAD.

### Remaining plan
- payout readiness/automation and partner payout status;
- refunds/cancellations/partial fulfillment where the domain model supports them;
- full partner-type business-owner E2E;
- Finance Hub partner workflow verification;
- real browser workflow/outcome audit;
- Android release verification;
- security/permissions/audit matrix completion;
- production readiness and rollback evidence.


## 2026-09-20 — Payout readiness and concurrency hardening

### Implemented
- `6cc2c839f308381e5d9b25c921ebc1be8915ca67` — payout requests and payout transitions now use PostgreSQL transaction-scoped advisory locks. Concurrent requests for the same wallet cannot reserve the same available balance, and concurrent `approved → paid` transitions cannot post the payout ledger twice.
- `4cebbea08710d41dc5d2d96414034dc0271c725a` — regression coverage verifies both payout lock boundaries.
- `3efd139d234d767d1745b143669b4bba4b3147ac` — added automated payout-readiness scanning for lecturer/supplier wallets.
- `2fdf0d5d7056538ebc5374a41d78956e24be6292` — readiness notifications are deduplicated to at most one per user per 24 hours.
- `38538f6a3776b724a825bfdc0d44d8710e4e650` — starts payout-readiness automation with the existing backend job infrastructure.
- `e737408964807cb326a06ce3c97417c10ffdcd26` — execution plan marks automated payout readiness/notifications complete.

### Verification
Current connected GitHub status has not produced a CI workflow run for these direct main commits. Release verification remains **UNVERIFIED**; no test pass is claimed until actual CI/E2E evidence is available.

### Remaining
- refund/cancellation/partial-fulfillment behavior where the domain model supports a real reversal;
- full partner-type business-owner lifecycle E2E;
- Finance Hub end-to-end outcome verification;
- broader UI/browser workflow audit;
- Android release verification;
- full role/security/audit matrix;
- production readiness and rollback evidence.


## 2026-09-20 — Durable payment refunds: full and partial reversal

### Implemented
- `3cf71a78a8de54d61555a137fdb6cc1aa67a23e2` — added the Finance Core-backed payment refund service.
- `6f752ff57f78d81724b7d3bbdcf22f80669a6861` / `de481664ac49c72796a6ff8871691255ef3eba61` — added authenticated `POST /api/payments/:id/refund` with ownership checks, mandatory idempotency key, full/partial amount validation and audit event.
- `33013b858c22bb765eef2448d9ff2272372e4a95` / `ae380b1ca68ddb8ce20d1f5135e22891b1947d14` — hardened exact ledger reversal, currency preservation and idempotency error classification.
- `959fa3c2af02e2d6ad1be71b3d38c1bfcfff19e4` — added service-level regression coverage for opposite ledger directions, partial refunds, idempotency replay, over-refund rejection, lock ordering and fail-closed unsupported domains.
- `795f67db813a796a8eeb0d9c10d45a01b5911e8e` — updated payment E2E coverage from the previous expected 404 to real full/partial refund behavior.

### Financial contract
- Refunds are transaction-scoped and protected by a PostgreSQL advisory lock per payment.
- A refund creates a durable `refund` transaction with the opposite ledger directions of the original Finance Core sale.
- Full refund changes payment status to `refunded`; partial refund keeps it `paid` until the full original payment amount has been refunded.
- Replaying the same `Idempotency-Key` returns the existing reversal instead of creating a second one.
- If a payment has no supported durable Finance Core transaction, the operation fails closed with no wallet mutation.
- Cancellation/partial fulfillment/discount/tax-specific reversal rules remain separate backlog items because the current domain models do not provide a single authoritative financial reversal contract for all of them.

### Verification
- Unit and E2E regression contracts are committed.
- Current GitHub workflow surface for the latest direct-main commit has not exposed a CI run; combined status reports Vercel `build-rate-limit` failure. Therefore this block is **UNVERIFIED**. No CI pass is claimed.

### Next action
- Execute the three partner business-owner E2E journeys against an isolated environment and repair actual failures.
- Then verify Finance Hub rows against the same settled operations and close the remaining partner dashboard visibility gaps.


## 2026-09-20 — Partner Economics dashboard payout visibility

### Implemented
- `acc73602d424de28809f752ad3c8086e8b62f23d` — durable Partner Economics transparency rows now resolve the latest PARTNER-wallet payout id/status/amount without recomputing historical economics.
- `160b41ecf257b05785422f115e317d9b98e522f4` — regression coverage verifies payout status and amount are exposed by the transparency read model.
- `e170323f97f779f469494c5d30e5d24e7c2fc92a` — Finance/BI Partner Economics UI now displays gross, commission, costs/deductions, partner net payout, payout status/amount and immutable economics version.

### Verification
- Source-level regression coverage is committed.
- Current CI/release verification remains **UNVERIFIED**; the connected GitHub status surface has not produced a workflow run for the newer direct-main commits.

### Next action
- Execute/verify the isolated partner owner journeys and connect the resulting operations to Finance Hub end-to-end evidence.


## 2026-09-20 — Payout readiness regression coverage

### Implemented
- `e87f99690306240d7a73bfe1650b4bf2478f39d4` — added regression coverage for lecturer/supplier payout-readiness notification, open-payout suppression, 24-hour notification deduplication and durable job-lock invocation.

### Verification
- Test contract is committed but has not been executed in the repository CI surface. Current release verification remains **UNVERIFIED**.


## 2026-09-20 — Refund reversal hardened for multi-supplier orders

- `b61bbf47c7cb4e1fc46d29b033b16379c1a2fcca` — refund allocation now reverses all durable Finance Core sale transactions belonging to an order, not only the first supplier transaction; allocations preserve exact double-entry balance.
- `85ce2d7204ba60b8172372e57c946ee44d3a2d61` — updated refund service tests for the multi-transaction read path.

Verification remains **UNVERIFIED** pending actual CI execution.


## 2026-09-20 — Partner operational lifecycle E2E

### Implemented
- `abd966fd99e878d056ab1b93292ee0d9cf5cf577` — added isolated Playwright partner lifecycle suite with real diagnostic-center and medical-laboratory API workflows.
- `830fdaf2304cecdeea9672235aaee9d8c06279f1` — extended dental-lab E2E coverage for delayed/remake boundaries and premature-delivery rejection.
- `f232a9a8ddcd2af658a1be91f27049e6b891d753` — browser onboarding now verifies partner registration forms actually invoke the registration API, not only render a success state.
- `d1343223b37ef8cbef8c3b3f606654417d0bf5dd` — corrected diagnostic economics recognition to remain at the canonical paid-settlement boundary; no duplicate early financial recognition was retained.

### Covered operational journeys
- Diagnostic Center: create referral → SENT → ACCEPTED → IN_PROGRESS → COMPLETED → result-signing/clinic visibility contract.
- Medical Laboratory: create order → ordered → sample_collected → received → processing → result_ready → verified → interpretation/read-back.
- Dental Laboratory: existing full delivery path plus delayed/remake boundary and premature delivery rejection.
- Partner registration forms: diagnostic center / medical laboratory / dental laboratory requests verified against the real POST endpoint.

### Verification
- The new suites are committed.
- They have not yet been executed by a repository CI workflow; release status therefore remains **UNVERIFIED**.


## 2026-09-20 — Finance Hub partner economics E2E gate

### Implemented
- `2705ea74a66ccc121ca1b630f7ed0747d86b9dee` — added isolated Finance Hub E2E coverage for durable partner economics dashboard, reconciliation and transparency endpoints, including finance authorization and invalid-period fail-closed behavior.
- `26ae7d1a749394c24d72130eaa6575aca0059920` — synchronized the execution plan with the now-implemented durable partner economics visibility requirements and partner lifecycle evidence.

### Verification status
- The Finance Hub suite is committed but requires execution against the isolated E2E environment.
- No new CI success is claimed for this commit.
- Production deployment evidence previously reached READY, but repository release verification remains gated until the current main tip has a corresponding workflow/browser result.

### Next
- Execute the complete critical workflow/browser matrix.
- Close AI first-load functional flow, navigation duplication, loading/error/accessibility states.
- Complete Android build/release verification and final rollback/security gate.


## 2026-09-20 — AI first-load functional gate

### Implemented
- `34881771359248232f0200c5e965a8fb4c2af98d` — AI Workspace now surfaces first-action execution failures in an explicit alert instead of silently dropping rejected AI actions.
- `9010c2ab174f776e708aaaf7f27397d3cf5a4dfd` — authenticated first-run shell now routes the root landing state into the real `/ai` workspace immediately; the 15-second shell animation remains a navigation treatment, not the only functional outcome.

### Verification
- Source changes are committed.
- Browser execution against the current main tip remains required before marking the UX gate verified.


## 2026-09-20 — Release hardening coverage expansion

### Implemented
- `a686367e4dd637d8a6ffa3e2c916eb87e5bc5ac6` — owner branch workspace persistence E2E: create branch → open workspace → reload without falling back to login.
- `e066d0f012318b666ab42d287c0af0b9e631cfca` — execution plan synchronized with completed UX/CRUD/security coverage.

### Coverage now present
- Real owner/staff/branch CRUD persistence journeys.
- Partner onboarding and partner operational lifecycle journeys.
- Finance Hub durable economics read-model verification.
- AI first-load functional routing and first-action error visibility.
- Browser runtime/console/request-failure instrumentation on critical owner workflows.
- Accessible naming and mobile overflow checks in the browser UX suite.
- Cross-tenant/cross-branch/unauthorized/revoked invitation negative paths.
- Audit/idempotency boundaries for privileged branch and invitation mutations.

### Remaining release gates
- Current main-tip CI/browser execution evidence.
- Duplicate navigation/IA cleanup audit.
- Broad core clinical workflow outcome verification.
- Android build/release evidence.
- Final security matrix execution.
- Production readiness and rollback evidence.

No unexecuted test is marked as passed.


## 2026-09-20 — Automated economics + core clinical workflow

### Implemented
- `601b61a75f9c7f9ed321c270d319dba3a78bf959` — added E2E core clinical journey:
  - create patient;
  - create treatment case;
  - schedule appointment;
  - close completed visit;
  - read patient summary;
  - reopen canonical treatment case.
- `f42de1c22beec175ab4921dd67c681fabaffb80a` — execution plan updated for supported automated economics settlement boundaries and supported full/partial refund/cancellation behavior.

### Economics boundary audit
- Medical analysis: payment confirmation derives server-side order price snapshot and settles Partner Economics atomically.
- Dental laboratory: economics settles only at canonical `delivered` boundary.
- Diagnostics: economics remains at paid settlement boundary; legacy mutable platform fee is not the source of truth.
- Refunds: full and partial refunds reverse existing Finance Core ledger entries atomically; unsupported domains fail closed.

### Verification
- New clinical E2E is committed.
- Current main tip is `601b61a75f9c7f9ed321c270d319dba3a78bf959`.
- The available GitHub Actions history currently exposes successful historical Quality Gate runs, but no corresponding current-tip run is available yet; therefore current-tip release verification remains **UNVERIFIED**.


## 2026-09-20 — Clinical + ecosystem workflow coverage

### Implemented
- `47a3cb9c2fd40cb09c2284545d0e07a6509a231a` — extended patient workflow E2E with canonical odontogram persistence:
  - patient creation;
  - tooth 16 caries + M/O surface findings;
  - canonical patient PATCH;
  - read-back verification of status and surfaces.
- `b4e4ea4b60eee8dfdab5aa6194f1173ec43199dc` — execution plan synchronized with the implemented clinical/ecosystem workflow coverage.

### Existing coverage confirmed
- Treatment plans: create/read/update/delete, status lifecycle, stage pricing, tenant isolation and doctor authoring.
- Diagnostics: referral/result lifecycle.
- Medical and dental laboratories: canonical lifecycle transitions.
- Marketplace: catalog, orders, server-side price protection, stock/idempotency.
- Academy: catalog, enrollment, progress, completion/certificate, duplicate enrollment.
- Finance Hub: durable partner economics.
- Partner onboarding: registration + organization/branch lifecycle.

### Release gate
Current main-tip execution is still not marked PASS until CI/browser execution produces fresh evidence.


## 2026-09-20 — Security matrix + current release execution gate

### Implemented
- `0384cc71e2ae0fee35bf87bd25bd0c0b51fb2f5b` — AI security regression coverage for supplier isolation and unresolved clinic scope.
- `c615a0f5a80d9cb510633bd965537fc86d99e1ce` / `20906f4900e868d974cbd7deb6e59f169b65b94a` / `37847ed385f1728ebaf8b4092b1d70115202858e` — production PHI encryption fail-closed guard and regression test.
- `a70e9289f6eed6f0cee6c769f190014c9cde8596` / `6d4d4a4f381fbcd13e2821c085fdf4cf05d4c05f` / `eac36b5b02306d5f9ca94ab1f705dd3bbfe10990` / `a7322fbcb0e7f3961eea389b341e09e845c25c4b` — durable billing prepayment consumption and idempotent invoice/prepayment reversals.
- `94de0df669f714afcc8c8e05dbd74498e5215d68` / `f767d9685a6e62760e53040a0a947188657c8eb7` / `a4e4ad3eca3dcf268c53e7a67c4f93a5afbb677b` — canonical navigation/design-system contract and duplicate sidebar collapse.

### Verification
The repository contains the required CI, Playwright, Android and security suites, but current direct-main changes still require fresh execution evidence. No unexecuted suite is marked PASS.

### Next action
Run the current main-tip release matrix against an isolated environment; then resolve only actual failures before production/rollback sign-off.


## 2026-09-20 — Current main release-gate execution evidence

### Verified against GitHub Actions
- Commit `e9f8f41d3a3cd0ef8cf20b58a2ca2443a2cdf906` passed CI run #2728 (all jobs green).
- Browser UX coverage passed in the current-tip CI run.
- Business-owner journeys passed in the current-tip CI run.
- Organization-owner lifecycle passed after aligning ORG-007 with the canonical IA routes; all 8 organization-owner tests passed.
- Official Playwright CLI installation, agent skills installation and CLI browser smoke all passed.
- Quality Gate for the immediately preceding release-verification trigger commit `368781ea8756dc2aaef12e3b3903ce57e78a1277` passed.
- Android workflow run #168 passed on `368781ea8756dc2aaef12e3b3903ce57e78a1277`; preview APK artifact `dentvision-preview-apk` was published (13,429,489 bytes). This commit changes only Android workflow documentation; application code is identical to the current web release candidate.
- Vercel production deployment for `e9f8f41d3a3cd0ef8cf20b58a2ca2443a2cdf906` is READY: `dpl_sE2V5TQ6CoN1UcG4YTVDJjUaVkoe`. Production HTML fetch returned HTTP 200 and no runtime errors were reported for the last hour.

### Defect repaired from actual release evidence
- ORG-007 was asserting obsolete routes (`/crm/appointments`, `/crm/lab-orders`, `/crm/diagnostics`, `/finance`) that are not part of the canonical route contract. The test now exercises `/crm/schedule`, `/crm/lab`, `/diagnostics`, `/crm/cashier`, `/bi` and other canonical management surfaces.

### Remaining release gates
- Production interactive browser authentication/smoke still requires a connected browser session; Vercel HTML fetch and GitHub CI browser smoke are green, but an interactive production login has not been independently executed in this session.
- Physical Android device installation evidence is not yet captured; hosted APK build is green.
- Production rollback execution evidence is not yet captured; the current Vercel deployment is marked as a rollback candidate, but no rollback action has been executed.

### Next action
- Capture production interactive login/navigation evidence and rollback execution using an available connected browser/Vercel control surface, then update the release plan only after those actions are actually verified.

## 2026-09-20 — Multi-role + responsive design release gate

### Implemented
- `7cf54b7e5061f01909556547d7754924e9495f38` — added a dedicated role/context design gate covering owner, admin, doctor, assistant, manager and regular user journeys.
- The gate verifies role greeting/identity coherence, visible shell identity, absence of visible emoji glyphs, accessible naming, interactive target sizing, clipping, horizontal overflow, runtime/page errors and failed requests across the authenticated context routes.
- `6516408091545d374021822eb45404d796fb5adf` — added dedicated desktop and mobile role-gate projects at 1440×900 and Pixel 7/390×844.
- `6f3cf81855b7dac7a3f88edf8dbba0f97f9bd3b6` — CI now executes the full responsive matrix (PC, laptop, tablet, Android and iPhone/Safari) plus the multi-role design/context gate.

### Release intent
The design gate is no longer a single-role/mobile check. It treats role, identity, navigation, context continuity and responsive layout as one release surface. A role-specific failure blocks the gate rather than being treated as a cosmetic observation.

### Verification status
- Implementation committed.
- Fresh CI execution for these commits is required before marking the gate PASS.
- No visual/design pass is considered complete from screenshots alone; automated geometry, accessibility naming, runtime/network and role-context assertions are part of the gate.

### Next action
Run the new CI gates against the exact main tip, inspect every failed role/device case, fix real defects, and rerun until the release matrix is green. Do not weaken assertions to make the gate pass.


## 2026-09-20 — Patient role/context hardening

### Implemented
- `6e5b6c81e73e32d3a58c9e1ad87ca4fd0474164c` — added PATIENT to the canonical Prisma UserRole enum.
- `8b8905e6f2fe4c5895ced80d94501f27fdce87c1` — added a narrow patient IAM permission baseline: profile self-service plus marketplace/academy/diagnostics discovery; no clinic CRM, billing, inventory, lab or staff permissions.
- `9fab7426ca5cf1c4a85b44af343fa75b34e52271` / `32bf2e3c852511b9d188d617cf0769d6839fb8ad` — added a deterministic demo patient account and linked it to a real seeded Patient row without making the patient a ClinicMember.
- `1dd3b77973b7750f48b90b99e85cef0ea5919b23` — added the Пациент frontend identity/navigation context.
- `19f96dc4948685a9684c11d3cd30a6131b40737a` — patient authentication now lands in the patient portal instead of the clinic AI workspace.
- `94b10586d9d45edeb26561d8b9ea984b6459fcf6` / `fe92c07441c8216d1ea7d74dadb3ec31c1e32ea7` — extended the role/context design gate with patient portal, consent-gate, visible patient sections and negative privileged-route checks.
- `e69d7ba99570737179e26e8e2a691a48bd600f83` — synchronized the master execution plan with the patient experience release matrix.

### Verification status
Implementation is committed. Fresh CI execution is still required; no patient role/device gate is marked PASS until the current main tip produces actual browser and CI evidence.

### Next action
Run the complete role/context matrix across responsive devices, inspect every failure, and then continue the same treatment for diagnostic-center, medical-laboratory and dental-laboratory owner/employee organization contexts using their canonical Organization/Person role model rather than inventing clinic UserRole values.


## 2026-09-20 — Patient + partner organization role isolation hardening

### Implemented
- `362e899c1f58d96a2442279fd574d7ffc0d60ad1` — deterministic E2E patient identity `patient@dentvision.kz` is seeded as PATIENT, linked to a real Patient row in E2E Clinic A, with appointment and visit fixtures; the patient is not a ClinicMember.
- `b25083d09a88c2e722b7118dc4a8fc35c0a33537` — patient IAM no longer grants the internal diagnostics workspace; public diagnostics discovery remains outside the authenticated clinic workspace.
- `bc0d0fd2d2860c7a64ddbd96a52c0011505c5f7` — added scoped organization-role resolution for unified partner organizations.
- `addfcaa0d81a930ac436df9d319fe056a10157fa` / `1032bb2fc352b76e902b26b04ce976b89a69ed74` — login and session hydration now preserve the actual partner organization role instead of degrading it to STUDENT.
- `8ce36bdef57ca2f656770929ef2f8c3d7c1b0103` / `f90cd6a33d14d7ee9968f1d5e8282c4a52005ed2` — auth responses now expose scoped organization context and effective role to the frontend.
- `9443371ef84bd25698e34db48da727d648818969` / `f4da2f2424f6de169ced5b1dfaad33c7b6b0a6d3` — added isolated E2E identities and Organization/PersonRole fixtures for diagnostic-center owner/operator, medical-laboratory owner/technician and dental-laboratory owner/technician.
- `861d1b1e467a4b8dab423edc3ef6c5447f2c0e0b` — partner and patient navigation is now derived from context-specific page sets, preventing clinic medical/billing/staff pages from leaking into partner workspaces or patient sessions.
- `080c3bcfa5ba5aeec6804ab461db53716cb59356` / `3fe676d506ddef419fdcf10edfa1dd0f37453e43` / `f6ce8423c7eb3d52247099af0c9565f3b366b3d9` — patient sessions are isolated from the clinic shell on internal routes; patient sidebar surfaces are limited to patient-safe marketplace/academy/profile contexts and clinic command search is hidden.
- `b236ab50f66cd588e1f5675c6b426f203c73a497` — login routes diagnostic-center, medical-lab and dental-lab users directly into their operational workspace instead of the generic clinic AI entry.
- `647ef97b2bedce3fdca2b3334742fde9da5bc5ad` — context card displays the actual scoped partner role rather than the compatibility STUDENT identity.
- `7827c5b9e7d0504158502ddefbc11445d285bcd4` / `b566d5b5e2d00c0f37abae196b6253796a9261fe` — role/context design gate now includes partner owner/employee contexts and clinic-workspace negative paths.
- `f8942b7bf6563a8d9ccb01f88113e7b1bf9d43e3` / `70419b0c4d2642397069c0d2c2d833a22ab98cef` — role/context design gate expanded to all eight supported responsive device classes: 1280 desktop, 1440 laptop, 1920 desktop, 768 tablet, 820 tablet, 390 Android, 412 Android and iPhone/WebKit.

### Verification status
Implementation is committed. The latest commit is awaiting GitHub Actions indexing/execution; no new role/device matrix is marked PASS yet. Existing release evidence remains valid only for the commits already executed by CI.

### Next action
Run the exact current main-tip CI role/device matrix. Treat every failed role/device/context combination as a real defect, fix it in source, and rerun until the gate is green. Then continue with the remaining partner registration → organization → branch → staff → permissions lifecycle evidence and final production/rollback gates.


### Follow-up context identity fix
- `b546c0110a078af55ebe015f4b2cca42807673ba` / `49598ebeaca53ef957f63a6570743d98bbcad022` — scoped auth context now carries the partner organization name.
- `e52bc2eb56c300bad99f2e9dd4f4fd90b2c90737` / `adedafaf29b76ae046c5c43af1348be0e1822097` / `97cbbdd0a9b90dedf972440eac870fd242518114` — login/session hydration and frontend user typing preserve the organization name so partner greetings/context cards cannot fall back to a generic personal context.
- Latest verification remains pending fresh CI execution; no new role/device result is marked PASS before the gate runs.


### 2026-09-20 — Exhaustive route/security gate expansion
- `9ad49e051356ee6b88747592a96bfdf436e64625` — role gate replaced sampled critical-route coverage with a declared application route inventory for every represented E2E role; unauthorized routes are asserted to leave the requested URL rather than merely rendering a generic page.
- `cdb79b8f103b6e9439442c379562d6a63e84c616` — removed the discovered-route sampling cap and added HTTP 5xx collection, so every same-origin route discovered from each allowed screen is also audited.
- `8b6c6c500a6facbcaaf1b98e2a6360b140c97266` — dynamic CRM/diagnostic route IDs are normalized to their parent permission domain; allowed screens are additionally checked after reload and browser history back/forward navigation.
- The gate now checks role identity, context contamination, application/chunk errors, horizontal overflow, clipped text, interactive target size, accessible names, form-control identification, runtime console/page errors, failed requests, HTTP 5xx responses, protected-route behavior for anonymous users, cross-tenant Clinic A/B isolation, storage token/password leakage, discovered internal links, and post-login entry workspace.
- Fresh CI execution is still required; no new exhaustive matrix is marked PASS until GitHub Actions provides evidence.

- `bb0e42d1f53817ee22172fa53271e01ebe11614d` / `9df80f2f94d1ba1e872d5dea7044a602713fc658` — platform governance/support screens (`quality`, `platform-finance`, `ai-governance`, `support`, `security`) are included in the route inventory and authorization mapping.
- `b5b3ad21a2450dcbf8ee5b7758cbb4267326267d` / `0c7090953297201561a265c4c9a4793c7b2517b7` — deterministic E2E support and laboratory identities were added to extend role coverage beyond the initial clinic/partner set.


### 2026-09-20 — Visual/interaction design audit expansion
- `fc05d46b190b358ac88dd0899a2bab48525d633a` — role gate now inspects visible dialogs, menus and listboxes: semantic heading/content, close control, accessible names, internal overflow, and Escape dismissal without unintended navigation.
- `4e9783bbb84170b96082e24c9b3ebec81462f050` — every audited screen now requires meaningful visible content and information hierarchy; unexplained icon-only interactive controls are rejected.
- `4a7b194bb790f8b75431b8d4b9a67cc62894b073` — duplicate control-label detection was added as an additional UI ambiguity signal.
- This complements geometry/accessibility/runtime/security checks; visual screenshots remain evidence for human review, while deterministic assertions catch objective layout and interaction defects.

### 2026-09-20 — Full design/role release gate launch
- Main tip: `c569642745edfca058c4c83640f6041727237548`.
- Launch requested for the complete CI matrix: core E2E, browser UX, responsive design, role/context design across declared roles and viewports, business-owner journeys, organization-owner lifecycle, and Playwright CLI smoke.
- PASS is not recorded until GitHub Actions returns fresh evidence for this main-tip run.


## 2026-09-20 — Full role/responsive design gate launched
- `c569642745edfca058c4c83640f6041727237548` is the current main tip.
- The CI workflow contains the full role/context responsive matrix: 1280, 1440, 1920, 768 tablet, 820 tablet, 390 Android, 412 Android and iPhone/WebKit.
- The role gate is intended to exercise every declared and discovered route for each supported identity, including patient and diagnostic/medical/dental laboratory contexts, plus modal/menu semantics, visual hierarchy, accessible naming, geometry, runtime/network/5xx failures, authorization and tenant isolation.
- A fresh workflow run is required; no PASS is claimed until GitHub Actions reports the exact current-tip result.
- Next action: execute the current main-tip CI gate and repair every real failure without weakening assertions.


## 2026-09-21 — Visual Release Gate evidence hardening
- Fixed the release-gate evidence architecture so sequential Playwright suites no longer overwrite one shared `e2e/test-results` directory.
- Playwright runtime output is now isolated by `PLAYWRIGHT_OUTPUT_DIR`; HTML reports are isolated by `PLAYWRIGHT_HTML_OUTPUT_DIR`.
- Visual screenshots are stored outside Playwright's disposable output lifecycle under `e2e/visual-evidence/`, with responsive and role/context evidence separated.
- Screenshot capture is now enabled for successful and failed Playwright tests.
- Added `quality-scripts/visual-release-gate.ts` to validate PNG integrity, required responsive projects, all role/device combinations, and generate `visual-manifest.json`.
- CI validates the visual evidence even when an earlier gate fails and uploads the complete evidence tree.
- Verification principle: screenshots are treated as product/design evidence, not merely failure artifacts; visual review must apply the Product DNA world-class bar and 5-Why root-cause analysis to suspicious UI findings.


## 2026-09-21 — Visual Agent: eyes + hands across the full ecosystem role matrix

### Implemented
- `54d654aded533b0824286adfe45235035530e1f7` / `7e16bb95f5313509cf2aefdd401451b05a2cf23a` — added `e2e/tests/visual-agent.spec.ts`, a browser agent layer that actively observes and interacts with authenticated product contexts instead of waiting only for assertion failures.
- The Visual Agent captures durable screenshots, DOM text, HTML snapshots, geometry/control maps and runtime/network error evidence before and after interaction, hover, scroll and navigation restoration.
- The matrix covers every currently represented ecosystem identity: clinic owner/admin/doctor/assistant/manager, regular/student, patient, diagnostic-center owner/operator, medical-laboratory owner/technician, dental-laboratory owner/technician, superadmin, support and laboratory.
- `2d0e12ee38d84c817c8f0062b045729ff2396778` — registered a dedicated Playwright Visual Agent project.
- `93925a9a912825e71a18f67883c3d2c21cbf1eaa` — CI now executes the Visual Agent after the role/context gate and before business-owner lifecycle verification.
- `4a171e8282e3924f1891653d81bc996c1d007f48` — visual release integrity now requires Visual Agent evidence for every role at desktop 1440, tablet 820 and mobile 390, in addition to the existing exhaustive role/device evidence.

### Verification principle
The existing role gate remains the exhaustive route/security/geometry contract. The Visual Agent is complementary: it supplies active visual/interaction evidence and temporal before→action→after states. A screenshot is never treated as proof of correctness by itself; runtime, DOM, interaction and authorization checks remain authoritative.

### Next action
Run the exact current main-tip CI. Inspect the generated Visual Agent evidence for every role/context and fix real visual/interaction defects using 5-Why root-cause analysis. Do not weaken the role matrix to obtain a green result.


## 2026-09-21 — Responsive gate correction from tablet-768 evidence

- CI run #2901 exposed two concrete tablet-768 findings: a fractional 35px rendered hitbox for a `Close` control and a `Расписание` tab reported as clipped inside an intentionally horizontally scrollable tab strip.
- Root cause for the first was the assertion rounding a fractional browser layout box with `Math.round`, turning a nominal 36px control into a false 35px failure. The audit now uses `Math.ceil` for hitbox dimensions so subpixel rendering is not misclassified.
- Root cause for the second was the generic clipping detector treating intentional `overflow-x-auto` tab navigation as a defect. The detector now excludes controls inside explicitly horizontal-scrollable containers while preserving clipping checks elsewhere.
- Commit: `7ab23572070c851702340987494a383e90055bc7`.
- The fix is intentionally limited to the test's measurement model; it does not weaken the 36px requirement or disable clipping detection globally.


## 2026-09-22 — Visual Agent diagnostics/laboratory runtime defect: parameter binding

### Root cause
- Fresh Visual Agent evidence from CI run 35652954202 showed repeated 403/500 responses for diagnostic-center and medical/dental laboratory contexts.
- Backend PostgreSQL logs identified the concrete source: medicalLab.routes.ts built dynamic SQL predicates with numeric interpolation (o."labId" = 1, o."clinicId" = 1, and ANY(2::text[])) instead of positional bind placeholders. PostgreSQL therefore compared text columns against integers, producing 42883 operator does not exist: text = integer and cascading HTTP failures.

### Implemented
- 4bc15a0468c7dd815fee570cb62286dfab55fc67 — corrected all three dynamic medical-lab list predicates to use $n bind placeholders, preserving parameterized SQL and the existing authorization model.
- 97090428577393b15fa96fcd256df31e12c59f31 — removed the duplicate diagnostics workspace context bridge; the canonical outer diagnostics layout remains responsible for the context card.
- 0d5c703dc401c279464a8391409b5b16edaf4682 — added human-readable ecosystem role labels, including medical-lab-tech → Лаборант, so role identity is explicit in the design gate.

### Verification status
- Quality Gate run 3477 for 0d5c703dc401c279464a8391409b5b16edaf4682 passed.
- CI run 2983 for the same commit is still executing its Visual Agent job; the medical-lab SQL fix has now triggered the next CI run from commit 4bc15a0468c7dd815fee570cb62286dfab55fc67.

### Next action
- Wait for the current CI chain to finish, inspect fresh screenshots/DOM/runtime evidence rather than only test failures, then fix the next concrete defect and repeat until the full release gate is green.


## 2026-09-22 — Diagnostics/laboratory context and routing cleanup

### Implemented
- 5583f82674452671a2408f3ca7f4f1f523f51b8a — removed the duplicate EcosystemContextBridge from MedicalLabWorkspace; DiagnosticsLayout is the canonical owner of that context surface.
- 856fbec98e8d604c12f755e86553b519866db9f5 — removed the duplicate EcosystemContextBridge from DentalLabPlatform for the same canonical-layout rule.
- fdd9b9f8df5866eb3817c439b784411811788682 — medical-laboratory roles now resolve /diagnostics/lab to MedicalLabWorkspace by role, instead of falling through to the dental-laboratory production board. This removes the documented Medical Lab → Dental Lab semantic mismatch at the source.

### Verification status
- These fixes are committed to main and have triggered the current CI/Quality Gate chain. The latest run is queued; PASS is not claimed until the fresh role/device Visual Agent evidence completes.

### Next action
- Inspect the fresh visual-agent artifact for diagnostic center, medical lab and dental lab roles at desktop/tablet/mobile. Verify the old duplicate context, wrong lab subtitle/workspace and oversized empty states are gone in screenshots and DOM. Continue fixing any remaining concrete visual/runtime defect without weakening the release gates.


## 2026-09-22 — Responsive evidence stability

- Current mobile release-gate artifact exposed a real evidence-quality problem: several critical routes were captured as the global loading spinner at desktop/tablet widths because the gate waited only 400 ms after navigation.
- 63e30dc8155f62af13cd165ccb8aee6ca0d25f19 adds an explicit visual-readiness wait that rejects the full-screen loading shell before taking screenshots. This does not mask a permanent loading state: it times out if meaningful content never replaces the loader.
- Current CI still has a separate core E2E failure and a role/context gate failure; those are being investigated from their actual artifacts/logs rather than assumed to be visual-only.


## 2026-09-22 — Confirmed CTA contrast root cause from fresh responsive screenshot

- Fresh CI responsive evidence still showed `Новое направление` with a gold background and nearly-gold text, so the previous Button-level fix was not actually reaching the rendered primary button.
- Root cause was confirmed in `src/styles/dentvision-unified-theme.css`: the selector `[class*='text-dv-gold']` also matched the distinct class `text-dv-gold-on` and, with `!important`, overrode the intended dark-on-gold foreground.
-  a139ee7a6891228d358f9936b7f39f075bdd3519 changes the selector to the exact class-token form `[class~='text-dv-gold']`, preserving `text-dv-gold-on` and fixing primary-button contrast without changing the design token itself.


## 2026-09-22 — AI briefing markdown rendering regression

### Evidence
- Historical Visual/Design artifact showed the authenticated AI briefing rendering Markdown control characters literally, including **понедельник, 21 сентября**, **3** and **23**.
- Current AIWorkspaceIndex still rendered the briefing with plain whitespace-pre-line, while chat messages had a dedicated inline-Markdown renderer. The presentation defect therefore remained possible even after the chat renderer was improved.

### Implemented
- 316a18f0cf1f65b27a798fc165e820f489e907d1 — added a dedicated briefing renderer that converts the supported **bold** syntax to semantic emphasis and preserves line breaks instead of exposing Markdown delimiters to users.

### Verification status
- Code fix is committed.
- Fresh CI evidence for this exact commit is pending; no visual pass is claimed until the resulting CI artifact is inspected.

### Next action
- Verify the fresh AI screenshot in the full visual evidence artifact, then continue the old-PNG regression matrix for Diagnostics, Medical Laboratory, Dental Laboratory, Patient Portal, empty states, overlays and responsive layouts.

## 2026-09-26 — PR #287 release-gate auth/session hardening
- CI #3279 exposed a false partner-workspace brand assertion and a real owner `/settings` redirect-to-login in WebKit evidence.
- The partner assertion was corrected in `e2e/tests/role-design-gate.spec.ts` at commit `f9964b3` to validate rendered workspace content rather than require the literal DentVision brand.
- Root-cause review found a session-isolation defect in `src/utils/api.ts`: refresh tokens were copied to shared `localStorage`, while backend refresh rotates the session. Parallel browser contexts for the same user could therefore reuse and invalidate another context's refresh session.
- Fixed by keeping the access/refresh pair tab-scoped in `sessionStorage` and removing the legacy shared `dv_refresh` value. Commit: `8b285aee40acafd80f044b6de99d82e42d26ca39`.
- Verification required: fresh CI must prove owner `/settings`, all role/context gates, reload/back-forward persistence, and the existing cross-tenant/security checks. No release/merge conclusion is made before fresh evidence.



## 2026-09-26 — Master Spec v5 Organization/IAM reconciliation started
- PR #287 was merged to main at `e853e844b37d1410c7de9a9b28ac2f493c0370f`.
- Master Spec v5 reconciliation identified a concrete IAM mismatch: `PersonRole` stored `scopeType/scopeId` but uniqueness was only `personId + roleId`, preventing the same role from being assigned to the same person in multiple organizations.
- Started PR #288 on `refactor/master-spec-v5-organization-scope`.
- Added canonical `PersonRole.scopeKey` and changed uniqueness to `personId + roleId + scopeKey`.
- Added production migration `20260926120000_person_role_scope_key` that backfills scope keys before replacing the legacy unique index.
- Updated unified-schema and E2E permission seeding to use the scoped composite key.
- Added migration coverage.
- This is the first architectural correction in the Master Spec v5 reconciliation sequence; subsequent work must continue through Organization types, Branch/data scope, AI scope, Finance scope, and vertical cross-organization slices.
