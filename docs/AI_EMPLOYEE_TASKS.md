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
