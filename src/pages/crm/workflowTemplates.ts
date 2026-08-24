import type { WorkflowNode, WorkflowTriggerEvent } from '@/utils/api'

/**
 * 15 ready-made automations, one click away from being a real workflow for
 * any clinic. Every condition/notification field here is grounded in the
 * actual event payloads published by the backend (see the `publish(...)`
 * call sites in patients/appointments/diagnostics routes) — a template that
 * referenced a field the event never carries would silently never fire.
 */
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  trigger: WorkflowTriggerEvent
  nodes: WorkflowNode[]
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'new-patient-notify-front-desk',
    name: 'Новый пациент — уведомить регистратуру',
    description: 'Как только в системе появляется новый пациент, администратор и менеджер клиники получают уведомление.',
    trigger: 'patient.created',
    nodes: [
      { type: 'notification', title: 'Новый пациент', message: 'В систему добавлен новый пациент — проверьте и уточните контактные данные.', roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    id: 'new-patient-audit',
    name: 'Новый пациент — запись в аудит',
    description: 'Каждое создание пациента фиксируется отдельной записью в журнале аудита — удобно для отчётности и разбора инцидентов.',
    trigger: 'patient.created',
    nodes: [{ type: 'audit', action: 'patient.created.workflow' }],
  },
  {
    id: 'patient-deleted-notify-owner',
    name: 'Удаление пациента — уведомить владельца',
    description: 'Удаление карты пациента — редкое и чувствительное действие. Владелец клиники сразу узнаёт о нём и может проверить, что это было осознанно.',
    trigger: 'patient.deleted',
    nodes: [
      { type: 'notification', title: 'Пациент удалён', message: 'Из базы удалена карта пациента. Если это были не вы — проверьте действие в журнале аудита.', roles: ['OWNER'] },
    ],
  },
  {
    id: 'patient-deleted-audit',
    name: 'Удаление пациента — запись в аудит',
    description: 'Дополнительная запись в аудит на каждое удаление пациента, независимо от уведомлений — для полной истории.',
    trigger: 'patient.deleted',
    nodes: [{ type: 'audit', action: 'patient.deleted.workflow' }],
  },
  {
    id: 'new-appointment-notify-admin',
    name: 'Новая запись — уведомить администратора',
    description: 'Каждая новая запись на приём сразу видна администратору и менеджеру — не нужно постоянно проверять расписание вручную.',
    trigger: 'appointment.created',
    nodes: [
      { type: 'notification', title: 'Новая запись в расписании', message: 'В расписание добавлена новая запись на приём.', roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    id: 'new-appointment-audit',
    name: 'Новая запись — аудит загрузки расписания',
    description: 'Фиксирует каждую новую запись в журнале аудита — пригодится для анализа загрузки клиники по времени.',
    trigger: 'appointment.created',
    nodes: [{ type: 'audit', action: 'appointment.created.workflow' }],
  },
  {
    id: 'referral-created-notify-owner',
    name: 'Направление создано — уведомить владельца',
    description: 'Владелец клиники узнаёт о каждом новом направлении на диагностику сразу, а не при следующем визите в CRM.',
    trigger: 'referral.created',
    nodes: [
      { type: 'notification', title: 'Направление на диагностику создано', message: 'Оформлено новое направление на диагностику.', roles: ['OWNER'] },
    ],
  },
  {
    id: 'referral-sent-to-center-notify',
    name: 'Направление ушло во внешний центр — уведомить администрацию',
    description: 'Срабатывает только если направление действительно ушло в сторонний диагностический центр (проверяется по полю centerId) — уведомляет владельца и администратора.',
    trigger: 'referral.created',
    nodes: [
      { type: 'condition', field: 'centerId', op: 'exists', value: '' },
      { type: 'notification', title: 'Направление отправлено в диагностический центр', message: 'Направление передано стороннему диагностическому центру.', roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    id: 'referral-draft-reminder',
    name: 'Направление осталось черновиком — напомнить отправить',
    description: 'Если направление создано, но осталось в статусе черновика, владелец и администратор получают напоминание его отправить.',
    trigger: 'referral.created',
    nodes: [
      { type: 'condition', field: 'status', op: 'eq', value: 'DRAFT' },
      { type: 'notification', title: 'Направление не отправлено', message: 'Направление создано, но остаётся черновиком — отправьте его в центр или лабораторию.', roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    id: 'referral-accepted-notify-doctors',
    name: 'Направление принято центром — уведомить врачей',
    description: 'Когда диагностический центр берёт направление в работу, врачи клиники получают уведомление (адресуется всем врачам клиники, а не только направившему — так работает ролевая рассылка).',
    trigger: 'referral.accepted',
    nodes: [
      { type: 'notification', title: 'Направление принято', message: 'Диагностический центр принял направление в работу.', roles: ['DOCTOR'] },
    ],
  },
  {
    id: 'referral-accepted-audit',
    name: 'Направление принято — запись в аудит',
    description: 'Фиксирует момент, когда направление перешло в работу у диагностического центра.',
    trigger: 'referral.accepted',
    nodes: [{ type: 'audit', action: 'referral.accepted.workflow' }],
  },
  {
    id: 'referral-completed-notify-admin',
    name: 'Направление завершено — уведомить администрацию',
    description: 'Диагностика по направлению завершена — владелец и администратор клиники узнают об этом сразу.',
    trigger: 'referral.completed',
    nodes: [
      { type: 'notification', title: 'Направление завершено', message: 'Диагностика по направлению завершена, результат доступен.', roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    id: 'referral-completed-billing-audit',
    name: 'Направление завершено — аудит для биллинга',
    description: 'Отдельная запись в аудит на завершение направления — удобно сверять со счетами и комиссией диагностического центра.',
    trigger: 'referral.completed',
    nodes: [{ type: 'audit', action: 'referral.completed.billing' }],
  },
  {
    id: 'result-ready-notify-doctors',
    name: 'Результат диагностики готов — уведомить врачей',
    description: 'Как только результат прикреплён к направлению, врачи клиники и владелец получают уведомление, что его можно просмотреть.',
    trigger: 'diagnostics.result_ready',
    nodes: [
      { type: 'notification', title: 'Результат диагностики готов', message: 'Результат по направлению доступен для просмотра.', roles: ['DOCTOR', 'OWNER'] },
    ],
  },
  {
    id: 'result-ready-from-center-notify-admin',
    name: 'Результат пришёл из стороннего центра — уведомить администрацию',
    description: 'Срабатывает только для результатов от внешнего диагностического центра (проверяется по полю centerId) — отдельное уведомление владельцу и администратору.',
    trigger: 'diagnostics.result_ready',
    nodes: [
      { type: 'condition', field: 'centerId', op: 'exists', value: '' },
      { type: 'notification', title: 'Результат из диагностического центра', message: 'Поступил результат диагностики от стороннего центра.', roles: ['OWNER', 'ADMIN'] },
    ],
  },
]
