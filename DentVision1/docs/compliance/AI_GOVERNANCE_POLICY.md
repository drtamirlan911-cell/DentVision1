# AI Governance Policy

## Principles
1. AI provides recommendations — doctors make final decisions
2. All AI actions are logged for auditability
3. Patients must consent to AI analysis of their data

## Implementation

### AI Action Logging
- Every AI interaction logged to `ai_action_logs` table
- Fields: userId, patientId, agent, model, request, response, doctorConfirmed
- UI: Security & Compliance page shows recent AI actions with confirm button

### Doctor Confirmation
- AI actions requiring clinical decisions flagged `doctorConfirmed: false`
- Confirmation button in AI governance panel
- Confirmed actions recorded with `confirmedBy` userId + `confirmedAt` timestamp

### Consent Requirement
- `AI_ANALYSIS` consent type in Consent model
- AI features should check consent before processing patient data
- Consent UI in Security & Compliance page
