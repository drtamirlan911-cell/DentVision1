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

## 2026-09-14 — Appointments E2E contract correction

### Investigation
- The canonical `appointments.routes.ts` exposes list, POST upsert, `PATCH /:id/status`, `POST /:id/close`, and `DELETE /:id`; there is intentionally no `GET /appointments/:id` route.
- The list response is the standard API envelope whose `data` value is itself the paginated response: `{ data: Appointment[], pagination: ... }`.
- `e2e/helpers/api.ts` removes only the outer `{ ok, data }` envelope. Therefore an appointment list returned to an E2E spec is `{ data: [...], pagination: ... }`, not the array itself.
- `APPT-002` incorrectly treated the unwrapped list payload as the array in its `Array.isArray()` lookup. This was a test/API-contract mismatch, not evidence that the appointment create/update implementation was broken.

### Implemented
- `f4db585fba4b15467b4ae963ab5579dc7a75e96d` corrected `e2e/tests/appointment.spec.ts` so `APPT-002` reads the paginated `data` array after the outer envelope is removed.
- No production endpoint, permission, status mapping, or security check was weakened or bypassed.

### Verification status
- GitHub does not currently expose a workflow run for the new commit through the connected workflow-run endpoint, so this change is **UNVERIFIED** until the actual Appointments E2E and release gates execute against `f4db585fba4b15467b4ae963ab5579dc7a75e96d`.
- Release remains **NOT READY**.

### Next action
1. Execute/obtain Appointments E2E against the exact commit `f4db585fba4b15467b4ae963ab5579dc7a75e96d`.
2. If it passes, run the full release-gate and inspect every failing job against the current HEAD only.
3. If another appointment failure appears, fix the actual production/test contract at its root without weakening assertions.
4. Continue the canonical P0 queue: auth fail-closed/session enforcement, IAM negative matrix, diagnostics confirmation contract, then P1 economics/partner lifecycle.
