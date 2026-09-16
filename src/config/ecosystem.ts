export type EcosystemParticipant =
  | 'patient' | 'professional' | 'clinic' | 'diagnostic_center' | 'medical_laboratory' | 'dental_laboratory'
  | 'supplier' | 'academy' | 'lecturer' | 'student' | 'employer' | 'job_seeker' | 'community' | 'platform';

export type EcosystemServiceId =
  | 'ai' | 'practice' | 'diagnostics' | 'medical-laboratory' | 'dental-laboratory' | 'market'
  | 'academy' | 'jobs' | 'network' | 'community' | 'finance' | 'analytics' | 'administration';

export interface EcosystemServiceDefinition {
  id: EcosystemServiceId;
  label: string;
  description: string;
  path: string;
  participants: EcosystemParticipant[];
  requiresOrganization?: boolean;
  requiresClinic?: boolean;
}

export interface EcosystemContext {
  id: string;
  kind: EcosystemParticipant | 'personal' | 'organization' | 'branch';
  label: string;
  description: string;
  path: string;
  serviceIds: EcosystemServiceId[];
}

export interface EcosystemJourney {
  id: string;
  label: string;
  description: string;
  participants: EcosystemParticipant[];
  steps: EcosystemServiceId[];
}

/** Canonical UX vocabulary. Route availability remains governed by src/index.tsx + IAM. */
export const ECOSYSTEM_SERVICES: readonly EcosystemServiceDefinition[] = [
  { id: 'ai', label: 'DentVision AI', description: 'Единый слой поиска, контекста и разрешённых действий', path: '/ai', participants: ['patient','professional','clinic','diagnostic_center','medical_laboratory','dental_laboratory','supplier','academy','student','employer','job_seeker','community'] },
  { id: 'practice', label: 'Практика', description: 'Пациенты, случаи, визиты, лечение и расписание', path: '/crm/schedule', participants: ['professional','clinic'], requiresClinic: true },
  { id: 'diagnostics', label: 'Диагностика', description: 'Диагностические центры, направления, исследования и результаты', path: '/diagnostics', participants: ['patient','professional','clinic','diagnostic_center'] },
  { id: 'medical-laboratory', label: 'Медицинская лаборатория', description: 'Анализы, обработка, результаты и выдача', path: '/diagnostics/lab', participants: ['patient','professional','clinic','medical_laboratory'] },
  { id: 'dental-laboratory', label: 'Зуботехническая лаборатория', description: 'Лабораторные заказы, производство, QC и выдача', path: '/crm/lab', participants: ['professional','clinic','dental_laboratory'] },
  { id: 'market', label: 'DentVision Market', description: 'Материалы, оборудование, поставщики и закупки', path: '/shop', participants: ['professional','clinic','supplier','patient'] },
  { id: 'academy', label: 'Academy', description: 'Курсы, преподаватели, обучение и сертификаты', path: '/school', participants: ['professional','lecturer','student','academy'] },
  { id: 'jobs', label: 'Jobs', description: 'Вакансии, профессиональные профили и найм', path: '/jobs', participants: ['professional','employer','job_seeker'] },
  { id: 'network', label: 'Network', description: 'Специалисты, организации и профессиональные связи', path: '/community', participants: ['professional','clinic','diagnostic_center','medical_laboratory','dental_laboratory','supplier','academy','employer','job_seeker','community'] },
  { id: 'community', label: 'Community', description: 'Профессиональное сообщество и обмен опытом', path: '/community', participants: ['professional','student','lecturer','community'] },
  { id: 'finance', label: 'Finance', description: 'Платежи, экономика, расчёты и settlement', path: '/crm/cashier', participants: ['clinic','diagnostic_center','medical_laboratory','dental_laboratory','supplier','academy'], requiresOrganization: true },
  { id: 'analytics', label: 'Analytics', description: 'Операционные и бизнес-показатели', path: '/analytics', participants: ['clinic','diagnostic_center','medical_laboratory','dental_laboratory','supplier','academy'], requiresOrganization: true },
  { id: 'administration', label: 'Administration', description: 'IAM, аудит, безопасность и управление платформой', path: '/admin', participants: ['platform'], requiresOrganization: false },
];

export const PARTICIPANT_LABELS: Record<EcosystemParticipant, string> = {
  patient: 'Пациент / покупатель', professional: 'Профессионал', clinic: 'Клиника', diagnostic_center: 'Диагностический центр',
  medical_laboratory: 'Медицинская лаборатория', dental_laboratory: 'Зуботехническая лаборатория', supplier: 'Поставщик', academy: 'Академия',
  lecturer: 'Преподаватель', student: 'Студент', employer: 'Работодатель', job_seeker: 'Соискатель', community: 'Участник сообщества', platform: 'Платформа',
};

export const ECOSYSTEM_CONTEXTS: readonly EcosystemContext[] = [
  { id: 'personal', kind: 'personal', label: 'Личный контекст', description: 'AI, обучение, рынок, Jobs и профессиональная сеть', path: '/', serviceIds: ['ai','market','academy','jobs','network','community'] },
  { id: 'clinic', kind: 'clinic', label: 'Клиника', description: 'Практика, пациенты, диагностика, лаборатории и экономика', path: '/crm/schedule', serviceIds: ['ai','practice','diagnostics','medical-laboratory','dental-laboratory','market','finance','analytics'] },
  { id: 'diagnostic-center', kind: 'diagnostic_center', label: 'Диагностический центр', description: 'Исследования, направления, результаты, команда и экономика', path: '/diagnostics/center', serviceIds: ['ai','diagnostics','network','finance','analytics'] },
  { id: 'medical-laboratory', kind: 'medical_laboratory', label: 'Медицинская лаборатория', description: 'Анализы, заказы, результаты, организация и расчёты', path: '/diagnostics/lab', serviceIds: ['ai','medical-laboratory','diagnostics','finance','analytics'] },
  { id: 'dental-laboratory', kind: 'dental_laboratory', label: 'Зуботехническая лаборатория', description: 'Заказы, производство, QC, выдача и расчёты', path: '/crm/lab', serviceIds: ['ai','dental-laboratory','market','finance','analytics'] },
  { id: 'supplier', kind: 'supplier', label: 'Поставщик', description: 'Каталог, заказы, клиенты, команда и экономика', path: '/supplier', serviceIds: ['ai','market','network','finance','analytics'] },
  { id: 'academy', kind: 'academy', label: 'Академия', description: 'Курсы, преподаватели, студенты, продажи и аналитика', path: '/school', serviceIds: ['ai','academy','network','finance','analytics'] },
];

export const ECOSYSTEM_JOURNEYS: readonly EcosystemJourney[] = [
  { id: 'diagnostic-to-treatment', label: 'Диагностика → лечение', description: 'Направление исследования становится частью клинического случая и решения врача', participants: ['patient','professional','clinic','diagnostic_center'], steps: ['practice','diagnostics','ai'] },
  { id: 'case-to-lab', label: 'Кейс → зуботехническая лаборатория', description: 'Клинический кейс связан с лабораторным заказом, производством и результатом', participants: ['professional','clinic','dental_laboratory'], steps: ['practice','dental-laboratory','ai'] },
  { id: 'case-to-material', label: 'Кейс → материал', description: 'Клиническая задача связывается с материалом, оборудованием и поставщиком', participants: ['professional','clinic','supplier'], steps: ['practice','market','ai'] },
  { id: 'analysis-loop', label: 'Анализ → клиническое решение', description: 'Результат медицинского анализа возвращается в рабочий контекст с контролем доступа', participants: ['patient','professional','clinic','medical_laboratory'], steps: ['medical-laboratory','practice','ai'] },
  { id: 'learn-to-practice', label: 'Обучение → практика', description: 'Обучение, профессиональная сеть и практический рабочий контекст связаны одной идентичностью', participants: ['professional','student','lecturer'], steps: ['academy','network','practice'] },
  { id: 'hire-to-work', label: 'Найм → работа', description: 'Вакансия, профессиональный профиль и рабочий контекст образуют единый путь', participants: ['professional','employer','job_seeker'], steps: ['jobs','network','practice'] },
];

export function ecosystemServicesFor(participant: EcosystemParticipant): EcosystemServiceDefinition[] {
  return ECOSYSTEM_SERVICES.filter(service => service.participants.includes(participant));
}

export function ecosystemContextFor(kind?: string | null, hasClinic = false): EcosystemContext {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'diagnostic_center') return ECOSYSTEM_CONTEXTS.find(x => x.id === 'diagnostic-center')!;
  if (normalized === 'lab_diagnostic' || normalized === 'medical_laboratory') return ECOSYSTEM_CONTEXTS.find(x => x.id === 'medical-laboratory')!;
  if (normalized === 'laboratory' || normalized === 'dental_laboratory' || normalized === 'lab') return ECOSYSTEM_CONTEXTS.find(x => x.id === 'dental-laboratory')!;
  if (normalized === 'supplier') return ECOSYSTEM_CONTEXTS.find(x => x.id === 'supplier')!;
  if (normalized === 'academy' || normalized === 'lecturer') return ECOSYSTEM_CONTEXTS.find(x => x.id === 'academy')!;
  if (hasClinic || ['doctor','owner','director','admin','assistant'].includes(normalized)) return ECOSYSTEM_CONTEXTS.find(x => x.id === 'clinic')!;
  return ECOSYSTEM_CONTEXTS.find(x => x.id === 'personal')!;
}
