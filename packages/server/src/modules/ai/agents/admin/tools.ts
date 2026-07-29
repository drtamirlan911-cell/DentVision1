import { AgentTool } from '../interfaces.js';

export const ADMIN_TOOLS: AgentTool[] = [
  {
    name: 'manageSchedule',
    description: 'Просмотр и управление расписанием врачей и кабинетов',
    parameters: {
      doctorId: { type: 'string', description: 'ID врача', required: false },
      date: { type: 'string', description: 'Дата (YYYY-MM-DD)', required: false },
      action: { type: 'string', description: 'Действие', required: true, enum: ['view', 'update', 'block'] },
    },
    destructive: false,
  },
  {
    name: 'getStaffList',
    description: 'Получение списка персонала с ролями и статусами',
    parameters: {
      role: { type: 'string', description: 'Фильтр по роли', required: false },
      activeOnly: { type: 'boolean', description: 'Только активные сотрудники', required: false },
    },
    destructive: false,
  },
  {
    name: 'getAuditLog',
    description: 'Просмотр журнала аудита действий в системе',
    parameters: {
      startDate: { type: 'string', description: 'Дата начала (YYYY-MM-DD)', required: false },
      endDate: { type: 'string', description: 'Дата окончания (YYYY-MM-DD)', required: false },
      userId: { type: 'string', description: 'ID пользователя', required: false },
    },
    destructive: false,
  },
  {
    name: 'manageRoles',
    description: 'Управление ролями и доступами персонала',
    parameters: {
      userId: { type: 'string', description: 'ID пользователя', required: true },
      role: { type: 'string', description: 'Новая роль', required: true },
    },
    destructive: false,
  },
];
