// ═══════════════════════════════════════════════════════════════
// PROACTIVE ENGINE — AI не ждёт команд, он проактивен
//
// Генерирует уведомления на основе:
// - Расписания (с upcoming appointments)
// - Финансов (неоплаченные счета)
// - Лаборатории (старые заказы)
// - Склада (заканчиваются материалы)
// - Аналитики (отклонения от нормы)
// - School (рекомендации по обучению)
// - Shop (скидки на нужные товары)
// ═══════════════════════════════════════════════════════════════

import prisma from '../lib/prisma.js';

const ROLE_ALERT_FILTERS = {
  doctor: ['schedule', 'lab', 'learning'],
  assistant: ['schedule', 'stock'],
  reception: ['schedule'],
  admin: ['schedule', 'finance', 'stock'],
  director: ['schedule', 'finance', 'analytics', 'lab'],
  owner: ['schedule', 'finance', 'analytics', 'lab', 'stock', 'learning'],
  laboratory: ['lab'],
  cashier: ['finance'],
  accountant: ['finance', 'analytics'],
  manager: ['schedule', 'finance', 'analytics'],
  intern: ['schedule', 'learning'],
};

export async function generateProactiveAlerts(userId, clinicId, userRole) {
  const alerts = [];
  const allowedCategories = ROLE_ALERT_FILTERS[userRole] || ['schedule'];

  if (clinicId) {
    const clinicAlerts = await generateClinicAlerts(clinicId, allowedCategories);
    alerts.push(...clinicAlerts);
  }

  if (allowedCategories.includes('learning')) {
    const personalAlerts = await generatePersonalAlerts(userId);
    alerts.push(...personalAlerts);
  }

  return alerts.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

async function generateClinicAlerts(clinicId, allowedCategories) {
  const alerts = [];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const in30min = new Date(now.getTime() + 30 * 60 * 1000);
  const in1hour = new Date(now.getTime() + 60 * 60 * 1000);

  try {
    const upcoming = await prisma.appointment.findMany({
      where: {
        clinicId,
        date: { gte: now, lt: in1hour },
        status: { in: ['confirmed', 'scheduled'] },
      },
      orderBy: { date: 'asc' },
      take: 3,
      select: { patientName: true, service: true, date: true },
    });

    if (allowedCategories.includes('schedule')) {
      for (const apt of upcoming) {
        const mins = Math.round((new Date(apt.date) - now) / 60000);
        if (mins <= 15) {
          alerts.push({
            type: 'urgent',
            category: 'schedule',
            text: `Через ${mins} мин — ${apt.patientName}${apt.service ? ', ' + apt.service : ''}`,
            priority: 10,
            action: { type: 'OpenSchedule' },
          });
        } else if (mins <= 30) {
          alerts.push({
            type: 'info',
            category: 'schedule',
            text: `Через ${mins} мин — ${apt.patientName}`,
            priority: 7,
            action: { type: 'OpenSchedule' },
          });
        }
      }

      const unconfirmed = await prisma.appointment.count({
        where: {
          clinicId,
          status: { in: ['pending', 'scheduled'] },
          date: { gte: today, lt: tomorrow },
        },
      });
      if (unconfirmed > 0) {
        alerts.push({
          type: 'warning',
          category: 'schedule',
          text: `${unconfirmed} ${unconfirmed === 1 ? 'запись' : unconfirmed < 5 ? 'записи' : 'записей'} ожидают подтверждения`,
          priority: 5,
          action: { type: 'GetPendingAppointments' },
        });
      }
    }

    if (allowedCategories.includes('finance')) {
      const unpaid = await prisma.receipt.count({
        where: { clinicId, status: { in: ['pending', 'unpaid', 'partial'] } },
      });
      if (unpaid > 0) {
        alerts.push({
          type: 'warning',
          category: 'finance',
          text: `${unpaid} ${unpaid === 1 ? 'неоплаченный счёт' : unpaid < 5 ? 'неоплаченных счёта' : 'неоплаченных счетов'}`,
          priority: 4,
          action: { type: 'OpenCashier' },
        });
      }
    }

    if (allowedCategories.includes('lab')) {
      const labActive = await prisma.labOrder.findMany({
        where: { clinicId, status: 'in_progress' },
        select: { id: true, patientName: true, type: true, deadline: true },
        take: 3,
      });

      for (const order of labActive) {
        if (order.deadline) {
          const daysLeft = Math.ceil((new Date(order.deadline) - now) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 2) {
            alerts.push({
              type: 'warning',
              category: 'lab',
              text: `Лаборатория: ${order.patientName} — ${order.type} (осталось ${daysLeft} дн.)`,
              priority: 6,
              action: { type: 'OpenLab' },
            });
          }
        }
      }
    }
  } catch {
    // Proactive alerts are best-effort
  }

  return alerts;
}

async function generatePersonalAlerts(userId) {
  const alerts = [];

  try {
    const recentEnrollments = await prisma.schoolEnrollment.findMany({
      where: { userId, status: 'in_progress' },
      take: 2,
      include: { course: { select: { title: true } } },
    });

    for (const e of recentEnrollments) {
      if (e.progress > 0 && e.progress < 80) {
        alerts.push({
          type: 'info',
          category: 'learning',
          text: `Продолжите курс «${e.course?.title || 'Без названия'}» — ${e.progress}%`,
          priority: 2,
          action: { type: 'OpenSchool' },
        });
      }
    }
  } catch {
    // Best-effort
  }

  return alerts;
}

export default { generateProactiveAlerts };
