import type { AIEmployeeTask } from './AIEmployeeTaskPanel';

export const demoAIEmployeeTasks: AIEmployeeTask[] = [
  {
    id: 'patient-intake-priority',
    title: 'Проверить новый случай пациента',
    description: 'AI подготовил краткий контекст и выделил симптомы для внимания врача.',
    state: 'awaiting_approval',
    priority: 'high',
  },
  {
    id: 'reception-reminder',
    title: 'Контроль ближайшей записи',
    description: 'Проверка необходимости напоминания пациенту.',
    state: 'observing',
    priority: 'normal',
  },
];
