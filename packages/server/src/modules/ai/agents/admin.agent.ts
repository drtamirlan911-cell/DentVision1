import { Agent } from '../core/agent.router.js';
import { AIContext, AIResponse } from '../types/ai.types.js';
import { prisma } from '../../../lib/prisma.js';

export class AdminAgent implements Agent {
  name = 'admin';

  canHandle(intent: string): boolean {
    const adminIntents = [
      'SEARCH_PATIENT',
      'CREATE_APPOINTMENT',
      'UPDATE_APPOINTMENT',
      'CANCEL_APPOINTMENT',
      'ADMIN_USERS',
      'ADMIN_CLINICS',
      'ADMIN_ROLES',
      'ADMIN_BACKUP',
      'ADMIN_AUDIT',
    ];
    return adminIntents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'SEARCH_PATIENT':
      case 'CREATE_APPOINTMENT':
      case 'UPDATE_APPOINTMENT':
      case 'CANCEL_APPOINTMENT':
        return { message: `Админ: ${intent} выполнен`, intent, suggestions: [] };

      case 'ADMIN_USERS':
        return this.manageUsers(context);
      case 'ADMIN_CLINICS':
        return this.manageClinics(context);
      case 'ADMIN_ROLES':
        return this.manageRoles(context);
      case 'ADMIN_BACKUP':
        return this.backup(context);
      case 'ADMIN_AUDIT':
        return this.audit(context);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  private async manageUsers(context: AIContext) {
    const users = await prisma.user.findMany({
      include: { memberships: { include: { clinic: true } } },
      take: 20,
    });
    return {
      message: `Пользователей: ${users.length}`,
      intent: 'ADMIN_USERS',
      action: {
        type: 'SHOW_USERS',
        payload: users.map(u => ({
          id: u.id,
          email: u.email,
          name: `${u.firstName} ${u.lastName}`,
          role: u.role,
          clinics: u.memberships.map(m => m.clinic.name),
        })),
      },
      suggestions: ['Добавить пользователя', 'Изменить роль', 'Деактивировать'],
    };
  }

  private async manageClinics(context: AIContext) {
    const clinics = await prisma.clinic.findMany();
    const counts = await Promise.all(clinics.map(async (c) => {
      const [patients, users] = await Promise.all([
        prisma.patient.count({ where: { clinicId: c.id } }),
        prisma.clinicMember.count({ where: { clinicId: c.id } }),
      ]);
      return { id: c.id, patients, users };
    }));
    const countMap = Object.fromEntries(counts.map(c => [c.id, { patients: c.patients, users: c.users }]));
    return {
      message: `Клиник: ${clinics.length}`,
      intent: 'ADMIN_CLINICS',
      action: {
        type: 'SHOW_CLINICS',
        payload: clinics.map(c => ({
          id: c.id,
          name: c.name,
          plan: c.plan,
          patients: countMap[c.id].patients,
          users: countMap[c.id].users,
        })),
      },
      suggestions: ['Создать клинику', 'Изменить план', 'Удалить'],
    };
  }

  private async manageRoles(context: AIContext) {
    return { message: 'Управление ролями в разработке', intent: 'ADMIN_ROLES', suggestions: ['Назначить роль', 'Создать роль'] };
  }

  private async backup(context: AIContext) {
    return { message: 'Бэкап запущен', intent: 'ADMIN_BACKUP', action: { type: 'TRIGGER_BACKUP', payload: {} }, suggestions: [] };
  }

  private async audit(context: AIContext) {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return { message: 'Аудит загружен', intent: 'ADMIN_AUDIT', action: { type: 'SHOW_AUDIT', payload: logs }, suggestions: [] };
  }
}