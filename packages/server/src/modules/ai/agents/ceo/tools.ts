import { AgentTool } from '../interfaces.js';

export const CEO_TOOLS: AgentTool[] = [
  {
    name: 'getDailySummary',
    description: 'Формирование ежедневной сводки по ключевым показателям клиники',
    parameters: {
      date: { type: 'string', description: 'Дата (YYYY-MM-DD)', required: false },
    },
    destructive: false,
  },
  {
    name: 'getRevenueChart',
    description: 'Получение данных о выручке за период для построения графика',
    parameters: {
      startDate: { type: 'string', description: 'Дата начала (YYYY-MM-DD)', required: true },
      endDate: { type: 'string', description: 'Дата окончания (YYYY-MM-DD)', required: true },
      granularity: { type: 'string', description: 'Гранулярность', required: false, enum: ['day', 'week', 'month'] },
    },
    destructive: false,
  },
  {
    name: 'getPatientGrowth',
    description: 'Анализ роста пациентской базы за период',
    parameters: {
      startDate: { type: 'string', description: 'Дата начала (YYYY-MM-DD)', required: true },
      endDate: { type: 'string', description: 'Дата окончания (YYYY-MM-DD)', required: true },
    },
    destructive: false,
  },
  {
    name: 'getDoctorPerformance',
    description: 'Оценка эффективности врачей по ключевым метрикам',
    parameters: {
      startDate: { type: 'string', description: 'Дата начала (YYYY-MM-DD)', required: true },
      endDate: { type: 'string', description: 'Дата окончания (YYYY-MM-DD)', required: true },
      doctorId: { type: 'string', description: 'ID конкретного врача', required: false },
    },
    destructive: false,
  },
];
