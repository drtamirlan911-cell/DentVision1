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
import { listAgents, agentsForRole, type AgentDefinition } from './registry.js';
import type { AiToolAccess } from './access.js';

export interface SkillDefinition {
  /** `skill.<domain>.<name>` */
  id: string;
  domain: AgentDomain;
  title: string;
  /**
   * The skill phrased as the user would say it, so a client can offer it as a
   * ready question instead of leaving an empty input box. `title` names the
   * capability for a list; this is what gets sent when someone taps it.
   */
  examplePrompt: string;
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
    examplePrompt: 'Покажи карту пациента',
    tools: ['getPatientCard', 'getVisits'],
    requiredPermission: 'medical.read',
    instruction: 'Собери карту пациента: анамнез, одонтограмма, история визитов. Только чтение.',
    surfaces: ['staff'],
  },
  'visit-summary': {
    id: 'skill.clinical.visit-summary',
    domain: 'clinical',
    title: 'История визитов',
    examplePrompt: 'Покажи историю визитов пациента',
    tools: ['getVisits'],
    requiredPermission: 'medical.read',
    instruction: 'Покажи историю визитов пациента — диагнозы, жалобы, лечение по датам.',
    surfaces: ['staff'],
  },
  'treatment-plan-review': {
    id: 'skill.clinical.treatment-plan-review',
    domain: 'clinical',
    title: 'Обзор планов лечения',
    examplePrompt: 'Покажи планы лечения пациента',
    tools: ['getTreatmentPlans'],
    requiredPermission: 'medical.read',
    instruction: 'Покажи текущие и прошлые планы лечения пациента: этапы, статусы, бюджет.',
    surfaces: ['staff'],
  },
  'appointment-search': {
    id: 'skill.clinical.appointment-search',
    domain: 'clinical',
    title: 'Поиск в расписании',
    examplePrompt: 'Что у меня в расписании сегодня?',
    tools: ['getSchedule'],
    requiredPermission: 'appointments.read',
    instruction: 'Найди в расписании свободные и занятые слоты по дате, врачу или пациенту.',
    surfaces: ['staff'],
  },
  'appointment-booking': {
    id: 'skill.clinical.appointment-booking',
    domain: 'clinical',
    title: 'Запись на приём',
    examplePrompt: 'Запиши пациента на приём',
    tools: ['getSchedule', 'createAppointment'],
    requiredPermission: 'appointments.write',
    instruction: 'Найди слот и запиши пациента. createAppointment всегда сначала как черновик (confirmed=false).',
    surfaces: ['staff'],
  },
  'patient-follow-up': {
    id: 'skill.business.patient-follow-up',
    domain: 'business',
    title: 'Реактивация пациентов',
    examplePrompt: 'Кого давно не было — покажи для обзвона',
    tools: ['getRecallList'],
    requiredPermission: 'patients.read',
    instruction: 'Найди пациентов, давно не приходивших, для реактивации.',
    surfaces: ['staff'],
  },
  'payment-monitoring': {
    id: 'skill.business.payment-monitoring',
    domain: 'business',
    title: 'Контроль оплат',
    examplePrompt: 'Покажи должников',
    tools: ['getDebtors', 'getRevenue'],
    requiredPermission: 'billing.read',
    instruction: 'Покажи должников и выручку клиники — только чтение, без создания счетов.',
    surfaces: ['staff'],
  },
  'deadline-monitoring': {
    id: 'skill.clinical.deadline-monitoring',
    domain: 'clinical',
    title: 'Контроль сроков лаборатории',
    examplePrompt: 'Какие заказы лаборатории просрочены?',
    tools: ['getLabOrders'],
    requiredPermission: 'lab.read',
    instruction: 'Найди просроченные и приближающиеся сроки заказов лаборатории.',
    surfaces: ['staff'],
  },
  'learning-recommendation': {
    id: 'skill.education.learning-recommendation',
    domain: 'education',
    title: 'Подбор обучения',
    examplePrompt: 'Подбери мне курс по специализации',
    tools: ['searchCourses'],
    requiredPermission: '',
    instruction: 'Подбери курсы Academy OS по специализации и уровню.',
    surfaces: ['staff'],
  },
  'create-referral': {
    id: 'skill.clinical.create-referral',
    domain: 'clinical',
    title: 'Направление на диагностику',
    examplePrompt: 'Оформи направление на КТ',
    tools: ['createDiagnosticReferral'],
    requiredPermission: '',
    instruction: 'Оформи направление на диагностику (КТ, ОПТГ, гистология и т.д.). Всегда сначала черновик (confirmed=false).',
    surfaces: ['staff'],
  },
  'lab-order-management': {
    id: 'skill.clinical.lab-order-management',
    domain: 'clinical',
    title: 'Заказы лаборатории',
    examplePrompt: 'Создай заказ в лабораторию',
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

/** One entry of the capability catalogue a client shows the user. */
export interface SkillCatalogueEntry {
  id: string;
  domain: AgentDomain;
  title: string;
  /** The skill phrased as a question to send when the user picks it. */
  prompt: string;
}

/**
 * Everything the assistant can do for one caller on one surface, deduplicated.
 *
 * `skillsFor` answers per agent, and the same skill is often reachable through
 * several agents a role may use — a union keyed by skill id is what a person
 * actually wants to see: each capability once.
 *
 * Grants nothing on its own. Both filters are the ones the kernel would apply
 * anyway: `agentsForRole` for the clinic role, and `skillsFor` for the tools
 * `resolveAiToolAccess` already proved this caller may invoke.
 */
export function skillCatalogueFor(access: AiToolAccess, surface: AiSurface): SkillCatalogueEntry[] {
  const byId = new Map<string, SkillDefinition>();
  for (const agent of agentsForRole(access.role)) {
    for (const skill of skillsFor(agent.id, access)) {
      if (skill.surfaces.includes(surface)) byId.set(skill.id, skill);
    }
  }
  return [...byId.values()].map((s) => ({
    id: s.id,
    domain: s.domain,
    title: s.title,
    prompt: s.examplePrompt,
  }));
}
