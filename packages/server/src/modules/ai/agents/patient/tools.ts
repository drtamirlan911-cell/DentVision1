import { AgentTool } from '../interfaces.js';

export const PATIENT_TOOLS: AgentTool[] = [
  {
    name: 'getPatientInfo',
    description: 'Получение основной информации о пациенте',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
    },
    destructive: false,
  },
  {
    name: 'getTreatmentHistory',
    description: 'Получение истории лечения пациента',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
    },
    destructive: false,
  },
  {
    name: 'sendMessage',
    description: 'Отправка сообщения пациенту',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      message: { type: 'string', description: 'Текст сообщения', required: true },
      channel: { type: 'string', description: 'Канал связи', required: false, enum: ['sms', 'whatsapp', 'telegram', 'email'] },
    },
    destructive: false,
  },
  {
    name: 'scheduleAppointment',
    description: 'Запись пациента на приём',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      doctorId: { type: 'string', description: 'ID врача', required: true },
      date: { type: 'string', description: 'Дата приёма (YYYY-MM-DD)', required: true },
      time: { type: 'string', description: 'Время приёма (HH:MM)', required: true },
    },
    destructive: false,
  },
];
