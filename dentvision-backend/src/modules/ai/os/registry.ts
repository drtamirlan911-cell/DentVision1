/**
 * Agent Registry — DentVision AI OS (Spec §15.18)
 *
 * The single source of truth for which agents exist and what they are
 * allowed to do. An agent that is not registered here cannot be selected
 * by the orchestrator, and a tool not listed in `allowedTools` is never
 * exposed to that agent's LLM planning step.
 */

export type AgentStatus = 'active' | 'beta' | 'disabled';

export type AgentDomain =
  | 'clinical'
  | 'business'
  | 'marketplace'
  | 'education'
  | 'compliance'
  | 'automation'
  | 'knowledge';

export interface AgentDefinition {
  /** `agent.<domain>.<name>` (Spec §15.18) */
  id: string;
  name: string;
  domain: AgentDomain;
  version: string;
  /** Clinic roles allowed to invoke this agent. '*' = any authenticated role. */
  requiredPermissions: string[];
  /** Tool names from os/tools.ts this agent may call. */
  allowedTools: string[];
  owner: string;
  status: AgentStatus;
  /** Injected into the system prompt when this agent leads the response. */
  mandate: string;
}

const AGENTS: AgentDefinition[] = [
  {
    id: 'agent.clinical.patient',
    name: 'Patient Agent',
    domain: 'clinical',
    version: '1.0.0',
    requiredPermissions: ['OWNER', 'ADMIN', 'DOCTOR', 'ASSISTANT', 'MANAGER'],
    allowedTools: ['searchPatients', 'getPatientCard', 'getVisits', 'navigate'],
    owner: 'clinical-team',
    status: 'active',
    mandate:
      'Ты работаешь с пациентами: поиск, медицинская карта, анамнез, история посещений. Не ставь диагнозы — окончательное клиническое решение принимает врач.',
  },
  {
    id: 'agent.clinical.treatment-planner',
    name: 'Treatment Planner',
    domain: 'clinical',
    version: '1.0.0',
    requiredPermissions: ['OWNER', 'DOCTOR'],
    allowedTools: ['searchPatients', 'getPatientCard', 'getTreatmentPlans', 'createTreatmentPlan', 'navigate'],
    owner: 'clinical-team',
    status: 'active',
    mandate:
      'Ты составляешь планы лечения по одонтограмме: читай getPatientCard.odontogramSummary (статусы FDI + поверхности M/O/D/B/L, эндо ✓/✗, импланты). ' +
      'Предложи этапы с зубами и ориентиром бюджета, затем createTreatmentPlan (confirmed=false). План — черновик для врача.',
  },
  {
    id: 'agent.clinical.reception',
    name: 'Reception Agent',
    domain: 'clinical',
    version: '1.0.0',
    requiredPermissions: ['OWNER', 'ADMIN', 'DOCTOR', 'ASSISTANT', 'MANAGER'],
    allowedTools: [
      'getSchedule',
      'searchPatients',
      'getClinicLoadPlan',
      'getTreatmentPlans',
      'createAppointment',
      'updateAppointmentStatus',
      'cancelAppointment',
      'rescheduleAppointment',
      'navigate',
    ],
    owner: 'clinical-team',
    status: 'active',
    mandate:
      'Ты управляешь записью и загрузкой: при вопросах про пустые слоты / возврат пациентов / обзвон СРАЗУ вызывай getClinicLoadPlan и отвечай именами, телефонами и часами из данных. Без общих лекций.',
  },
  {
    id: 'agent.business.finance',
    name: 'Financial Agent',
    domain: 'business',
    version: '1.0.0',
    requiredPermissions: ['OWNER', 'ADMIN', 'MANAGER'],
    allowedTools: ['getRevenue', 'getDebtors', 'createInvoice', 'navigate'],
    owner: 'business-team',
    status: 'active',
    mandate:
      'Ты отвечаешь за финансы клиники: выручка, должники, счета. Показывай цифры точно, из данных, без выдумывания. Создание счёта требует подтверждения.',
  },
  {
    id: 'agent.business.analytics',
    name: 'Analytics Agent',
    domain: 'business',
    version: '1.0.0',
    requiredPermissions: ['OWNER', 'ADMIN', 'MANAGER'],
    allowedTools: ['getDashboardStats', 'getRevenue', 'getDoctorUtilization', 'getClinicLoadPlan', 'getDebtors', 'navigate'],
    owner: 'business-team',
    status: 'active',
    mandate:
      'Ты делаешь аналитику и загрузку клиники. По загрузке/возврату базы/пустым слотам СРАЗУ getClinicLoadPlan — отвечай конкретными пациентами, телефонами, датами и часами. Не подменяй данные общей теорией и не заканчивай «если хотите, помогу».',
  },
  {
    id: 'agent.marketplace.shop',
    name: 'Shop Agent',
    domain: 'marketplace',
    version: '1.0.0',
    requiredPermissions: ['*'],
    allowedTools: ['searchProducts', 'navigate'],
    owner: 'marketplace-team',
    status: 'active',
    mandate:
      'Ты помогаешь с закупками: поиск и подбор товаров в маркетплейсе. Заказы оформляет пользователь через корзину.',
  },
  {
    id: 'agent.marketplace.inventory',
    name: 'Inventory Agent',
    domain: 'marketplace',
    version: '1.0.0',
    requiredPermissions: ['OWNER', 'ADMIN', 'DOCTOR', 'ASSISTANT', 'MANAGER'],
    allowedTools: ['getInventory', 'searchProducts', 'navigate'],
    owner: 'marketplace-team',
    status: 'active',
    mandate:
      'Ты следишь за складом клиники: остатки, что заканчивается, что пора дозаказать (с подбором из маркетплейса).',
  },
  {
    id: 'agent.education.school',
    name: 'School Agent',
    domain: 'education',
    version: '1.0.0',
    requiredPermissions: ['*'],
    allowedTools: ['searchCourses', 'navigate'],
    owner: 'education-team',
    status: 'active',
    mandate:
      'Ты подбираешь обучение: курсы Академии по специализации и уровню. Рекомендуй конкретные курсы с обоснованием.',
  },
  {
    id: 'agent.knowledge.guest',
    name: 'Guest Concierge',
    domain: 'knowledge',
    version: '1.0.0',
    requiredPermissions: ['GUEST'],
    allowedTools: ['searchCourses', 'searchProducts', 'navigate'],
    owner: 'growth-team',
    status: 'active',
    mandate:
      'Ты — дружелюбный гид DentVision для гостя. Объясняй платформу простым языком: CRM клиники, маркетплейс, Academy OS, ИИ-ассистент. Не выдумывай данные клиники (расписание, выручку, долги) — у гостя нет клиники. Предлагай демо, регистрацию, маркетплейс и академию. Отвечай как чистый чат-ассистент, без канцелярита. Названия разделов пиши только по-русски, без английских ключей вроде schedule/patients.',
  },
  {
    id: 'agent.clinical.lab',
    name: 'Laboratory Agent',
    domain: 'clinical',
    version: '1.0.0',
    requiredPermissions: ['OWNER', 'ADMIN', 'DOCTOR', 'LAB'],
    allowedTools: ['getLabOrders', 'navigate'],
    owner: 'clinical-team',
    status: 'active',
    mandate: 'Ты следишь за лабораторными заказами: статусы, сроки, просрочки.',
  },
];

export function listAgents(): AgentDefinition[] {
  return AGENTS.filter((a) => a.status !== 'disabled');
}

export function agentsForRole(role: string): AgentDefinition[] {
  const normalized = role.toUpperCase();
  return listAgents().filter(
    (a) => a.requiredPermissions.includes('*') || a.requiredPermissions.includes(normalized),
  );
}

/** Union of tools available to a role across all its permitted agents. */
export function toolsForRole(role: string): Set<string> {
  const tools = new Set<string>();
  for (const agent of agentsForRole(role)) {
    for (const tool of agent.allowedTools) tools.add(tool);
  }
  return tools;
}
