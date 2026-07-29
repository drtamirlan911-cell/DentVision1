import { AgentTool } from '../interfaces.js';

export const FOLLOWUP_TOOLS: AgentTool[] = [
  {
    name: 'sendFollowUpMessage',
    description: 'Отправить сообщение пациенту с напоминанием о контроле',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      message: { type: 'string', description: 'Текст сообщения', required: true },
      channel: { type: 'string', description: 'Канал связи', required: false, enum: ['sms', 'whatsapp', 'telegram'] },
    },
    destructive: false,
  },
  {
    name: 'getTreatmentHistory',
    description: 'Получить историю лечения пациента',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
    },
    destructive: false,
  },
  {
    name: 'notifyDoctor',
    description: 'Уведомить врача о жалобах пациента',
    parameters: {
      doctorId: { type: 'string', description: 'ID врача', required: true },
      patientId: { type: 'string', description: 'ID пациента', required: true },
      complaint: { type: 'string', description: 'Описание жалобы', required: true },
    },
    destructive: false,
  },
  {
    name: 'scheduleFollowUp',
    description: 'Запланировать следующий контрольный визит',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      date: { type: 'string', description: 'Дата визита (YYYY-MM-DD)', required: true },
      reason: { type: 'string', description: 'Причина визита', required: false },
    },
    destructive: false,
  },
];
