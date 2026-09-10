# DentVision AI Employee — Execution Contract

## Purpose

The AI Employee is an operational agent assigned to a DentVision role. It turns trusted product events into durable work, applies the role's permission/autonomy contract, executes only permitted actions, verifies outcomes, and reports them in the user's workspace.

## Lifecycle

`queued → observing → proposed → awaiting_approval → executing → verified → completed`

Terminal failure states: `failed`, `cancelled`.

## Risk policy

- **routine**: may execute automatically when the role contract permits the action.
- **assisted**: proposes the action and requires explicit approval before execution.
- **supervised**: clinical/high-impact actions remain human-controlled; AI can prepare evidence and recommendations but cannot make the final clinical decision.

## Execution requirements

1. Every task is traceable to a source event.
2. Every action is evaluated against role permissions before execution.
3. Approval is explicit and recorded when required.
4. Execution is idempotent where possible.
5. Results are verified rather than assuming a successful tool call means success.
6. Failures remain visible and actionable.
7. Sensitive medical/financial data is never exposed beyond the role contract.

## Initial priority workflows

### Patient intake
`PatientCreated → AI Doctor Assistant → complaint/urgency task → doctor notification → clinical recommendation → human approval for clinical action`

### Reception
`AppointmentBooked/AppointmentReminder → AI Reception Assistant → reminder task → send/record outcome → verify delivery`

### Finance
`PaymentOverdue → AI Finance Assistant → collection/follow-up task → approval where required → record result`

### Laboratory
`LabOrderCreated/LabOrderCompleted → AI Lab Assistant → deadline/status task → notify responsible role → verify state`

## Product principle

The visible AI Workspace is the control surface for this execution loop. AI identity, current tasks, approvals, actions, outcomes, and audit evidence should remain understandable without requiring the user to navigate an abstract AI administration page.
