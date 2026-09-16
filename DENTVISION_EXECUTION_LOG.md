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

### Implemented
- `97e725f97f800aafd12d690d6ce80e7a95da9de1` repaired `e2e/tests/appointment.spec.ts`.
- The fix restores valid TypeScript syntax and aligns APPT-009 with the actual appointment list contract by using `from`/`to` instead of the unsupported `date` query parameter.
- APPT-009 now also asserts that both created appointments are present in the returned range, making the test verify the filtering contract rather than only HTTP 200.
- No production endpoint, permission, status mapping, or security check was weakened or bypassed.

### Verification status
- The correction is **UNVERIFIED** until a fresh GitHub Actions run executes against `97e725f97f800aafd12d690d6ce80e7a95da9de1`.
- Release remains **NOT READY**.

### Next action
1. Obtain the fresh workflow run for `97e725f97f800aafd12d690d6ce80e7a95da9de1` and inspect the E2E result.
2. If E2E passes, inspect browser UX, Business Owner, Organization Owner and quality/release gates.
3. If E2E fails, fix the exact failing contract without weakening assertions.
4. Continue the canonical P0 queue: auth fail-closed/session enforcement, IAM negative matrix, diagnostics confirmation contract, then P1 economics/partner lifecycle.

## 2026-09-15 — Appointment cascade root cause: patient branch SQL mismatch

### Investigation
- Playwright artifact from the failing appointment run showed `POST /api/patients` returning HTTP 500 before any appointment was created; APPT-001 through APPT-010 were downstream failures from the missing patient id.
- Current `Branch` schema/migration uses physical `branches.clinic_id`, `"isDefault"`, and `"createdAt"` columns.
- `patients.routes.ts` still used legacy `is_default` and `created_at` in the organization-owner fallback branch lookup. PostgreSQL therefore failed before patient creation and returned the generic patient-save error.

### Implemented
- `8a010c8922c5512c10eb7f5688f287d8c5d2d98c` changes only that raw SQL ordering to canonical `"isDefault"` / `"createdAt"` identifiers.
- Compare against the previous verified HEAD `d896537228850144c61dbdb63334396472c1d4e5` confirms exactly **1 file, 1 addition, 1 deletion**; no appointment, RBAC, or branch-isolation rule was weakened.

### Verification
- Fresh Quality Gate run: `34945380674` (run 2429), started against exact HEAD `8a010c8922c5512c10eb7f5688f287d8c5d2d98c`.
- Fresh CI run: `34945380673`, same HEAD.
- At log update time both runs were still in progress; release remains **NOT READY** until the complete fresh gates finish green.

### 2026-09-15 systemic branch-schema audit
- CI run `34999249118` confirmed database seed, backend startup, frontend startup, unit tests, TypeScript and both lint jobs all succeeded; only the E2E suite remained failing.
- Audit found a second latent production migration defect in `20260914090000_backfill_default_branch_scope/migration.sql`: it used legacy `is_default`, `created_at`, `patients.clinic_id`, `appointments.clinic_id`, and `clinic_members.clinic_id`. The physical schema uses `branches."isDefault"`, `branches."createdAt"`, `patients."clinicId"`, `appointments."clinicId"`, and `clinic_members."clinicId"` for those fields.
- `20260914100000_enforce_branch_consistency/migration.sql` contained the same class of mismatch for appointment trigger columns (`patient_id`, `clinic_id`), corrected to physical `"patientId"` and `"clinicId"` while retaining `branch_id`.
- Both migrations were corrected without changing the branch-isolation policy.
- The diagnostics service was audited against the route contract: the route already resolves and passes `branchId`, while the service create payload must persist that context. This remains the next targeted application-layer fix after preserving the last known-good source state.

### Implemented
- `6b0d0e435819d8e03853166ad0790b183998b693` — `fix(db): align branch backfill migration with physical columns`.
- `2c2525e6b69782e904d2ff0821cfc275bc08b607` — `fix(db): align appointment branch trigger with physical columns`.

### Release status
- **NOT READY.** The latest known E2E run predates these two migration corrections. No claim of green release is made until a fresh complete CI run verifies them.

## 2026-09-16 — Business-owner E2E and production migration audit

### CI evidence
- CI run `35012064060` on HEAD `5e650942b4f51ae11e0061102117ee269a1f7e0e` reached the complete core E2E suite: **204 passed, 4 skipped**.
- All core Academy, AI, API contract, appointments, auth, branch, clinical IDOR, diagnostics cross-module, diagnosis, double-submit, error-injection, inventory/tenant, lab, marketplace, payment, payout, finance, RBAC, patient and treatment-plan suites passed.
- The only failures were in the separate Business Owner journey gate: BIZ-006 and BIZ-007.
- BIZ-006 was a Playwright selector defect: the page had six `Редактировать` buttons and the intended one was inside `dialog[aria-label="Профиль сотрудника"]`. The production UI itself rendered the intended action.
- BIZ-007 exposed a real frontend/backend API contract mismatch: the frontend `createInvitation()` called `/api/auth/invitations`, while the canonical backend endpoint is `/api/clinics/:id/invite`.

### Implemented
- `e34fd165b0c54f86b37e197d72b5e1273e3f2f8` — scoped BIZ-006 profile actions to the employee profile dialog.
- `6fe493bc7d36d82d0b2662ccfb1556648aca7cb4` — added a fail-closed authenticated `/api/auth/invitations` compatibility endpoint with the same OWNER/ADMIN clinic authorization semantics as the canonical clinic invite endpoint.
- `97712d7a035810560f661e9349c29a37a10a9722` — corrected `20260914080000_organization_scoped_branches/migration.sql` to provision `clinic_members.branch_id`, matching Prisma `@map("branch_id")`, indexes and FK.
- `4741becb85bed432ede1049349c29a37a10a9722` — made `20260914090000_backfill_default_branch_scope/migration.sql` self-provision `patients.branch_id`, `appointments.branch_id`, and `clinic_members.branch_id` before backfill.
- `2174ac9257f3ae10beb4f8df92cb8d693cdf660d` — made referral branch migration self-provision `referrals.branch_id` before installing the consistency trigger.

### Additional audit findings
- Appointment and idempotency duplicate-key errors visible in the CI backend log are expected contention signals from the race-condition tests, not unhandled test failures; the E2E assertions passed.
- `npm ci` reports dependency vulnerabilities and a deprecated Multer 1.x package; this is recorded as a separate dependency-security workstream and is not being hidden by changing audit thresholds.
- PostgreSQL health-check logs show repeated `role "root" does not exist` probes from the runner/container health path; application health itself returned healthy and E2E proceeded normally.
- The branch schema has intentionally mixed physical naming: `branches.clinic_id` plus quoted camelCase `"isDefault"`/`"createdAt"`; operational records use quoted Prisma camelCase clinic/patient fields plus mapped `branch_id`. Raw SQL must continue using these physical identifiers explicitly.

### Verification
- New CI run `35052027294` was automatically triggered by the invitation compatibility fix and is currently executing against its resulting main HEAD. Its E2E seed path has already completed successfully on the new code path when this log section was recorded.
- Release remains **NOT READY** until this fresh run completes, including BIZ, organization-owner lifecycle, Playwright CLI smoke and Quality Gate.

### Next action
1. Inspect run `35052027294` to completion.
2. If BIZ passes, audit organization-owner lifecycle and release-gate failures next.
3. Keep production branch migrations and Prisma `@map("branch_id")` aligned.
4. Address dependency vulnerabilities/deprecations as a separate controlled upgrade after functional release gates are green.

## 2026-09-16 — RBAC-010 correction and full CI verification

### Implemented
- `844b469e084dd5acec6fb45f26d28757c27a3568` — corrected `RBAC-010` to assert that MANAGER is denied access to the superadmin `/api/admin/users` route with HTTP 403. The backend authorization contract was not weakened.

### Verification
- CI run `35066089223` executed against exact HEAD `844b469e084dd5acec6fb45f26d28757c27a3568`.
- `frontend-lint`: passed.
- `lint-test`: passed, including build, TypeScript, command-center audit and backend unit tests.
- `backend-lint`: passed.
- `e2e`: passed completely: E2E suite, browser UX coverage, Business Owner journeys, Organization Owner lifecycle release gate and official Playwright CLI browser smoke all completed successfully.

### Release status
- This CI run is fully green. The release gate is still not declared complete solely from this CI run because the master plan also requires the remaining lifecycle/security/economics work and a separate Quality Gate evidence where applicable.

### Next action
1. Continue the canonical Phase 2 security/lifecycle queue: full branch lifecycle and negative-path checks for cross-branch access, expired/revoked invitations and disabled staff.
2. Then continue the accepted → paid → settled economics/ledger integration and medical-analysis lifecycle.
3. Keep all fixes accompanied by regression tests and persistent execution-log evidence.

## 2026-09-16 — Branch deactivation test hardening

### Implemented
- `0591fadc13e0fb69066a070a2bfb15de30a0ad91` — made `BRANCH-002` deterministic by creating its own non-default branch, asserting it is active/non-default, and requiring the explicit `Отключить филиал` action to succeed.
- Removed the prior conditional path that silently accepted absence of a non-default branch, so the test now fails when the expected branch lifecycle is not available.
- No production branch authorization or deactivation rule was changed.

### Verification
- A fresh CI run is expected from the `main` push of `0591fadc13e0fb69066a070a2bfb15de30a0ad91`; verification remains pending until that run completes.

### Next action
1. Inspect the fresh CI run for `0591fadc13e0fb69066a070a2bfb15de30a0ad91`.
2. If green, add direct cross-tenant/cross-branch negative-path coverage and then continue invitation/session security.
3. Preserve the release gate as incomplete until all required lifecycle/security/economics evidence is green.
