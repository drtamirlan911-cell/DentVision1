// ═══════════════════════════════════════════════════════════════
// ACTION REGISTRY — Central registry of all AI-executable actions
// Each module registers its commands. AI calls them by name.
// ═══════════════════════════════════════════════════════════════

const actions = new Map();

export function registerAction(action) {
  actions.set(action.name, action);
}

export function getAction(name) {
  return actions.get(name);
}

export function getAllActions() {
  return Array.from(actions.values());
}

export function getActionsBySkill(skill) {
  return Array.from(actions.values()).filter(a => a.skills.includes(skill));
}

export function getActionsForRole(role) {
  return Array.from(actions.values()).filter(a =>
    a.allowedRoles.includes(role) || a.allowedRoles.includes('*')
  );
}

// ─── NAVIGATION ACTIONS ──────────────────────────────────────

registerAction({
  name: 'OpenSchedule',
  description: 'Открыть расписание записей',
  skills: ['practice', 'automation'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', 'assistant', 'reception', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/crm/schedule' };
  },
});

registerAction({
  name: 'OpenPatients',
  description: 'Открыть список пациентов',
  skills: ['practice', 'clinical'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', 'assistant', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/crm/patients' };
  },
});

registerAction({
  name: 'OpenPatient',
  description: 'Открыть карточку конкретного пациента',
  skills: ['clinical', 'practice'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', 'assistant', '*'],
  clinicScoped: true,
  params: { patientId: { type: 'string', required: true, description: 'ID пациента' } },
  async execute(params, _ctx) {
    return { type: 'navigate', path: '/crm/patients', query: { id: params.patientId } };
  },
});

registerAction({
  name: 'OpenMedicalCard',
  description: 'Открыть медицинскую карту пациента',
  skills: ['clinical'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', '*'],
  clinicScoped: true,
  params: { patientId: { type: 'string', required: true } },
  async execute(params, _ctx) {
    return { type: 'navigate', path: '/crm/medical-card', query: { patientId: params.patientId } };
  },
});

registerAction({
  name: 'OpenCashier',
  description: 'Открыть кассу / финансы',
  skills: ['practice', 'analytics'],
  allowedRoles: ['owner', 'director', 'admin', 'cashier', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/crm/cashier' };
  },
});

registerAction({
  name: 'OpenLab',
  description: 'Открыть лабораторные заказы',
  skills: ['practice'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', 'laboratory', 'assistant', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/crm/lab' };
  },
});

registerAction({
  name: 'OpenInventory',
  description: 'Открыть склад / инвентарь',
  skills: ['practice', 'shopping'],
  allowedRoles: ['owner', 'director', 'admin', 'assistant', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/crm/inventory' };
  },
});

registerAction({
  name: 'OpenStaff',
  description: 'Открыть список сотрудников',
  skills: ['practice', 'automation'],
  allowedRoles: ['owner', 'director', 'admin', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/crm/staff' };
  },
});

registerAction({
  name: 'OpenVisits',
  description: 'Открыть журнал визитов',
  skills: ['practice', 'clinical'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/crm/visits' };
  },
});

registerAction({
  name: 'OpenDocuments',
  description: 'Открыть документы',
  skills: ['practice', 'automation'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/crm/documents' };
  },
});

// ─── PLATFORM NAVIGATION ─────────────────────────────────────

registerAction({
  name: 'OpenShop',
  description: 'Открыть магазин DentVision Shop',
  skills: ['shopping'],
  allowedRoles: ['*'],
  clinicScoped: false,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/shop' };
  },
});

registerAction({
  name: 'OpenSchool',
  description: 'Открыть академию DentVision School',
  skills: ['learning'],
  allowedRoles: ['*'],
  clinicScoped: false,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/school' };
  },
});

registerAction({
  name: 'OpenAnalytics',
  description: 'Открыть аналитику клиники',
  skills: ['analytics'],
  allowedRoles: ['owner', 'director', 'admin', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/analytics' };
  },
});

registerAction({
  name: 'OpenProfile',
  description: 'Открыть профиль пользователя',
  skills: ['learning'],
  allowedRoles: ['*'],
  clinicScoped: false,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/profile' };
  },
});

registerAction({
  name: 'OpenSettings',
  description: 'Открыть настройки',
  skills: ['automation'],
  allowedRoles: ['owner', 'director', 'admin', '*'],
  clinicScoped: false,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/settings' };
  },
});

registerAction({
  name: 'OpenMyClinics',
  description: 'Открыть экран выбора рабочего пространства',
  skills: ['automation'],
  allowedRoles: ['*'],
  clinicScoped: false,
  params: {},
  async execute(_params, _ctx) {
    return { type: 'navigate', path: '/my-clinics' };
  },
});

// ─── CRM DATA ACTIONS ────────────────────────────────────────

registerAction({
  name: 'SearchPatients',
  description: 'Найти пациента по имени или телефону',
  skills: ['clinical', 'practice'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', 'assistant', 'reception', '*'],
  clinicScoped: true,
  params: { query: { type: 'string', required: true, description: 'Имя или телефон' } },
  async execute(params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const patients = await prisma.patient.findMany({
      where: {
        clinicId: ctx.clinicId,
        OR: [
          { name: { contains: params.query, mode: 'insensitive' } },
          { phone: { contains: params.query } },
        ],
      },
      take: 10,
      select: { id: true, name: true, phone: true, lastVisit: true },
    });
    return { type: 'data', data: patients, label: 'Найденные пациенты' };
  },
});

registerAction({
  name: 'GetTodaySchedule',
  description: 'Получить расписание на сегодня',
  skills: ['practice', 'automation'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', 'assistant', 'reception', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId: ctx.clinicId,
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { date: 'asc' },
      select: { id: true, patientName: true, service: true, date: true, status: true, doctorName: true },
    });
    return { type: 'data', data: appointments, label: 'Расписание на сегодня' };
  },
});

registerAction({
  name: 'GetClinicStats',
  description: 'Получить ключевые метрики клиники',
  skills: ['analytics'],
  allowedRoles: ['owner', 'director', 'admin', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [patientCount, todayAppointments, totalReceipts, labOrders] = await Promise.all([
      prisma.patient.count({ where: { clinicId: ctx.clinicId } }),
      prisma.appointment.count({ where: { clinicId: ctx.clinicId, date: { gte: today, lt: tomorrow } } }),
      prisma.receipt.aggregate({ where: { clinicId: ctx.clinicId }, _sum: { total: true }, _count: true }),
      prisma.labOrder.count({ where: { clinicId: ctx.clinicId, status: 'in_progress' } }),
    ]);
    return {
      type: 'data',
      data: {
        totalPatients: patientCount,
        todayAppointments,
        totalRevenue: totalReceipts._sum.total || 0,
        totalReceipts: totalReceipts._count,
        activeLabOrders: labOrders,
      },
      label: 'Статистика клиники',
    };
  },
});

registerAction({
  name: 'GetPendingAppointments',
  description: 'Показать неподтверждённые записи',
  skills: ['practice', 'automation'],
  allowedRoles: ['owner', 'director', 'admin', 'assistant', 'reception', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const now = new Date();
    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId: ctx.clinicId,
        status: { in: ['pending', 'scheduled'] },
        date: { gte: now },
      },
      orderBy: { date: 'asc' },
      take: 20,
      select: { id: true, patientName: true, service: true, date: true, status: true },
    });
    return { type: 'data', data: appointments, label: 'Ожидающие подтверждения' };
  },
});

registerAction({
  name: 'GetUnpaidReceipts',
  description: 'Показать неоплаченные счета',
  skills: ['practice', 'analytics'],
  allowedRoles: ['owner', 'director', 'admin', 'cashier', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const receipts = await prisma.receipt.findMany({
      where: {
        clinicId: ctx.clinicId,
        status: { in: ['pending', 'unpaid', 'partial'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, patientName: true, total: true, status: true, createdAt: true },
    });
    return { type: 'data', data: receipts, label: 'Неоплаченные счета' };
  },
});

registerAction({
  name: 'GetActiveLabOrders',
  description: 'Показать активные лабораторные заказы',
  skills: ['practice'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', 'laboratory', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const orders = await prisma.labOrder.findMany({
      where: {
        clinicId: ctx.clinicId,
        status: { in: ['pending', 'in_progress'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, patientName: true, type: true, status: true, deadline: true, createdAt: true },
    });
    return { type: 'data', data: orders, label: 'Активные лабораторные заказы' };
  },
});

// ─── SHOP ACTIONS ─────────────────────────────────────────────

registerAction({
  name: 'SearchShop',
  description: 'Поиск товаров в магазине',
  skills: ['shopping'],
  allowedRoles: ['*'],
  clinicScoped: false,
  params: { query: { type: 'string', required: true } },
  async execute(params, _ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const products = await prisma.shopProduct.findMany({
      where: {
        OR: [
          { name: { contains: params.query, mode: 'insensitive' } },
          { brand: { contains: params.query, mode: 'insensitive' } },
          { description: { contains: params.query, mode: 'insensitive' } },
          { tags: { has: params.query } },
        ],
      },
      take: 10,
      select: { id: true, name: true, brand: true, price: true, rating: true, stock: true },
    });
    return { type: 'data', data: products, label: 'Результаты поиска в Shop' };
  },
});

registerAction({
  name: 'RecommendEquipment',
  description: 'Подобрать оборудование по специализации',
  skills: ['shopping', 'research'],
  allowedRoles: ['*'],
  clinicScoped: false,
  params: { category: { type: 'string', required: true, description: 'Категория оборудования' } },
  async execute(params, _ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const products = await prisma.shopProduct.findMany({
      where: {
        OR: [
          { name: { contains: params.category, mode: 'insensitive' } },
          { description: { contains: params.category, mode: 'insensitive' } },
          { tags: { has: params.category } },
        ],
      },
      orderBy: { rating: 'desc' },
      take: 8,
      select: { id: true, name: true, brand: true, price: true, rating: true, reviewCount: true, description: true },
    });
    return { type: 'recommendation', data: products, label: 'Рекомендации по оборудованию' };
  },
});

// ─── SCHOOL ACTIONS ───────────────────────────────────────────

registerAction({
  name: 'SearchCourses',
  description: 'Поиск курсов в академии',
  skills: ['learning'],
  allowedRoles: ['*'],
  clinicScoped: false,
  params: { query: { type: 'string', required: true } },
  async execute(params, _ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const courses = await prisma.schoolCourse.findMany({
      where: {
        OR: [
          { title: { contains: params.query, mode: 'insensitive' } },
          { category: { contains: params.query, mode: 'insensitive' } },
          { tags: { has: params.query } },
        ],
      },
      take: 10,
      select: { id: true, title: true, category: true, instructor: true, durationHours: true, rating: true, enrolledCount: true, price: true },
    });
    return { type: 'data', data: courses, label: 'Найденные курсы' };
  },
});

registerAction({
  name: 'RecommendCourses',
  description: 'Подобрать курсы по специализации',
  skills: ['learning', 'research'],
  allowedRoles: ['*'],
  clinicScoped: false,
  params: { specialty: { type: 'string', required: true } },
  async execute(params, _ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const courses = await prisma.schoolCourse.findMany({
      where: {
        OR: [
          { category: { contains: params.specialty, mode: 'insensitive' } },
          { tags: { has: params.specialty } },
          { title: { contains: params.specialty, mode: 'insensitive' } },
        ],
      },
      orderBy: { rating: 'desc' },
      take: 6,
      select: { id: true, title: true, subtitle: true, category: true, instructor: true, durationHours: true, rating: true, enrolledCount: true },
    });
    return { type: 'recommendation', data: courses, label: 'Рекомендации по обучению' };
  },
});

// ─── CREATE / MODIFICATION ACTIONS ────────────────────────────

registerAction({
  name: 'CreateAppointment',
  description: 'Создать новую запись на приём',
  skills: ['practice', 'automation'],
  allowedRoles: ['owner', 'director', 'admin', 'assistant', 'reception', '*'],
  clinicScoped: true,
  params: {
    patientName: { type: 'string', required: true },
    service: { type: 'string', required: true },
    date: { type: 'string', required: true, description: 'ISO datetime' },
    doctorName: { type: 'string', required: false },
  },
  async execute(params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const { default: crypto } = await import('crypto');
    const appointment = await prisma.appointment.create({
      data: {
        id: crypto.randomUUID(),
        clinicId: ctx.clinicId,
        patientName: params.patientName,
        service: params.service,
        date: new Date(params.date),
        doctorName: params.doctorName || null,
        status: 'scheduled',
        userId: ctx.userId,
      },
      select: { id: true, patientName: true, service: true, date: true, status: true },
    });
    return { type: 'created', data: appointment, label: 'Запись создана' };
  },
});

registerAction({
  name: 'UpdateAppointmentStatus',
  description: 'Изменить статус записи (подтвердить, отменить, завершить)',
  skills: ['practice', 'automation'],
  allowedRoles: ['owner', 'director', 'admin', 'assistant', 'doctor', 'reception', '*'],
  clinicScoped: true,
  params: {
    appointmentId: { type: 'string', required: true },
    status: { type: 'string', required: true, description: 'confirmed | cancelled | completed | no_show' },
  },
  async execute(params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const appointment = await prisma.appointment.update({
      where: { id: params.appointmentId, clinicId: ctx.clinicId },
      data: { status: params.status },
      select: { id: true, patientName: true, status: true },
    });
    return { type: 'updated', data: appointment, label: 'Статус записи обновлён' };
  },
});

registerAction({
  name: 'CreatePatient',
  description: 'Добавить нового пациента',
  skills: ['clinical', 'practice'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', 'assistant', 'reception', '*'],
  clinicScoped: true,
  params: {
    name: { type: 'string', required: true },
    phone: { type: 'string', required: false },
    email: { type: 'string', required: false },
  },
  async execute(params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const { default: crypto } = await import('crypto');
    const patient = await prisma.patient.create({
      data: {
        id: crypto.randomUUID(),
        clinicId: ctx.clinicId,
        name: params.name,
        phone: params.phone || null,
        email: params.email || null,
      },
      select: { id: true, name: true, phone: true },
    });
    return { type: 'created', data: patient, label: 'Пациент добавлен' };
  },
});

registerAction({
  name: 'CreateLabOrder',
  description: 'Создать лабораторный заказ',
  skills: ['practice'],
  allowedRoles: ['owner', 'director', 'admin', 'doctor', '*'],
  clinicScoped: true,
  params: {
    patientName: { type: 'string', required: true },
    type: { type: 'string', required: true, description: 'Тип работы (crown, bridge, implant, etc.)' },
    deadline: { type: 'string', required: false, description: 'ISO date' },
  },
  async execute(params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const { default: crypto } = await import('crypto');
    const order = await prisma.labOrder.create({
      data: {
        id: crypto.randomUUID(),
        clinicId: ctx.clinicId,
        patientName: params.patientName,
        type: params.type,
        status: 'pending',
        deadline: params.deadline ? new Date(params.deadline) : null,
      },
      select: { id: true, patientName: true, type: true, status: true },
    });
    return { type: 'created', data: order, label: 'Лабораторный заказ создан' };
  },
});

// ─── REPORTING ACTIONS ────────────────────────────────────────

registerAction({
  name: 'GenerateDailyReport',
  description: 'Сформировать отчёт за день',
  skills: ['analytics'],
  allowedRoles: ['owner', 'director', 'admin', '*'],
  clinicScoped: true,
  params: {},
  async execute(_params, ctx) {
    const { default: prisma } = await import('../lib/prisma.js');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [appointments, receipts, newPatients] = await Promise.all([
      prisma.appointment.count({ where: { clinicId: ctx.clinicId, date: { gte: today, lt: tomorrow } } }),
      prisma.receipt.aggregate({ where: { clinicId: ctx.clinicId, createdAt: { gte: today, lt: tomorrow } }, _sum: { total: true }, _count: true }),
      prisma.patient.count({ where: { clinicId: ctx.clinicId, createdAt: { gte: today } } }),
    ]);
    return {
      type: 'report',
      data: {
        date: today.toISOString().slice(0, 10),
        appointments,
        revenue: receipts._sum.total || 0,
        receiptsCount: receipts._count,
        newPatients,
      },
      label: 'Отчёт за день',
    };
  },
});

export default { registerAction, getAction, getAllActions, getActionsBySkill, getActionsForRole };
