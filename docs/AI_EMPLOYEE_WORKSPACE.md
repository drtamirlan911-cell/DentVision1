# AI Employee Workspace

The AI Workspace is the control surface for role-based AI Employees. Durable work must remain visible as tasks, not only as chat messages or transient notifications.

## Task lifecycle

`queued -> observing -> proposed -> awaiting_approval -> executing -> verified -> completed`

Failure and cancellation are terminal states.

## Product rule

The workspace should expose task state, risk, priority, source event, proposed action, approval state and verification evidence. Clinical, financial and otherwise high-risk actions remain human-in-the-loop.

## Initial vertical workflows

- PatientCreated with pain/swelling: AI Doctor Assistant observes the event, creates a clinical task, proposes next steps, and requires doctor approval before clinical action.
- AppointmentBooked / PatientNoShow: AI Reception Assistant creates reminder/follow-up work and can execute routine communication only within the role policy.
