import { eventBus } from '../../events/index.js';
import { matchEventRules } from './eventRules.js';
import { createAiEmployeeTask } from './aiEmployeeTasks.js';
import { employeeContractForRole } from './employeeContract.js';

const AGENT_ROLES: Record<string, string[]> = {
  doctor: ['DOCTOR', 'ASSISTANT'],
  reception: ['ADMIN', 'ASSISTANT'],
  finance: ['CASHIER', 'OWNER', 'MANAGER'],
  ceo: ['OWNER', 'SUPERADMIN'],
  supply: ['MANAGER', 'OWNER', 'ADMIN'],
  lab: ['LAB', 'MANAGER'],
};

const HIGH_RISK_ACTIONS = new Set([
  'createTreatmentPlan', 'createDiagnosis', 'createPrescription', 'updateMedicalChart',
  'createInvoice', 'recordPayment', 'refundPayment', 'sendMassMessage',
]);

function riskForAction(action: string): 'low' | 'medium' | 'high' {
  if (HIGH_RISK_ACTIONS.has(action)) return 'high';
  if (/notify|reminder|follow|summary|recommend|analy/i.test(action)) return 'low';
  return 'medium';
}

function taskTitle(eventType: string, action: string): string {
  return `${eventType}: ${action}`.slice(0, 230);
}

/**
 * Event OS remains the execution engine. This subscriber adds the missing
 * durable "work memory": every meaningful proactive action becomes an AI
 * Employee task with role, risk, source event and action provenance.
 *
 * It intentionally does not execute anything. Existing event actions remain the
 * only execution path, so this cannot create a second side-effecting executor.
 */
export function registerAiEmployeeTaskSubscriber(): void {
  eventBus.subscribe('*', async (event) => {
    if (!event.clinicId) return;

    try {
      const rules = matchEventRules(event.type, event.payload as Record<string, unknown>);
      const seen = new Set<string>();

      for (const rule of rules) {
        for (const action of rule.actions) {
          const roles = AGENT_ROLES[action.agent] || [];
          for (const role of roles) {
            const key = `${event.id}:${action.action}:${role}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const contract = employeeContractForRole(role);
            const risk = riskForAction(action.action);
            const status = risk === 'low'
              ? 'queued' as const
              : 'awaiting_approval' as const;

            await createAiEmployeeTask({
              clinicId: event.clinicId,
              role,
              title: taskTitle(event.type, action.action),
              description: `AI Employee ${contract.title} получил рабочую задачу из события ${event.type}.`,
              sourceEventId: event.id,
              sourceEventType: event.type,
              action: action.action,
              actionPayload: event.payload,
              risk,
              status,
              metadata: {
                ruleId: rule.id,
                agent: action.agent,
                parallel: Boolean(action.parallel),
                employeeMission: contract.mission,
                requiresHumanApproval: risk !== 'low',
              },
            });
          }
        }
      }
    } catch (error) {
      // Task persistence must never block the existing Event OS execution path.
      console.warn('[AI Employee Tasks] subscriber failed', error);
    }
  });
}
