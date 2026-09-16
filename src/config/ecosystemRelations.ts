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
  { from: 'clinical-case', to: 'appointment', label: 'Визиты', group: 'clinical', path: '/crm/schedule' },
  { from: 'clinical-case', to: 'lab-order', label: 'Зуботехническая лаборатория', group: 'clinical', path: '/crm/lab' },
  { from: 'clinical-case', to: 'material', label: 'Материалы', group: 'clinical', path: '/shop' },
  { from: 'clinical-case', to: 'invoice', label: 'Финансы', group: 'operations', path: '/crm/cashier' },
  { from: 'clinical-case', to: 'organization', label: 'Рабочий контекст', group: 'operations', path: '/settings' },
  { from: 'diagnostic-referral', to: 'diagnostic-result', label: 'Результат', group: 'operations', path: '/diagnostics' },
  { from: 'diagnostic-result', to: 'clinical-case', label: 'В клинический кейс', group: 'clinical', path: '/crm/cases' },
  { from: 'medical-analysis', to: 'clinical-case', label: 'В клинический кейс', group: 'clinical', path: '/crm/cases' },
  { from: 'lab-order', to: 'clinical-case', label: 'Клинический кейс', group: 'clinical', path: '/crm/cases' },
  { from: 'material', to: 'supplier-order', label: 'Заказ поставщику', group: 'operations', path: '/shop' },
  { from: 'material', to: 'clinical-case', label: 'Использовать в кейсе', group: 'clinical', path: '/crm/cases' },
  { from: 'invoice', to: 'clinical-case', label: 'Клинический кейс', group: 'operations', path: '/crm/cases' },
  { from: 'course', to: 'clinical-case', label: 'Обучение → практика', group: 'growth', path: '/school' },
  { from: 'job', to: 'organization', label: 'Карьера → работа', group: 'growth', path: '/jobs' },
];

export function relationsFrom(node: EcosystemNodeId) {
  return ECOSYSTEM_RELATIONS.filter(relation => relation.from === node);
}

export function relationTargets(node: EcosystemNodeId, group?: EcosystemRelationGroup) {
  return ECOSYSTEM_RELATIONS.filter(relation => relation.from === node && (!group || relation.group === group));
}
