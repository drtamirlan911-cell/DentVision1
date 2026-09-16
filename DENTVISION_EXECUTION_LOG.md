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
- Backend, frontend, database sync, seed, TypeScript, build, unit tests, backend lint and frontend lint all completed successfully in the same workflow run; the failure was isolated to the E2E test source syntax.

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
