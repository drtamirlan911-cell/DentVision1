import { AgentTool } from '../interfaces.js';

export const DOCUMENTATION_TOOLS: AgentTool[] = [
  {
    name: 'generateMedicalRecord',
    description: 'Генерация медицинской записи на основе данных о лечении',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      appointmentId: { type: 'string', description: 'ID приёма', required: true },
      doctorId: { type: 'string', description: 'ID врача', required: true },
      treatmentData: { type: 'string', description: 'Данные о проведённом лечении', required: true },
    },
    destructive: false,
  },
  {
    name: 'createTreatmentPlan',
    description: 'Создание плана лечения на основе диагноза',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      diagnosis: { type: 'string', description: 'Поставленный диагноз', required: true },
      procedures: { type: 'string', description: 'Список рекомендуемых процедур', required: true },
    },
    destructive: false,
  },
  {
    name: 'generateConsent',
    description: 'Формирование согласия пациента на процедуру',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      procedureType: { type: 'string', description: 'Тип процедуры', required: true },
    },
    destructive: false,
  },
  {
    name: 'generatePrescription',
    description: 'Создание рецепта или назначения',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      medications: { type: 'string', description: 'Названия и дозировки препаратов', required: true },
      instructions: { type: 'string', description: 'Инструкции по приёму', required: false },
    },
    destructive: false,
  },
];
