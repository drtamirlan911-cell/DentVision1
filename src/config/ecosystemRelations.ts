import type { EcosystemNodeId } from './ecosystemGraph';

export type EcosystemRelationGroup = 'clinical' | 'operations' | 'growth';

export interface EcosystemRelationDefinition {
  from: EcosystemNodeId;
  to: EcosystemNodeId;
  label: string;
  group: EcosystemRelationGroup;
  path: string;
}

export const ECOSYSTEM_RELATIONS: readonly EcosystemRelationDefinition[] = [
  { from: 'clinical-case', to: 'diagnostic-referral', label: 'Диагностика', group: 'clinical', path: '/diagnostics' },
  { from: 'clinical-case', to: 'diagnostic-result', label: 'Результаты', group: 'clinical', path: '/diagnostics' },
  { from: 'clinical-case', to: 'medical-analysis', label: 'Анализы', group: 'clinical', path: '/diagnostics/lab' },
  { from: 'clinical-case', to: 'treatment-plan', label: 'План лечения', group: 'clinical', path: '/crm/cases' },
  { from: 'clinical-case', to: 'appointment', label: 'Визиты', group: 'clinical', path: '/appointments' },
  { from: 'clinical-case', to: 'lab-order', label: 'Зуботехническая лаборатория', group: 'clinical', path: '/crm/lab' },
  { from: 'clinical-case', to: 'material', label: 'Материалы', group: 'clinical', path: '/shop' },
  { from: 'clinical-case', to: 'invoice', label: 'Финансы', group: 'operations', path: '/analytics' },
  { from: 'diagnostic-referral', to: 'diagnostic-result', label: 'Результат', group: 'operations', path: '/diagnostics' },
  { from: 'material', to: 'supplier-order', label: 'Заказ поставщику', group: 'operations', path: '/shop' },
  { from: 'course', to: 'clinical-case', label: 'Обучение → практика', group: 'growth', path: '/school' },
  { from: 'job', to: 'organization', label: 'Карьера → работа', group: 'growth', path: '/jobs' },
];

export function relationsFrom(node: EcosystemNodeId) {
  return ECOSYSTEM_RELATIONS.filter(relation => relation.from === node);
}
