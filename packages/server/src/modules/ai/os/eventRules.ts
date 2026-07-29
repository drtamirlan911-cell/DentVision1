/**
 * Event Rules — mapping CRM events → AI agent actions.
 *
 * Each rule defines:
 *  - which CRM event triggers it
 *  - which AI agents should act
 *  - what actions to perform
 *  - priority (critical > high > medium > low)
 */

import { EventType } from '../../events/EventTypes.js';

export type EventActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface EventRule {
  id: string;
  name: string;
  event: EventType;
  /** Additional conditions beyond event type (optional). */
  conditions?: (payload: Record<string, unknown>) => boolean;
  actions: EventRuleAction[];
  priority: EventActionPriority;
  enabled: boolean;
}

export interface EventRuleAction {
  /** Agent persona or domain to invoke. */
  agent: string;
  /** Action identifier for eventActions.ts. */
  action: string;
  /** Timeout in ms for this action. */
  timeout?: number;
  /** Whether to run in parallel with other actions in the same rule. */
  parallel?: boolean;
}

// ─── Rules ───

export const EVENT_RULES: EventRule[] = [
  // ─── Patient Events ───
  {
    id: 'rule-patient-created',
    name: 'Новый пациент — анализ жалоб',
    event: EventType.PatientCreated,
    conditions: (payload) => Boolean(payload.complaints && (payload.complaints as string[]).length > 0),
    actions: [
      { agent: 'doctor', action: 'analyzeComplaints', timeout: 15000 },
      { agent: 'doctor', action: 'recommendExams', timeout: 10000, parallel: true },
    ],
    priority: 'high',
    enabled: true,
  },
  {
    id: 'rule-patient-arrived',
    name: 'Пациент пришёл — уведомить врача',
    event: EventType.PatientArrived,
    actions: [
      { agent: 'doctor', action: 'notifyDoctorPatientArrived', timeout: 5000 },
    ],
    priority: 'high',
    enabled: true,
  },
  {
    id: 'rule-patient-noshow',
    name: 'Пациент не пришёл — отметить',
    event: EventType.PatientNoShow,
    actions: [
      { agent: 'reception', action: 'handleNoShow', timeout: 5000 },
    ],
    priority: 'medium',
    enabled: true,
  },

  // ─── Appointment Events ───
  {
    id: 'rule-appointment-booked',
    name: 'Новая запись — напоминание',
    event: EventType.AppointmentBooked,
    actions: [
      { agent: 'reception', action: 'scheduleReminder', timeout: 5000 },
    ],
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'rule-appointment-cancelled',
    name: 'Отмена записи — освободить слот',
    event: EventType.AppointmentCancelled,
    actions: [
      { agent: 'reception', action: 'handleCancellation', timeout: 5000 },
    ],
    priority: 'medium',
    enabled: true,
  },

  // ─── Medical Events ───
  {
    id: 'rule-complaint-updated',
    name: 'Обновление жалоб — реанализ',
    event: EventType.ComplaintUpdated,
    actions: [
      { agent: 'doctor', action: 'analyzeComplaints', timeout: 15000 },
    ],
    priority: 'high',
    enabled: true,
  },
  {
    id: 'rule-xray-uploaded',
    name: 'Загружен снимок — анализ',
    event: EventType.XrayUploaded,
    actions: [
      { agent: 'doctor', action: 'analyzeXray', timeout: 20000 },
    ],
    priority: 'high',
    enabled: true,
  },
  {
    id: 'rule-diagnosis-saved',
    name: 'Диагноз — рекомендации + проверка материалов',
    event: EventType.DiagnosisSaved,
    actions: [
      { agent: 'doctor', action: 'generateTreatmentRecommendations', timeout: 15000, parallel: true },
      { agent: 'supply', action: 'checkRequiredMaterials', timeout: 10000, parallel: true },
    ],
    priority: 'high',
    enabled: true,
  },
  {
    id: 'rule-treatment-completed',
    name: 'Лечение завершено — документация + follow-up',
    event: EventType.TreatmentCompleted,
    actions: [
      { agent: 'doctor', action: 'generateMedicalDocumentation', timeout: 20000, parallel: true },
      { agent: 'reception', action: 'scheduleFollowUp', timeout: 10000, parallel: true },
    ],
    priority: 'high',
    enabled: true,
  },

  // ─── Billing Events ───
  {
    id: 'rule-invoice-created',
    name: 'Счёт создан — уведомление',
    event: EventType.InvoiceCreated,
    actions: [
      { agent: 'finance', action: 'notifyInvoiceCreated', timeout: 5000 },
    ],
    priority: 'low',
    enabled: true,
  },
  {
    id: 'rule-payment-received',
    name: 'Оплата получена — обновление',
    event: EventType.PaymentReceived,
    actions: [
      { agent: 'finance', action: 'handlePaymentReceived', timeout: 5000 },
    ],
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'rule-payment-overdue',
    name: 'Просрочка — напоминание',
    event: EventType.PaymentOverdue,
    actions: [
      { agent: 'finance', action: 'handlePaymentOverdue', timeout: 5000 },
    ],
    priority: 'high',
    enabled: true,
  },

  // ─── Inventory Events ───
  {
    id: 'rule-inventory-low',
    name: 'Мало на складе — закупка',
    event: EventType.InventoryLow,
    actions: [
      { agent: 'supply', action: 'handleLowInventory', timeout: 10000 },
    ],
    priority: 'high',
    enabled: true,
  },

  // ─── Lab Events ───
  {
    id: 'rule-lab-order-created',
    name: 'Лабораторный заказ — уведомление',
    event: EventType.LabOrderCreated,
    actions: [
      { agent: 'doctor', action: 'notifyLabOrder', timeout: 5000 },
    ],
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'rule-lab-order-completed',
    name: 'Лабораторный заказ готов — врачу',
    event: EventType.LabOrderCompleted,
    actions: [
      { agent: 'doctor', action: 'notifyLabOrderReady', timeout: 5000 },
    ],
    priority: 'high',
    enabled: true,
  },

  // ─── Cron Events ───
  {
    id: 'rule-daily-summary',
    name: 'Ежедневный отчёт директору',
    event: EventType.DailySummary,
    actions: [
      { agent: 'ceo', action: 'generateDailySummary', timeout: 30000 },
    ],
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'rule-followup-due',
    name: 'Контрольный звонок пациенту',
    event: EventType.FollowUpDue,
    actions: [
      { agent: 'reception', action: 'sendFollowUp', timeout: 10000 },
    ],
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'rule-appointment-reminder',
    name: 'Напоминание о записи',
    event: EventType.AppointmentReminder,
    actions: [
      { agent: 'reception', action: 'sendAppointmentReminder', timeout: 10000 },
    ],
    priority: 'low',
    enabled: true,
  },
];

// ─── Matching ───

export function matchEventRules(event: EventType, payload: Record<string, unknown>): EventRule[] {
  return EVENT_RULES.filter(
    (rule) =>
      rule.enabled &&
      rule.event === event &&
      (!rule.conditions || rule.conditions(payload))
  );
}

export function getRuleById(id: string): EventRule | undefined {
  return EVENT_RULES.find((r) => r.id === id);
}
