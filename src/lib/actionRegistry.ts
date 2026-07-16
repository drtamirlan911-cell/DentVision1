/**
 * DentVision Action Registry
 * Единый реестр действий для AI Assistant
 * Каждый модуль регистрирует свои команды
 */

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  category: ActionCategory;
  requiredRoles?: string[];
  handler: (params: Record<string, unknown>) => Promise<ActionResult>;
  parameters?: ParameterDefinition[];
}

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required: boolean;
  description: string;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  message?: string;
  navigateTo?: string;
}

export type ActionCategory = 
  | 'patient'
  | 'appointment'
  | 'treatment'
  | 'finance'
  | 'analytics'
  | 'navigation'
  | 'shop'
  | 'school'
  | 'laboratory'
  | 'document';

class ActionRegistry {
  private actions: Map<string, ActionDefinition> = new Map();

  register(action: ActionDefinition): void {
    this.actions.set(action.id, action);
  }

  get(id: string): ActionDefinition | undefined {
    return this.actions.get(id);
  }

  getAll(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }

  getByCategory(category: ActionCategory): ActionDefinition[] {
    return Array.from(this.actions.values()).filter(a => a.category === category);
  }

  search(query: string): ActionDefinition[] {
    const q = query.toLowerCase();
    return Array.from(this.actions.values()).filter(
      a => a.name.toLowerCase().includes(q) || 
           a.description.toLowerCase().includes(q) ||
           a.id.toLowerCase().includes(q)
    );
  }

  async execute(id: string, params: Record<string, unknown>, userRole?: string): Promise<ActionResult> {
    const action = this.actions.get(id);
    if (!action) {
      return { success: false, message: `Действие "${id}" не найдено` };
    }

    if (action.requiredRoles && userRole && !action.requiredRoles.includes(userRole)) {
      return { success: false, message: `Недостаточно прав для выполнения действия "${action.name}"` };
    }

    try {
      return await action.handler(params);
    } catch (error) {
      return { 
        success: false, 
        message: `Ошибка выполнения: ${(error as Error).message}` 
      };
    }
  }
}

// Глобальный экземпляр реестра
export const actionRegistry = new ActionRegistry();

// ─── CRM Actions ───

actionRegistry.register({
  id: 'openPatient',
  name: 'Открыть карту пациента',
  description: 'Открывает медицинскую карту пациента',
  category: 'patient',
  parameters: [
    { name: 'patientId', type: 'string', required: true, description: 'ID пациента' },
    { name: 'patientName', type: 'string', required: false, description: 'Имя пациента для поиска' },
  ],
  handler: async (params) => {
    const patientId = params.patientId as string;
    return { 
      success: true, 
      navigateTo: `/crm/patients/${patientId}`,
      message: `Открываю карту пациента...`
    };
  },
});

actionRegistry.register({
  id: 'createAppointment',
  name: 'Создать запись',
  description: 'Создаёт новую запись на приём',
  category: 'appointment',
  requiredRoles: ['admin', 'director', 'superadmin'],
  parameters: [
    { name: 'patientId', type: 'string', required: true, description: 'ID пациента' },
    { name: 'date', type: 'date', required: true, description: 'Дата записи' },
    { name: 'time', type: 'string', required: true, description: 'Время записи' },
    { name: 'doctorId', type: 'string', required: false, description: 'ID врача' },
    { name: 'service', type: 'string', required: false, description: 'Услуга' },
  ],
  handler: async (params) => {
    // Здесь будет вызов API
    return { 
      success: true, 
      message: `Запись создана на ${params.date} в ${params.time}`
    };
  },
});

actionRegistry.register({
  id: 'rescheduleAppointment',
  name: 'Перенести запись',
  description: 'Переносит существующую запись на другое время',
  category: 'appointment',
  requiredRoles: ['admin', 'director', 'superadmin'],
  handler: async (params) => {
    return { success: true, message: 'Запись перенесена' };
  },
});

actionRegistry.register({
  id: 'confirmAppointment',
  name: 'Подтвердить запись',
  description: 'Подтверждает запись пациента',
  category: 'appointment',
  handler: async (params) => {
    return { success: true, message: 'Запись подтверждена' };
  },
});

actionRegistry.register({
  id: 'openSchedule',
  name: 'Открыть расписание',
  description: 'Открывает расписание приёмов',
  category: 'navigation',
  handler: async () => ({ success: true, navigateTo: '/crm/schedule' }),
});

actionRegistry.register({
  id: 'createInvoice',
  name: 'Создать счёт',
  description: 'Формирует счёт на оплату',
  category: 'finance',
  requiredRoles: ['admin', 'director', 'superadmin'],
  handler: async (params) => {
    return { success: true, message: 'Счёт создан' };
  },
});

actionRegistry.register({
  id: 'processPayment',
  name: 'Принять оплату',
  description: 'Регистрирует оплату от пациента',
  category: 'finance',
  requiredRoles: ['admin', 'director', 'superadmin'],
  handler: async (params) => {
    return { success: true, message: 'Оплата принята' };
  },
});

actionRegistry.register({
  id: 'openTreatmentPlan',
  name: 'Открыть план лечения',
  description: 'Открывает или создаёт план лечения',
  category: 'treatment',
  handler: async (params) => {
    return { success: true, navigateTo: '/crm/medical-card' };
  },
});

actionRegistry.register({
  id: 'generateTreatmentPlan',
  name: 'Сгенерировать план лечения',
  description: 'AI генерирует план лечения на основе данных',
  category: 'treatment',
  handler: async (params) => {
    return { success: true, message: 'План лечения сгенерирован' };
  },
});

actionRegistry.register({
  id: 'openCT',
  name: 'Открыть КТ снимки',
  description: 'Открывает компьютерную томографию пациента',
  category: 'patient',
  handler: async (params) => {
    return { success: true, message: 'Открываю КТ снимки...' };
  },
});

actionRegistry.register({
  id: 'compareScans',
  name: 'Сравнить снимки',
  description: 'Сравнивает текущие и прошлые снимки',
  category: 'treatment',
  handler: async (params) => {
    return { success: true, message: 'Сравнение снимков готово' };
  },
});

actionRegistry.register({
  id: 'closeVisit',
  name: 'Закрыть визит',
  description: 'Завершает приём пациента',
  category: 'appointment',
  handler: async (params) => {
    return { success: true, message: 'Визит закрыт' };
  },
});

actionRegistry.register({
  id: 'openAnalytics',
  name: 'Открыть аналитику',
  description: 'Открывает панель аналитики',
  category: 'analytics',
  handler: async () => ({ success: true, navigateTo: '/analytics' }),
});

actionRegistry.register({
  id: 'getFinancialReport',
  name: 'Финансовый отчёт',
  description: 'Показывает финансовую аналитику',
  category: 'analytics',
  handler: async (params) => {
    return { success: true, message: 'Финансовый отчёт готов' };
  },
});

actionRegistry.register({
  id: 'getDoctorLoad',
  name: 'Загрузка врачей',
  description: 'Показывает загрузку врачей по периодам',
  category: 'analytics',
  handler: async (params) => {
    return { success: true, message: 'Отчёт по загрузке врачей готов' };
  },
});

actionRegistry.register({
  id: 'getAverageCheck',
  name: 'Средний чек',
  description: 'Рассчитывает средний чек клиники',
  category: 'analytics',
  handler: async (params) => {
    return { success: true, message: 'Средний чек рассчитан' };
  },
});

actionRegistry.register({
  id: 'searchShop',
  name: 'Поиск товаров',
  description: 'Ищет товары в DentVision Shop',
  category: 'shop',
  handler: async (params) => {
    const query = params.query as string;
    return { success: true, navigateTo: `/shop?search=${encodeURIComponent(query || '')}` };
  },
});

actionRegistry.register({
  id: 'recommendProduct',
  name: 'Рекомендовать товар',
  description: 'AI рекомендует товар из магазина',
  category: 'shop',
  handler: async (params) => {
    return { success: true, message: 'Товар рекомендован' };
  },
});

actionRegistry.register({
  id: 'orderMaterials',
  name: 'Заказать материалы',
  description: 'Создаёт заказ материалов',
  category: 'shop',
  handler: async (params) => {
    return { success: true, message: 'Заказ создан' };
  },
});

actionRegistry.register({
  id: 'recommendCourse',
  name: 'Рекомендовать курс',
  description: 'AI рекомендует обучающий курс',
  category: 'school',
  handler: async (params) => {
    return { success: true, navigateTo: '/school' };
  },
});

actionRegistry.register({
  id: 'openCourse',
  name: 'Открыть курс',
  description: 'Открывает страницу курса',
  category: 'school',
  handler: async (params) => {
    const courseId = params.courseId as string;
    return { success: true, navigateTo: `/school/${courseId}` };
  },
});

actionRegistry.register({
  id: 'trackLabOrder',
  name: 'Отследить заказ лаборатории',
  description: 'Показывает статус заказа лаборатории',
  category: 'laboratory',
  handler: async (params) => {
    return { success: true, navigateTo: '/crm/lab' };
  },
});

actionRegistry.register({
  id: 'updateLabStatus',
  name: 'Обновить статус лаборатории',
  description: 'Меняет статус лабораторной работы',
  category: 'laboratory',
  handler: async (params) => {
    return { success: true, message: 'Статус обновлён' };
  },
});

actionRegistry.register({
  id: 'sendNotification',
  name: 'Отправить уведомление',
  description: 'Отправляет уведомление пациенту',
  category: 'appointment',
  handler: async (params) => {
    return { success: true, message: 'Уведомление отправлено' };
  },
});

actionRegistry.register({
  id: 'openDocuments',
  name: 'Открыть документы',
  description: 'Открывает раздел документов',
  category: 'document',
  handler: async () => ({ success: true, navigateTo: '/crm/documents' }),
});

actionRegistry.register({
  id: 'generateDocument',
  name: 'Создать документ',
  description: 'Генерирует медицинский документ',
  category: 'document',
  handler: async (params) => {
    return { success: true, message: 'Документ создан' };
  },
});

actionRegistry.register({
  id: 'navigateTo',
  name: 'Перейти к разделу',
  description: 'Навигация к любому разделу системы',
  category: 'navigation',
  handler: async (params) => {
    const path = params.path as string;
    return { success: true, navigateTo: path };
  },
});
