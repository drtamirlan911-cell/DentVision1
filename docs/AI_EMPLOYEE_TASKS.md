# DentVision AI Employee — Task Lifecycle

The AI Employee is an operational worker attached to a role, not a standalone chat page.

## Lifecycle

`queued → observing → proposed → awaiting_approval → executing → verified → completed`

Terminal failure states: `failed`, `cancelled`.

## Task record

Each task keeps:

- clinic scope;
- employee role and human-facing employee title;
- source EventBus event and event type;
- intended action and event payload;
- risk (`low`, `medium`, `high`);
- autonomy contract;
- result/error;
- creation, update and completion timestamps.

## Safety boundary

Low-risk operational tasks can enter the queue automatically. Medium/high-risk work is recorded as `awaiting_approval` and must not silently mutate clinical, financial, permission or other protected state.

The existing Event OS remains the only execution path. The task ledger is work memory and provenance; it does not create a second side-effecting executor.

## First-class examples

- Patient event → AI Doctor Assistant task with clinical actions approval-gated.
- Appointment/no-show event → AI Reception Assistant operational task.
- Payment/finance event → AI Finance Assistant task with financial mutations approval-gated.
- Lab event → AI Lab Assistant task with result/interpretation boundaries.

## Implementation status — reconciled against main on 2026-11-15

**Status: IMPLEMENTED CLINIC-SCOPED TASK LEDGER; ECOSYSTEM-WIDE COVERAGE PARTIAL.**

The persistent task ledger and core lifecycle are no longer merely proposed. Current source contains:

- `dentvision-backend/prisma/migrations/20260910_add_ai_employee_tasks/migration.sql` — durable `ai_employee_tasks` table and clinic/status/role/source-event indexes.
- `dentvision-backend/prisma/migrations/20260910_ai_employee_task_idempotency/migration.sql` — idempotency index on `(source_event_id, action, role)` for replayed EventBus delivery.
- `dentvision-backend/src/modules/ai/os/aiEmployeeTasks.ts` — parameterized SQL creation/list/read and conditional lifecycle transition service.
- `dentvision-backend/src/modules/ai/os/aiEmployeeTaskSubscriber.ts`, registered from `ai/os/index.ts` — Event OS subscriber creates task records from matched role/action events. It stores event provenance but deliberately sets `actionPayload: null` to avoid copying clinical event payloads/PHI into a second durable store.
- `dentvision-backend/src/modules/ai/os/approvals.routes.ts` — authenticated `GET /api/ai/approvals/tasks` and `POST /api/ai/approvals/tasks/:id/transition`; task listing/transitions require a clinic context and are scoped to `clinicId`. Non-privileged users may transition only their own tasks; OWNER/SUPERADMIN/MANAGER/ADMIN have broader clinic-workspace transition capability. Transitions are audited.
- `src/utils/aiEmployeeTasksApi.ts` and `src/components/intelligence/AIEmployeeTaskPanel.tsx` — web API client and task-panel component exist. Their mounting as a default surface in every participant workspace is **not verified** by this source review.

### Confirmed boundary / remaining work

The current durable task schema and service are **clinic-scoped only**: `CreateAiEmployeeTaskInput.clinicId` is required; the database table has a required `clinic_id`; the subscriber ignores events with no `event.clinicId`; both API endpoints reject users without `req.user.clinicId`. Therefore diagnostic-center, medical-lab, dental-lab, supplier, academy, employer and platform-wide tasks are not yet covered by this ledger as first-class organization-scoped workspaces.

The subscriber records task provenance/work memory; Event OS remains the side-effect executor. A task row's status transition is not, by itself, proof that the action executed or that a real outcome was verified. Do not conflate a transition to `completed` with execution unless linked action evidence confirms it.

Next implementation slice: generalize the ledger to canonical active workspace scope (`scopeType` + `organizationId` + optional `branchId`), add migration and scoped indexes, preserve clinic compatibility, bind every read/write to active IAM context and permission, then add positive/negative E2E for all first-class participant types. Only then claim cross-ecosystem AI Employee coverage.
