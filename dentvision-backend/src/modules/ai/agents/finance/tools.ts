import { AgentTool } from '../interfaces.js';

export const FINANCE_TOOLS: AgentTool[] = [
  {
    name: 'getRevenue',
    description: 'Получение данных о выручке за указанный период',
    parameters: {
      startDate: { type: 'string', description: 'Дата начала (YYYY-MM-DD)', required: true },
      endDate: { type: 'string', description: 'Дата окончания (YYYY-MM-DD)', required: true },
    },
    destructive: false,
  },
  {
    name: 'getDebts',
    description: 'Получение списка задолженностей пациентов',
    parameters: {
      overdueOnly: { type: 'boolean', description: 'Только просроченные', required: false },
    },
    destructive: false,
  },
  {
    name: 'createInvoice',
    description: 'Создание счёта для пациента',
    parameters: {
      patientId: { type: 'string', description: 'ID пациента', required: true },
      amount: { type: 'number', description: 'Сумма счёта', required: true },
      description: { type: 'string', description: 'Описание услуг', required: true },
    },
    destructive: false,
  },
  {
    name: 'getFinancialReport',
    description: 'Генерация финансового отчёта за период',
    parameters: {
      startDate: { type: 'string', description: 'Дата начала (YYYY-MM-DD)', required: true },
      endDate: { type: 'string', description: 'Дата окончания (YYYY-MM-DD)', required: true },
      type: { type: 'string', description: 'Тип отчёта', required: false, enum: ['summary', 'detailed', 'forecast'] },
    },
    destructive: false,
  },
];
