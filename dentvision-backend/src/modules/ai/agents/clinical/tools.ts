import { AgentTool } from '../interfaces.js';

export const CLINICAL_TOOLS: AgentTool[] = [
  {
    name: 'analyzeSymptoms',
    description: 'Анализ симптомов пациента и формулирование предварительных предположений',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      symptoms: { type: 'string', description: 'Описание симптомов', required: true },
      duration: { type: 'string', description: 'Длительность симптомов', required: false },
    },
    destructive: false,
  },
  {
    name: 'recommendExams',
    description: 'Рекомендация необходимых обследований на основе жалоб',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      complaintType: { type: 'string', description: 'Тип жалобы', required: true },
    },
    destructive: false,
  },
  {
    name: 'getPatientHistory',
    description: 'Получение полной медицинской истории пациента',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
    },
    destructive: false,
  },
  {
    name: 'checkContraindications',
    description: 'Проверка противопоказаний к рекомендуемым процедурам',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      procedureType: { type: 'string', description: 'Тип процедуры', required: true },
    },
    destructive: false,
  },
];
