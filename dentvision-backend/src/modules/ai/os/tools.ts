/**
 * Tool layer — DentVision AI OS.
 *
 * Every tool the orchestrator can plan with. Executors are:
 *  - clinic-scoped: every query is filtered by the caller's clinicId;
 *  - RBAC-aware: the orchestrator only exposes tools permitted for the
 *    caller's role (see registry.toolsForRole);
 *  - confirmation-gated: mutating tools never execute without
 *    `confirmed: true` — instead they return a proposal the UI renders
 *    as a confirm card (Spec §4.6 action model).
 */

import prisma from '../../../lib/prisma.js';
import { uid } from '../../../lib/helpers.js';

export interface ToolContext {
  userId: string;
  clinicId: string | null;
  role: string;
}

export interface ToolResult {
  ok: boolean;
  /** Compact JSON the model reads to compose its answer. */
  data?: unknown;
  error?: string;
  /** Set for mutating tools awaiting user confirmation. */
  needsConfirmation?: { action: string; params: Record<string, unknown>; summary: string };
  /** Client-side navigation the UI should perform. */
  navigate?: string;
}

interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mutating?: boolean;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

function requireClinic(ctx: ToolContext): string {
  if (!ctx.clinicId) throw new Error('NO_CLINIC');
  return ctx.clinicId;
}

const NAV_PATHS: Record<string, string> = {
  schedule: '/crm/schedule',
  patients: '/crm/patients',
  finance: '/crm/finance',
  inventory: '/crm/inventory',
  documents: '/crm/documents',
  lab: '/crm/lab',
  reminders: '/crm/reminders',
  'dental-chart': '/crm/dental-chart',
  'treatment-plans': '/crm/treatment-plans',
  visits: '/crm/visits',
  staff: '/crm/staff',
  shop: '/shop',
  school: '/school',
  analytics: '/analytics',
  settings: '/settings',
  profile: '/profile',
};

export const TOOLS: Record<string, ToolSpec> = {
  searchPatients: {
    name: 'searchPatients',
    description: 'Поиск пациентов клиники по имени, фамилии или телефону. Возвращает до 10 совпадений.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Имя, фамилия или телефон (частичное совпадение)' },
      },
      required: ['query'],
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const query = String(args.query || '').trim();
      const patients = await prisma.patient.findMany({
        where: {
          clinicId,
          ...(query && {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query } },
            ],
          }),
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, phone: true, birthDate: true, gender: true },
      });
      return { ok: true, data: patients };
    },
  },

  getPatientCard: {
    name: 'getPatientCard',
    description: 'Полная карта пациента: визиты, зубная карта, планы лечения, медицинская история.',
    parameters: {
      type: 'object',
      properties: { patientId: { type: 'string', description: 'ID пациента (uuid из searchPatients)' } },
      required: ['patientId'],
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patient = await prisma.patient.findFirst({
        where: { id: String(args.patientId), clinicId },
        include: {
          visits: { orderBy: { date: 'desc' }, take: 5 },
          teeth: { orderBy: { number: 'asc' } },
          treatmentPlans: { orderBy: { createdAt: 'desc' }, take: 3 },
        },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };
      return { ok: true, data: patient };
    },
  },

  getVisits: {
    name: 'getVisits',
    description: 'Последние визиты клиники или конкретного пациента (диагнозы, жалобы, лечение).',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string', description: 'Опционально — ID пациента' },
        limit: { type: 'number', description: 'Максимум записей (по умолчанию 10)' },
      },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const visits = await prisma.visit.findMany({
        where: args.patientId
          ? { patientId: String(args.patientId), patient: { clinicId } }
          : { patient: { clinicId } },
        orderBy: { date: 'desc' },
        take: Math.min(Number(args.limit) || 10, 50),
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      return { ok: true, data: visits };
    },
  },

  getSchedule: {
    name: 'getSchedule',
    description: 'Расписание записей на дату (по умолчанию сегодня): время, пациент, врач, статус.',
    parameters: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Дата YYYY-MM-DD (по умолчанию сегодня)' } },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const date = args.date ? new Date(String(args.date)) : new Date();
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      const appointments = await prisma.appointment.findMany({
        where: { clinicId, date: { gte: start, lte: end } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      });
      return { ok: true, data: appointments };
    },
  },

  createAppointment: {
    name: 'createAppointment',
    description:
      'Создать запись пациента на приём. ТРЕБУЕТ подтверждения пользователем: без confirmed=true возвращает черновик.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM' },
        type: { type: 'string', description: 'Тип приёма (Терапия, Консультация, ...)' },
        duration: { type: 'number', description: 'Минуты, по умолчанию 60' },
        confirmed: { type: 'boolean', description: 'true только после явного подтверждения пользователем' },
      },
      required: ['patientId', 'date', 'time'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patient = await prisma.patient.findFirst({
        where: { id: String(args.patientId), clinicId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'createAppointment',
            params: { ...args, confirmed: true },
            summary: `Записать ${patient.firstName} ${patient.lastName} на ${args.date} в ${args.time}${args.type ? ` (${args.type})` : ''}`,
          },
        };
      }

      const appointment = await prisma.appointment.create({
        data: {
          id: uid(),
          clinicId,
          patientId: patient.id,
          doctorId: ctx.userId,
          date: new Date(String(args.date)),
          time: String(args.time),
          duration: Number(args.duration) || 60,
          status: 'PENDING',
          type: args.type ? String(args.type) : null,
        },
      });
      return { ok: true, data: appointment, navigate: '/crm/schedule' };
    },
  },

  getTreatmentPlans: {
    name: 'getTreatmentPlans',
    description: 'Планы лечения клиники или пациента: статус, диагноз, бюджет, этапы.',
    parameters: {
      type: 'object',
      properties: { patientId: { type: 'string', description: 'Опционально — ID пациента' } },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const plans = await prisma.treatmentPlan.findMany({
        where: {
          patient: { clinicId },
          ...(args.patientId ? { patientId: String(args.patientId) } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      return { ok: true, data: plans };
    },
  },

  createTreatmentPlan: {
    name: 'createTreatmentPlan',
    description:
      'Создать черновик плана лечения (title, diagnosis, teeth FDI, budget). ТРЕБУЕТ подтверждения: без confirmed=true возвращает черновик. План всегда со статусом proposed — утверждает врач.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        title: { type: 'string' },
        diagnosis: { type: 'string' },
        teeth: { type: 'array', items: { type: 'number' }, description: 'Номера зубов FDI' },
        totalBudget: { type: 'number' },
        stages: {
          type: 'array',
          items: { type: 'object', properties: { title: { type: 'string' }, cost: { type: 'number' } } },
        },
        confirmed: { type: 'boolean' },
      },
      required: ['patientId', 'title'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patient = await prisma.patient.findFirst({
        where: { id: String(args.patientId), clinicId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'createTreatmentPlan',
            params: { ...args, confirmed: true },
            summary: `Создать план «${args.title}» для ${patient.firstName} ${patient.lastName}${args.totalBudget ? ` (бюджет ${args.totalBudget})` : ''}`,
          },
        };
      }

      const stages = Array.isArray(args.stages)
        ? (args.stages as Array<{ title?: string; cost?: number }>).map((s, i) => ({
            id: uid(), title: s.title || `Этап ${i + 1}`, status: 'pending', sortOrder: i + 1, cost: s.cost ?? null,
          }))
        : [];

      const plan = await prisma.treatmentPlan.create({
        data: {
          id: uid(),
          patientId: patient.id,
          title: String(args.title),
          status: 'proposed',
          items: {
            diagnosis: args.diagnosis ?? null,
            totalBudget: args.totalBudget ?? null,
            teeth: (args.teeth as number[]) || [],
            stages,
            doctorId: ctx.userId,
          },
          price: (args.totalBudget as number) ?? null,
          notes: (args.diagnosis as string) ?? null,
        },
      });
      return { ok: true, data: plan, navigate: '/crm/treatment-plans' };
    },
  },

  getRevenue: {
    name: 'getRevenue',
    description: 'Выручка клиники: оплаченные счета за период (по умолчанию текущий месяц) с разбивкой по месяцам.',
    parameters: {
      type: 'object',
      properties: { months: { type: 'number', description: 'Сколько последних месяцев (по умолчанию 1, максимум 12)' } },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const months = Math.min(Math.max(Number(args.months) || 1, 1), 12);
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      const invoices = await prisma.invoice.findMany({
        where: { clinicId, status: 'PAID', createdAt: { gte: from } },
        select: { amount: true, createdAt: true },
      });
      const byMonth = new Map<string, number>();
      for (const inv of invoices) {
        const key = inv.createdAt.toISOString().slice(0, 7);
        byMonth.set(key, (byMonth.get(key) || 0) + inv.amount);
      }
      const total = invoices.reduce((s, i) => s + i.amount, 0);
      return { ok: true, data: { total, count: invoices.length, byMonth: Object.fromEntries(byMonth) } };
    },
  },

  getDebtors: {
    name: 'getDebtors',
    description: 'Должники: неоплаченные и частично оплаченные счета с пациентами и телефонами.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const clinicId = requireClinic(ctx);
      const invoices = await prisma.invoice.findMany({
        where: { clinicId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      const patientIds = [...new Set(invoices.map((i) => i.patientId).filter(Boolean))] as string[];
      const patients = await prisma.patient.findMany({
        where: { id: { in: patientIds } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      });
      const byId = new Map(patients.map((p) => [p.id, p]));
      const total = invoices.reduce((s, i) => s + i.amount, 0);
      return {
        ok: true,
        data: {
          total,
          count: invoices.length,
          debtors: invoices.map((i) => {
            const p = i.patientId ? byId.get(i.patientId) : undefined;
            return {
              invoiceId: i.id,
              amount: i.amount,
              status: i.status,
              patient: p ? `${p.firstName} ${p.lastName}` : 'Неизвестно',
              phone: p?.phone || null,
            };
          }),
        },
      };
    },
  },

  createInvoice: {
    name: 'createInvoice',
    description: 'Выставить счёт пациенту. ТРЕБУЕТ подтверждения: без confirmed=true возвращает черновик.',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        amount: { type: 'number' },
        notes: { type: 'string' },
        confirmed: { type: 'boolean' },
      },
      required: ['patientId', 'amount'],
    },
    mutating: true,
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const patient = await prisma.patient.findFirst({
        where: { id: String(args.patientId), clinicId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!patient) return { ok: false, error: 'Пациент не найден' };
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Некорректная сумма' };

      if (!args.confirmed) {
        return {
          ok: true,
          needsConfirmation: {
            action: 'createInvoice',
            params: { ...args, confirmed: true },
            summary: `Выставить счёт ${patient.firstName} ${patient.lastName} на ${amount.toLocaleString('ru-RU')}`,
          },
        };
      }

      const invoice = await prisma.invoice.create({
        data: {
          id: uid(),
          clinicId,
          patientId: patient.id,
          amount,
          status: 'UNPAID',
          items: [],
          notes: args.notes ? String(args.notes) : null,
        },
      });
      return { ok: true, data: invoice, navigate: '/crm/finance' };
    },
  },

  getDashboardStats: {
    name: 'getDashboardStats',
    description: 'KPI клиники: всего пациентов, записей сегодня, выручка за месяц, активные лаб. заказы.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const clinicId = requireClinic(ctx);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [totalPatients, appointmentsToday, revenue, activeLabOrders] = await Promise.all([
        prisma.patient.count({ where: { clinicId } }),
        prisma.appointment.count({
          where: { clinicId, date: { gte: startOfToday, lt: endOfToday }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
        }),
        prisma.invoice.aggregate({
          where: { clinicId, status: 'PAID', createdAt: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        prisma.labOrder.count({ where: { clinicId, status: { notIn: ['completed', 'delivered'] } } }),
      ]);
      return {
        ok: true,
        data: { totalPatients, appointmentsToday, revenueThisMonth: revenue._sum.amount ?? 0, activeLabOrders },
      };
    },
  },

  getDoctorUtilization: {
    name: 'getDoctorUtilization',
    description: 'Загрузка врачей: число приёмов за текущий месяц по каждому врачу клиники.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const clinicId = requireClinic(ctx);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const members = await prisma.clinicMember.findMany({
        where: { clinicId, role: { in: ['DOCTOR', 'OWNER'] } },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      });
      const counts = await prisma.appointment.groupBy({
        by: ['doctorId'],
        where: {
          clinicId,
          doctorId: { in: members.map((m) => m.user.id) },
          date: { gte: startOfMonth },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        _count: { id: true },
      });
      const byDoctor = new Map(counts.map((c) => [c.doctorId, c._count.id]));
      return {
        ok: true,
        data: members.map((m) => ({
          doctor: `${m.user.firstName} ${m.user.lastName}`,
          appointmentsThisMonth: byDoctor.get(m.user.id) || 0,
        })),
      };
    },
  },

  getInventory: {
    name: 'getInventory',
    description: 'Склад клиники: остатки материалов. lowStockOnly=true — только позиции ниже минимума.',
    parameters: {
      type: 'object',
      properties: { lowStockOnly: { type: 'boolean', description: 'Только заканчивающиеся позиции' } },
    },
    async execute(args, ctx) {
      const clinicId = requireClinic(ctx);
      const items = await prisma.inventoryItem.findMany({ where: { clinicId }, orderBy: { name: 'asc' }, take: 100 });
      const filtered = args.lowStockOnly ? items.filter((i) => i.quantity <= i.minimum) : items;
      return { ok: true, data: filtered };
    },
  },

  getLabOrders: {
    name: 'getLabOrders',
    description: 'Лабораторные заказы клиники: тип работы, статус, срок готовности.',
    parameters: { type: 'object', properties: {} },
    async execute(_args, ctx) {
      const clinicId = requireClinic(ctx);
      const orders = await prisma.labOrder.findMany({
        where: { clinicId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      return { ok: true, data: orders };
    },
  },

  searchProducts: {
    name: 'searchProducts',
    description: 'Поиск товаров в маркетплейсе DentVision по названию, бренду или категории.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
      },
    },
    async execute(args) {
      const query = args.query ? String(args.query) : '';
      const products = await prisma.product.findMany({
        where: {
          ...(args.category ? { category: String(args.category) } : {}),
          ...(query && {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { brand: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          }),
        },
        take: 10,
        orderBy: { rating: 'desc' },
        select: { id: true, name: true, brand: true, price: true, rating: true, category: true, stock: true },
      });
      return { ok: true, data: products };
    },
  },

  searchCourses: {
    name: 'searchCourses',
    description: 'Поиск курсов в Академии DentVision по теме, категории или автору.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
      },
    },
    async execute(args) {
      const query = args.query ? String(args.query) : '';
      const courses = await prisma.course.findMany({
        where: {
          ...(args.category ? { category: String(args.category) } : {}),
          ...(query && {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { author: { contains: query, mode: 'insensitive' } },
            ],
          }),
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, category: true, author: true, duration: true, price: true },
      });
      return { ok: true, data: courses };
    },
  },

  navigate: {
    name: 'navigate',
    description:
      'Открыть раздел приложения для пользователя. Допустимые: schedule, patients, finance, inventory, documents, lab, reminders, dental-chart, treatment-plans, visits, staff, shop, school, analytics, settings, profile.',
    parameters: {
      type: 'object',
      properties: { section: { type: 'string', description: 'Ключ раздела из списка' } },
      required: ['section'],
    },
    async execute(args) {
      const path = NAV_PATHS[String(args.section)];
      if (!path) return { ok: false, error: `Неизвестный раздел: ${args.section}` };
      return { ok: true, data: { opened: path }, navigate: path };
    },
  },
};

export function toolSchemasFor(toolNames: Set<string>): Array<{
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return Object.values(TOOLS)
    .filter((t) => toolNames.has(t.name))
    .map((t) => ({ type: 'function' as const, name: t.name, description: t.description, parameters: t.parameters }));
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  allowed: Set<string>,
): Promise<ToolResult> {
  const tool = TOOLS[name];
  if (!tool) return { ok: false, error: `Инструмент ${name} не существует` };
  if (!allowed.has(name)) return { ok: false, error: `Инструмент ${name} недоступен для вашей роли` };
  try {
    return await tool.execute(args, ctx);
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_CLINIC') {
      return { ok: false, error: 'Нет активной клиники — выберите рабочее пространство' };
    }
    console.error(`[AI OS] tool ${name} failed:`, error);
    return { ok: false, error: 'Ошибка выполнения инструмента' };
  }
}
