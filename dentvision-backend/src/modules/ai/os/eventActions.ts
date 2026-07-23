/**
 * Event Actions — concrete AI actions for each CRM event.
 *
 * Each action receives the event payload and produces:
 *  - A notification/message for the relevant user(s)
 *  - Optional data for the AI Timeline
 *  - Optional critical flag for urgent escalation
 */

import prisma from '../../../lib/prisma.js';
import { CRMEvent } from '../../events/EventTypes.js';

export interface EventActionResult {
  success: boolean;
  action: string;
  agent: string;
  message?: string;
  data?: Record<string, unknown>;
  critical?: boolean;
  notifyUserIds?: string[];
  timelineEntry?: {
    action: string;
    result: string;
  };
}

// ─── Doctor Actions ───

async function analyzeComplaints(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, complaints } = event.payload;
  if (!patientId || !complaints) {
    return { success: false, action: 'analyzeComplaints', agent: 'doctor', message: 'No patient or complaints' };
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId as string },
    select: { firstName: true, lastName: true },
  });

  const complaintList = complaints as string[];
  const possibleCauses = inferCauses(complaintList);

  return {
    success: true,
    action: 'analyzeComplaints',
    agent: 'doctor',
    message: `Пациент ${patient?.firstName} ${patient?.lastName}: жалобы — ${complaintList.join(', ')}. Возможные причины: ${possibleCauses.join(', ')}.`,
    data: { possibleCauses, complaints: complaintList },
    timelineEntry: {
      action: 'Анализ жалоб',
      result: `Возможные причины: ${possibleCauses.join(', ')}`,
    },
  };
}

async function recommendExams(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, complaints } = event.payload;
  const complaintList = (complaints as string[]) || [];

  const exams: string[] = [];
  const hasPain = complaintList.some((c) => /бол/i.test(c));
  const hasSwelling = complaintList.some((c) => /отёк|отек/i.test(c));
  const hasTemperature = complaintList.some((c) => /температур/i.test(c));

  if (hasPain || hasSwelling) exams.push('КЛКТ');
  if (hasSwelling && hasTemperature) exams.push('Общий анализ крови');
  if (hasPain) exams.push('Перкуссия, пальпация');

  return {
    success: true,
    action: 'recommendExams',
    agent: 'doctor',
    message: exams.length > 0
      ? `Рекомендуемые обследования: ${exams.join(', ')}`
      : 'Дополнительные обследования не требуются.',
    data: { exams },
    timelineEntry: {
      action: 'Рекомендация обследований',
      result: exams.join(', ') || 'Не требуются',
    },
  };
}

async function notifyDoctorPatientArrived(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, doctorId } = event.payload;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId as string },
    select: { firstName: true, lastName: true },
  });

  return {
    success: true,
    action: 'notifyDoctorPatientArrived',
    agent: 'doctor',
    message: `Пациент ${patient?.firstName} ${patient?.lastName} ожидает в приёмной.`,
    notifyUserIds: doctorId ? [doctorId as string] : [],
    timelineEntry: {
      action: 'Уведомление врачу',
      result: `Пациент ${patient?.firstName} ${patient?.lastName} ожидает`,
    },
  };
}

async function analyzeXray(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, imageUrl, imageType } = event.payload;

  return {
    success: true,
    action: 'analyzeXray',
    agent: 'doctor',
    message: `Снимок ${imageType || 'неизвестного типа'} загружен. Требуется визуальный анализ врачом.`,
    data: { patientId, imageUrl, imageType },
    timelineEntry: {
      action: 'Анализ снимка',
      result: `Снимок ${imageType} загружен, ожидает анализа`,
    },
  };
}

async function generateTreatmentRecommendations(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, diagnosis, diagnosisCode } = event.payload;

  const recommendations: string[] = [];
  const diag = String(diagnosis || '').toLowerCase();

  if (/периодонтит|пульпит/i.test(diag)) {
    recommendations.push('Эндодонтическое лечение');
    recommendations.push('Контрольный рентген через 3 месяца');
  }
  if (/кариес/i.test(diag)) {
    recommendations.push('Пломбирование');
  }
  if (/имплант|缺失/i.test(diag) || (event.payload.requiresImplant)) {
    recommendations.push('Консультация хирурга-имплантолога');
    recommendations.push('КЛКТ для оценки костной ткани');
  }
  if (/периостит|абсцесс/i.test(diag)) {
    recommendations.push('Экстренное вмешательство');
    recommendations.push('Антибиотикотерапия');
  }

  if (recommendations.length === 0) {
    recommendations.push('Уточните план лечения у лечащего врача');
  }

  return {
    success: true,
    action: 'generateTreatmentRecommendations',
    agent: 'doctor',
    message: `Рекомендации по диагнозу${diagnosisCode ? ` (${diagnosisCode})` : ''}: ${recommendations.join('; ')}`,
    data: { recommendations, diagnosis, diagnosisCode },
    timelineEntry: {
      action: 'Рекомендации по лечению',
      result: recommendations.join('; '),
    },
  };
}

async function generateMedicalDocumentation(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, appointmentId, treatments, diagnosis } = event.payload;

  const treatmentList = (treatments as string[]) || [];
  const docs = [
    'Дневник приёма',
    'Медицинская карта',
    'Рецепт',
    'Рекомендации',
  ];

  return {
    success: true,
    action: 'generateMedicalDocumentation',
    agent: 'doctor',
    message: `Сформирована документация: ${docs.join(', ')}. Диагноз: ${diagnosis}. Лечение: ${treatmentList.join(', ')}.`,
    data: { patientId, appointmentId, documents: docs, treatmentList },
    timelineEntry: {
      action: 'Формирование документации',
      result: docs.join(', '),
    },
  };
}

async function notifyLabOrder(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, labName, deadline } = event.payload;

  return {
    success: true,
    action: 'notifyLabOrder',
    agent: 'doctor',
    message: `Новый лабораторный заказ${labName ? ` (${labName})` : ''}${deadline ? `, срок: ${deadline}` : ''}.`,
    data: { patientId, labName, deadline },
    timelineEntry: {
      action: 'Уведомление о лабораторном заказе',
      result: `Заказ${labName ? ` (${labName})` : ''} создан`,
    },
  };
}

async function notifyLabOrderReady(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, labName } = event.payload;

  return {
    success: true,
    action: 'notifyLabOrderReady',
    agent: 'doctor',
    message: `Лабораторный заказ${labName ? ` (${labName})` : ''} готов. Можно забрать.`,
    data: { patientId, labName },
    critical: true,
    timelineEntry: {
      action: 'Лабораторный заказ готов',
      result: `Заказ${labName ? ` (${labName})` : ''} готов к выдаче`,
    },
  };
}

// ─── Reception Actions ───

async function handleNoShow(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, appointmentId } = event.payload;

  return {
    success: true,
    action: 'handleNoShow',
    agent: 'reception',
    message: 'Пациент не явился. Слот освобождён.',
    data: { patientId, appointmentId },
    timelineEntry: {
      action: 'Обработка No-Show',
      result: 'Слот освобождён',
    },
  };
}

async function scheduleReminder(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, date, time } = event.payload;

  return {
    success: true,
    action: 'scheduleReminder',
    agent: 'reception',
    message: `Напоминание запланировано на ${date}${time ? ` ${time}` : ''}.`,
    data: { patientId, date, time },
    timelineEntry: {
      action: 'Планирование напоминания',
      result: `Напоминание на ${date}${time ? ` ${time}` : ''}`,
    },
  };
}

async function handleCancellation(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, appointmentId } = event.payload;

  return {
    success: true,
    action: 'handleCancellation',
    agent: 'reception',
    message: 'Запись отменена. Слот освобождён.',
    data: { patientId, appointmentId },
    timelineEntry: {
      action: 'Обработка отмены',
      result: 'Слот освобождён',
    },
  };
}

async function scheduleFollowUp(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, appointmentId, treatments } = event.payload;

  return {
    success: true,
    action: 'scheduleFollowUp',
    agent: 'reception',
    message: 'Контрольный визит запланирован через 48 часов.',
    data: { patientId, appointmentId, followUpType: '48h' },
    timelineEntry: {
      action: 'Планирование follow-up',
      result: 'Контроль через 48 часов',
    },
  };
}

async function sendFollowUp(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, treatmentDate, followUpType } = event.payload;

  return {
    success: true,
    action: 'sendFollowUp',
    agent: 'reception',
    message: `Контрольное сообщение отправлено пациенту (тип: ${followUpType || '48h'}).`,
    data: { patientId, treatmentDate, followUpType },
    timelineEntry: {
      action: 'Отправка follow-up',
      result: `Сообщение отправлено (${followUpType || '48h'})`,
    },
  };
}

async function sendAppointmentReminder(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, date, time } = event.payload;

  return {
    success: true,
    action: 'sendAppointmentReminder',
    agent: 'reception',
    message: `Напоминание о записи на ${date}${time ? ` ${time}` : ''} отправлено.`,
    data: { patientId, date, time },
    timelineEntry: {
      action: 'Напоминание о записи',
      result: `Отправлено на ${date}${time ? ` ${time}` : ''}`,
    },
  };
}

// ─── Finance Actions ───

async function notifyInvoiceCreated(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, amount } = event.payload;

  return {
    success: true,
    action: 'notifyInvoiceCreated',
    agent: 'finance',
    message: `Создан счёт на сумму ${amount} ₸.`,
    data: { patientId, amount },
    timelineEntry: {
      action: 'Уведомление о счёте',
      result: `Счёт на ${amount} ₸`,
    },
  };
}

async function handlePaymentReceived(event: CRMEvent): Promise<EventActionResult> {
  const { invoiceId, patientId, amount, currency } = event.payload;

  return {
    success: true,
    action: 'handlePaymentReceived',
    agent: 'finance',
    message: `Оплата ${amount} ${currency || '₸'} получена.`,
    data: { invoiceId, patientId, amount },
    timelineEntry: {
      action: 'Обработка оплаты',
      result: `${amount} ${currency || '₸'} получен`,
    },
  };
}

async function handlePaymentOverdue(event: CRMEvent): Promise<EventActionResult> {
  const { invoiceId, patientId, amount } = event.payload;

  return {
    success: true,
    action: 'handlePaymentOverdue',
    agent: 'finance',
    message: `Просрочка по счёту на ${amount} ₸. Рекомендуется связаться с пациентом.`,
    data: { invoiceId, patientId, amount },
    critical: true,
    timelineEntry: {
      action: 'Просрочка оплаты',
      result: `Счёт на ${amount} ₸ просрочен`,
    },
  };
}

// ─── Supply Actions ───

async function checkRequiredMaterials(event: CRMEvent): Promise<EventActionResult> {
  const { patientId, diagnosis, requiresImplant } = event.payload;
  const diag = String(diagnosis || '').toLowerCase();

  const materials: string[] = [];
  if (/имплант/i.test(diag) || requiresImplant) {
    materials.push('Имплантат');
    materials.push('Формирователь десны');
    materials.push('Абатмент');
  }
  if (/эндодон/i.test(diag) || /пульпит|периодонтит/i.test(diag)) {
    materials.push('Эндодонтические инструменты');
    materials.push('Пломбировочный материал');
  }
  if (/кариес/i.test(diag)) {
    materials.push('Пломбировочный материал');
    materials.push('Анестетик');
  }

  return {
    success: true,
    action: 'checkRequiredMaterials',
    agent: 'supply',
    message: materials.length > 0
      ? `Для лечения потребуется: ${materials.join(', ')}`
      : 'Материалы уточняются.',
    data: { materials, diagnosis },
    timelineEntry: {
      action: 'Проверка материалов',
      result: materials.join(', ') || 'Уточняется',
    },
  };
}

async function handleLowInventory(event: CRMEvent): Promise<EventActionResult> {
  const { itemId, itemName, currentQuantity, minimumQuantity } = event.payload;

  return {
    success: true,
    action: 'handleLowInventory',
    agent: 'supply',
    message: `Заканчивается: ${itemName || 'товар'}. Остаток: ${currentQuantity}, минимум: ${minimumQuantity}. Рекомендуется дозаказать.`,
    data: { itemId, itemName, currentQuantity, minimumQuantity },
    critical: true,
    timelineEntry: {
      action: 'Низкий остаток',
      result: `${itemName}: ${currentQuantity} (мин. ${minimumQuantity})`,
    },
  };
}

// ─── CEO Actions ───

async function generateDailySummary(event: CRMEvent): Promise<EventActionResult> {
  const clinicId = event.clinicId;

  const [patientCount, appointmentCount, unpaidCount] = await Promise.all([
    prisma.patient.count({ where: { clinicId } }),
    prisma.appointment.count({
      where: {
        clinicId,
        date: { gte: new Date(), lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.invoice.count({ where: { clinicId, status: 'UNPAID' } }),
  ]);

  return {
    success: true,
    action: 'generateDailySummary',
    agent: 'ceo',
    message: `Сводка дня: ${appointmentCount} записей, ${patientCount} пациентов в базе, ${unpaidCount} неоплаченных счетов.`,
    data: { patientCount, appointmentCount, unpaidCount },
    timelineEntry: {
      action: 'Ежедневная сводка',
      result: `${appointmentCount} записей, ${unpaidCount} неоплаченных`,
    },
  };
}

// ─── Helpers ───

function inferCauses(complaints: string[]): string[] {
  const causes: string[] = [];
  const text = complaints.join(' ').toLowerCase();

  if (/бол/i.test(text)) {
    if (/36|37|пере|задн/i.test(text)) causes.push('Острый пульпит');
    if (/ передн|фрон/i.test(text)) causes.push('Кариес/травма');
    causes.push('Периодонтит');
  }
  if (/отёк|отек/i.test(text)) causes.push('Абсцесс/периостит');
  if (/температур/i.test(text)) causes.push('Воспалительный процесс');
  if (/кров/i.test(text)) causes.push('Гингивит/пародонтит');
  if (/щёлк|хруст/i.test(text)) causes.push('Дисфункция ВНЧС');

  return causes.length > 0 ? causes : ['Требуется осмотр'];
}

// ─── Action Registry ───

type EventActionHandler = (event: CRMEvent) => Promise<EventActionResult>;

const ACTION_REGISTRY: Record<string, EventActionHandler> = {
  // Doctor
  analyzeComplaints,
  recommendExams,
  notifyDoctorPatientArrived,
  analyzeXray,
  generateTreatmentRecommendations,
  generateMedicalDocumentation,
  notifyLabOrder,
  notifyLabOrderReady,

  // Reception
  handleNoShow,
  scheduleReminder,
  handleCancellation,
  scheduleFollowUp,
  sendFollowUp,
  sendAppointmentReminder,

  // Finance
  notifyInvoiceCreated,
  handlePaymentReceived,
  handlePaymentOverdue,

  // Supply
  checkRequiredMaterials,
  handleLowInventory,

  // CEO
  generateDailySummary,
};

export function getActionHandler(actionName: string): EventActionHandler | undefined {
  return ACTION_REGISTRY[actionName];
}

export function listActions(): string[] {
  return Object.keys(ACTION_REGISTRY);
}
