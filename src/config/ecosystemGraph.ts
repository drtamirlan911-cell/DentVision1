import type { EcosystemParticipant, EcosystemServiceId } from './ecosystem';

export type EcosystemNodeId =
  | 'person' | 'organization' | 'branch' | 'patient' | 'clinical-case' | 'diagnostic-referral'
  | 'diagnostic-result' | 'medical-analysis' | 'lab-order' | 'material' | 'supplier-order'
  | 'appointment' | 'treatment-plan' | 'invoice' | 'course' | 'job';

export interface EcosystemGraphNode {
  id: EcosystemNodeId;
  label: string;
  description: string;
  service: EcosystemServiceId;
  participants: EcosystemParticipant[];
}

export interface EcosystemGraphEdge {
  from: EcosystemNodeId;
  to: EcosystemNodeId;
  label: string;
  relation: 'contains' | 'supports' | 'produces' | 'requires' | 'connects' | 'settles';
  bidirectional?: boolean;
}

export const ECOSYSTEM_GRAPH_NODES: readonly EcosystemGraphNode[] = [
  { id: 'person', label: 'Person', description: 'Единая идентичность участника', service: 'network', participants: ['patient','professional','student','lecturer','employer','job_seeker','community'] },
  { id: 'organization', label: 'Organization', description: 'Организация и её рабочие контуры', service: 'administration', participants: ['clinic','diagnostic_center','medical_laboratory','dental_laboratory','supplier','academy'] },
  { id: 'branch', label: 'Branch', description: 'Филиал внутри организации', service: 'administration', participants: ['clinic'] },
  { id: 'patient', label: 'Patient', description: 'Пациент и его разрешённый клинический контекст', service: 'practice', participants: ['patient','professional','clinic'] },
  { id: 'clinical-case', label: 'Clinical Case', description: 'Центральный объект лечения', service: 'practice', participants: ['professional','clinic','patient'] },
  { id: 'diagnostic-referral', label: 'Diagnostic Referral', description: 'Направление на исследование', service: 'diagnostics', participants: ['professional','clinic','diagnostic_center','patient'] },
  { id: 'diagnostic-result', label: 'Diagnostic Result', description: 'Результат исследования', service: 'diagnostics', participants: ['professional','clinic','diagnostic_center','patient'] },
  { id: 'medical-analysis', label: 'Medical Analysis', description: 'Медицинский лабораторный результат', service: 'medical-laboratory', participants: ['professional','clinic','medical_laboratory','patient'] },
  { id: 'lab-order', label: 'Dental Lab Order', description: 'Зуботехнический производственный заказ', service: 'dental-laboratory', participants: ['professional','clinic','dental_laboratory'] },
  { id: 'material', label: 'Material', description: 'Материал или оборудование из Market', service: 'market', participants: ['professional','clinic','supplier'] },
  { id: 'supplier-order', label: 'Supplier Order', description: 'Закупка у поставщика', service: 'market', participants: ['clinic','supplier'] },
  { id: 'appointment', label: 'Appointment', description: 'Запланированный визит', service: 'practice', participants: ['patient','professional','clinic'] },
  { id: 'treatment-plan', label: 'Treatment Plan', description: 'План и этапы лечения', service: 'practice', participants: ['professional','clinic','patient'] },
  { id: 'invoice', label: 'Invoice', description: 'Финансовое обязательство и settlement', service: 'finance', participants: ['clinic','diagnostic_center','medical_laboratory','dental_laboratory','supplier','academy','patient'] },
  { id: 'course', label: 'Course', description: 'Образовательный контент', service: 'academy', participants: ['academy','lecturer','student','professional'] },
  { id: 'job', label: 'Job', description: 'Вакансия и карьерная возможность', service: 'jobs', participants: ['employer','job_seeker','professional'] },
];

export const ECOSYSTEM_GRAPH_EDGES: readonly EcosystemGraphEdge[] = [
  { from: 'person', to: 'organization', label: 'участник', relation: 'connects', bidirectional: true },
  { from: 'organization', to: 'branch', label: 'содержит', relation: 'contains' },
  { from: 'branch', to: 'patient', label: 'ведёт', relation: 'contains' },
  { from: 'patient', to: 'clinical-case', label: 'имеет', relation: 'contains' },
  { from: 'clinical-case', to: 'diagnostic-referral', label: 'требует диагностику', relation: 'requires' },
  { from: 'diagnostic-referral', to: 'diagnostic-result', label: 'производит', relation: 'produces' },
  { from: 'diagnostic-result', to: 'clinical-case', label: 'возвращается в кейс', relation: 'supports' },
  { from: 'clinical-case', to: 'medical-analysis', label: 'использует', relation: 'supports' },
  { from: 'clinical-case', to: 'treatment-plan', label: 'формирует', relation: 'contains' },
  { from: 'treatment-plan', to: 'appointment', label: 'планирует', relation: 'requires' },
  { from: 'clinical-case', to: 'lab-order', label: 'передаёт в лабораторию', relation: 'requires' },
  { from: 'clinical-case', to: 'material', label: 'требует материал', relation: 'requires' },
  { from: 'material', to: 'supplier-order', label: 'закупается', relation: 'requires' },
  { from: 'clinical-case', to: 'invoice', label: 'создаёт экономический контур', relation: 'settles' },
  { from: 'diagnostic-referral', to: 'invoice', label: 'расчёт', relation: 'settles' },
  { from: 'lab-order', to: 'invoice', label: 'расчёт', relation: 'settles' },
  { from: 'supplier-order', to: 'invoice', label: 'расчёт', relation: 'settles' },
  { from: 'person', to: 'course', label: 'обучается', relation: 'supports' },
  { from: 'person', to: 'job', label: 'карьера', relation: 'connects' },
  { from: 'course', to: 'clinical-case', label: 'знания → практика', relation: 'supports' },
  { from: 'job', to: 'organization', label: 'найм → рабочий контекст', relation: 'connects' },
];

export const CLINICAL_WORKFLOW: EcosystemNodeId[] = [
  'patient', 'clinical-case', 'diagnostic-referral', 'diagnostic-result', 'treatment-plan',
  'appointment', 'lab-order', 'material', 'invoice',
];

export function graphNode(id: EcosystemNodeId) {
  return ECOSYSTEM_GRAPH_NODES.find(node => node.id === id);
}

export function graphNeighbors(id: EcosystemNodeId) {
  return ECOSYSTEM_GRAPH_EDGES
    .filter(edge => edge.from === id || edge.to === id)
    .map(edge => edge.from === id ? edge.to : edge.from);
}
