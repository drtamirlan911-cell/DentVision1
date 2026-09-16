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

/** Canonical UX vocabulary for the ecosystem. Route availability remains governed by src/index.tsx + IAM. */
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

export function ecosystemServicesFor(participant: EcosystemParticipant): EcosystemServiceDefinition[] {
  return ECOSYSTEM_SERVICES.filter(service => service.participants.includes(participant));
}
