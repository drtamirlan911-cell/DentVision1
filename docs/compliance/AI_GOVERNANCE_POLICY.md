# AI Governance Policy

## Principles
1. AI provides recommendations — doctors make final decisions
2. All AI actions are logged for auditability
3. Patients must consent to AI analysis of their data

## Implementation

### AI Action Logging
- Actual AI tool/action execution is evidenced through the current Agentic OS activity/evidence model: `AgentActivity` records allowed/denied/executed tool attempts and `ActionEvidence` records bounded read/write evidence. `AiApproval` records gated high-risk actions and approval decisions; Event OS / AI Employee task records retain event/action provenance. These are distinct record types and must not be collapsed into one generic “every AI interaction” log.
- Do not write raw chain-of-thought, unrestricted prompts, or duplicate PHI into activity evidence. Use the dedicated redaction/encryption and active-context scope boundaries.
- The legacy `ai_action_logs` table/UI assertion below is not the canonical current audit contract. The Security & Compliance UI and each record reader must be verified against the current AgentActivity/ActionEvidence/AiApproval sources.

### Doctor Confirmation
- AI actions requiring clinical decisions flagged `doctorConfirmed: false`
- Confirmation button in AI governance panel
- Confirmed actions recorded with `confirmedBy` userId + `confirmedAt` timestamp

### Consent Requirement
- `AI_ANALYSIS` consent type in Consent model
- AI features should check consent before processing patient data
- Consent UI in Security & Compliance page
