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
