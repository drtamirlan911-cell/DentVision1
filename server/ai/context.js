import prisma from '../lib/prisma.js';

export async function gatherContext(clinicId) {
  if (!clinicId) return {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const now = new Date();
  const in30min = new Date(now.getTime() + 30 * 60 * 1000);

  try {
    const [
      todayAppointments,
      pendingAppointments,
      totalPatients,
      receiptsAgg,
      unpaidReceipts,
      activeLabOrders,
      readyLabOrders,
      lowStockItems,
      upcomingAppts,
    ] = await Promise.all([
      prisma.appointment.count({
        where: { clinicId, date: { gte: today, lt: tomorrow } },
      }),
      prisma.appointment.count({
        where: { clinicId, status: { in: ['pending', 'scheduled'] }, date: { gte: today, lt: tomorrow } },
      }),
      prisma.patient.count({ where: { clinicId } }),
      prisma.receipt.aggregate({
        where: { clinicId, createdAt: { gte: today, lt: tomorrow } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.receipt.count({
        where: { clinicId, status: { in: ['pending', 'unpaid', 'partial'] } },
      }),
      prisma.labOrder.count({
        where: { clinicId, status: { in: ['pending', 'in_progress'] } },
      }),
      prisma.labOrder.count({
        where: { clinicId, status: 'ready' },
      }),
      prisma.inventory.findMany({
        where: {
          clinicId,
          quantity: { lte: prisma.raw('COALESCE(??, 10)', 'min_stock') },
        },
        take: 5,
        select: { name: true, quantity: true, minStock: true },
      }).catch(() => []),
      prisma.appointment.findMany({
        where: {
          clinicId,
          date: { gte: now, lt: in30min },
          status: { in: ['confirmed', 'scheduled'] },
        },
        orderBy: { date: 'asc' },
        take: 1,
        select: { date: true, patientName: true },
      }),
    ]);

    let firstAppointmentTime = null;
    if (upcomingAppts.length > 0) {
      const mins = Math.round((new Date(upcomingAppts[0].date) - now) / 60000);
      if (mins > 0) firstAppointmentTime = `${mins} мин`;
    }

    return {
      todayAppointments,
      pendingAppointments,
      totalPatients,
      revenue: receiptsAgg._sum.total || 0,
      receiptsToday: receiptsAgg._count,
      unpaidReceipts,
      activeLabOrders,
      readyLabOrders,
      lowStockItems,
      firstAppointmentTime,
    };
  } catch {
    return {};
  }
}

export async function gatherProactiveAlerts(clinicId) {
  if (!clinicId) return [];

  const alerts = [];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const upcoming = await prisma.appointment.findMany({
      where: {
        clinicId,
        date: { gte: now, lt: new Date(now.getTime() + 60 * 60 * 1000) },
        status: { in: ['confirmed', 'scheduled'] },
      },
      orderBy: { date: 'asc' },
      take: 3,
      select: { patientName: true, service: true, date: true },
    });

    for (const apt of upcoming) {
      const mins = Math.round((new Date(apt.date) - now) / 60000);
      if (mins <= 15) {
        alerts.push({
          type: 'urgent', category: 'schedule', priority: 10,
          text: `Через ${mins} мин — ${apt.patientName}${apt.service ? ', ' + apt.service : ''}`,
          action: { type: 'OpenSchedule' },
        });
      } else if (mins <= 30) {
        alerts.push({
          type: 'info', category: 'schedule', priority: 7,
          text: `Через ${mins} мин — ${apt.patientName}`,
          action: { type: 'OpenSchedule' },
        });
      }
    }

    const unconfirmed = await prisma.appointment.count({
      where: { clinicId, status: { in: ['pending', 'scheduled'] }, date: { gte: today, lt: tomorrow } },
    });
    if (unconfirmed > 0) {
      alerts.push({
        type: 'warning', category: 'schedule', priority: 5,
        text: `${unconfirmed} ${unconfirmed === 1 ? 'запись' : 'записи'} ожидают подтверждения`,
        action: { type: 'GetPendingAppointments' },
      });
    }

    const unpaid = await prisma.receipt.count({
      where: { clinicId, status: { in: ['pending', 'unpaid', 'partial'] } },
    });
    if (unpaid > 0) {
      alerts.push({
        type: 'warning', category: 'finance', priority: 4,
        text: `${unpaid} ${unpaid === 1 ? 'неоплаченный счёт' : 'неоплаченных счетов'}`,
        action: { type: 'GetUnpaidReceipts' },
      });
    }

    const labActive = await prisma.labOrder.findMany({
      where: { clinicId, status: 'in_progress' },
      select: { patientName: true, type: true, deadline: true },
      take: 3,
    });

    for (const order of labActive) {
      if (order.deadline) {
        const daysLeft = Math.ceil((new Date(order.deadline) - now) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 2) {
          alerts.push({
            type: 'warning', category: 'lab', priority: 6,
            text: `Лаборатория: ${order.patientName} — ${order.type} (осталось ${daysLeft} дн.)`,
            action: { type: 'OpenLab' },
          });
        }
      }
    }

    const labReady = await prisma.labOrder.count({
      where: { clinicId, status: 'ready' },
    });
    if (labReady > 0) {
      alerts.push({
        type: 'info', category: 'lab', priority: 5,
        text: `${labReady} ${labReady === 1 ? 'лабораторная работа готова' : 'лабораторных работ готовы'}`,
        action: { type: 'OpenLab' },
      });
    }

    const lowStock = await prisma.inventory.findMany({
      where: {
        clinicId,
        quantity: { lte: prisma.raw('COALESCE(??, 10)', 'min_stock') },
      },
      take: 3,
      select: { name: true, quantity: true, minStock: true },
    }).catch(() => []);
    if (lowStock.length > 0) {
      const items = lowStock.map(i => i.name).join(', ');
      alerts.push({
        type: 'info', category: 'inventory', priority: 3,
        text: `Заканчивается: ${items}`,
        action: { type: 'OpenInventory' },
      });
    }
  } catch {}

  return alerts.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

export default { gatherContext, gatherProactiveAlerts };
