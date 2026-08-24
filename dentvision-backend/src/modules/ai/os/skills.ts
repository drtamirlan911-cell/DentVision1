/**
 * Skills — named, bounded compositions of existing tools (Stage 9).
 *
 * The spec's own rule: *do not create a skill if an existing function can
 * already be safely used as one.* A skill here adds zero new logic — it is a
 * label over a fixed subset of `TOOLS` plus the permission a caller needs to
 * use that subset under this name. `AiInvocation.skillId`, when set, makes
 * that label a real authorization boundary in `kernel.ts` (a narrower gate on
 * top of the per-tool check every call already gets), not just prompt text.
 *
 * `requiredPermission: ''` means the skill's tools are themselves ungated
 * (mirrors `UNGATED_TOOLS`) — there is nothing stricter to require.
 */

import type { AgentDomain } from './registry.js';
import type { AiSurface } from './kernel.types.js';
import { TOOL_PERMISSIONS } from './toolPermissions.js';
import { listAgents, type AgentDefinition } from './registry.js';
import type { AiToolAccess } from './access.js';

export interface SkillDefinition {
  /** `skill.<domain>.<name>` */
  id: string;
  domain: AgentDomain;
  title: string;
  /** Subset of some agent's `allowedTools` this skill composes. */
  tools: readonly string[];
  /** '' = no permission beyond what each tool's own gate already requires. */
  requiredPermission: string;
  /** Inserted into the system prompt when this skill is offered to the model. */
  instruction: string;
  surfaces: readonly AiSurface[];
}

export const SKILLS: Record<string, SkillDefinition> = {
  'patient-summary': {
    id: 'skill.clinical.patient-summary',
    domain: 'clinical',
    title: 'Карта пациента',
    tools: ['getPatientCard', 'getVisits'],
    requiredPermission: 'medical.read',
    instruction: 'Собери карту пациента: анамнез, одонтограмма, история визитов. Только чтение.',
    surfaces: ['staff'],
  },
  'visit-summary': {
    id: 'skill.clinical.visit-summary',
    domain: 'clinical',
    title: 'История визитов',
    tools: ['getVisits'],
    requiredPermission: 'medical.read',
    instruction: 'Покажи историю визитов пациента — диагнозы, жалобы, лечение по датам.',
    surfaces: ['staff'],
  },
  'treatment-plan-review': {
    id: 'skill.clinical.treatment-plan-review',
    domain: 'clinical',
    title: 'Обзор планов лечения',
    tools: ['getTreatmentPlans'],
    requiredPermission: 'medical.read',
    instruction: 'Покажи текущие и прошлые планы лечения пациента: этапы, статусы, бюджет.',
    surfaces: ['staff'],
  },
  'appointment-search': {
    id: 'skill.clinical.appointment-search',
    domain: 'clinical',
    title: 'Поиск в расписании',
    tools: ['getSchedule'],
    requiredPermission: 'appointments.read',
    instruction: 'Найди в расписании свободные и занятые слоты по дате, врачу или пациенту.',
    surfaces: ['staff'],
  },
  'appointment-booking': {
    id: 'skill.clinical.appointment-booking',
    domain: 'clinical',
    title: 'Запись на приём',
    tools: ['getSchedule', 'createAppointment'],
    requiredPermission: 'appointments.write',
    instruction: 'Найди слот и запиши пациента. createAppointment всегда сначала как черновик (confirmed=false).',
    surfaces: ['staff'],
  },
  'patient-follow-up': {
    id: 'skill.business.patient-follow-up',
    domain: 'business',
    title: 'Реактивация пациентов',
    tools: ['getRecallList'],
    requiredPermission: 'patients.read',
    instruction: 'Найди пациентов, давно не приходивших, для реактивации.',
    surfaces: ['staff'],
  },
  'payment-monitoring': {
    id: 'skill.business.payment-monitoring',
    domain: 'business',
    title: 'Контроль оплат',
    tools: ['getDebtors', 'getRevenue'],
    requiredPermission: 'billing.read',
    instruction: 'Покажи должников и выручку клиники — только чтение, без создания счетов.',
    surfaces: ['staff'],
  },
  'deadline-monitoring': {
    id: 'skill.clinical.deadline-monitoring',
    domain: 'clinical',
    title: 'Контроль сроков лаборатории',
    tools: ['getLabOrders'],
    requiredPermission: 'lab.read',
    instruction: 'Найди просроченные и приближающиеся сроки заказов лаборатории.',
    surfaces: ['staff'],
  },
  'learning-recommendation': {
    id: 'skill.education.learning-recommendation',
    domain: 'education',
    title: 'Подбор обучения',
    tools: ['searchCourses'],
    requiredPermission: '',
    instruction: 'Подбери курсы Academy OS по специализации и уровню.',
    surfaces: ['staff'],
  },
  'create-referral': {
    id: 'skill.clinical.create-referral',
    domain: 'clinical',
    title: 'Направление на диагностику',
    tools: ['createDiagnosticReferral'],
    requiredPermission: '',
    instruction: 'Оформи направление на диагностику (КТ, ОПТГ, гистология и т.д.). Всегда сначала черновик (confirmed=false).',
    surfaces: ['staff'],
  },
  'lab-order-management': {
    id: 'skill.clinical.lab-order-management',
    domain: 'clinical',
    title: 'Заказы лаборатории',
    tools: ['createLabOrder', 'updateLabOrderStatus'],
    requiredPermission: 'appointment.write',
    instruction: 'Создай заказ-наряд в лабораторию или обнови его статус. Новый заказ — сначала черновик (confirmed=false).',
    surfaces: ['staff'],
  },
};

/**
 * Whether an already-resolved `allowedTools` set (staff surface) satisfies a
 * skill's declared permission. Derived from `TOOL_PERMISSIONS` rather than a
 * raw permission set the kernel does not retain: `allowedTools` already only
 * contains a tool when `access.ts` proved the caller's permissions satisfy
 * that tool's own required key, so "some tool mapped to exactly this
 * permission is allowed" is an exact, not approximate, read of "the caller
 * holds this permission" for every permission that actually gates a tool.
 */
export function skillPermissionSatisfied(allowedTools: Set<string> | null, requiredPermission: string): boolean {
  if (!requiredPermission) return true;
  if (!allowedTools) return false;
  for (const [tool, perm] of Object.entries(TOOL_PERMISSIONS)) {
    if (perm === requiredPermission && allowedTools.has(tool)) return true;
  }
  return false;
}

/** Skills an agent can offer a caller — every tool must be in both the agent's own allowedTools and the caller's resolved access. */
export function skillsFor(agentId: string, access: AiToolAccess): SkillDefinition[] {
  const agent: AgentDefinition | undefined = listAgents().find((a) => a.id === agentId);
  if (!agent) return [];
  return Object.values(SKILLS).filter((skill) =>
    skill.tools.every((tool) => agent.allowedTools.includes(tool) && access.allowed.has(tool)),
  );
}
