// ═══════════════════════════════════════════════════════════════
// CONTEXT ENGINE — Gathers live data for AI decision-making
// ═══════════════════════════════════════════════════════════════

import prisma from '../lib/prisma.js';

export async function gatherContext(clinicId) {
  if (!clinicId) return {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1);

  try {
    const [
      todayAppointments,
      pendingAppointments,
      totalPatients,
      receiptsAgg,
      unpaidReceipts,
      activeLabOrders,
      lowStockItems,
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
      prisma.inventory.findMany({
        where: { clinicId, quantity: { lte: prisma.raw('??', 'min_stock') } },
        take: 5,
        select: { name: true, quantity: true, minStock: true },
      }).catch(() => []),
    ]);

    return {
      todayAppointments,
      pendingAppointments,
      totalPatients,
      revenue: receiptsAgg._sum.total || 0,
      receiptsToday: receiptsAgg._count,
      unpaidReceipts,
      activeLabOrders,
      lowStockItems,
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
      if (mins <= 30) {
        alerts.push({
          type: 'info',
          text: `Через ${mins} мин — ${apt.patientName}${apt.service ? ', ' + apt.service : ''}`,
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
        text: `${unconfirmed} ${unconfirmed === 1 ? 'запись' : unconfirmed < 5 ? 'записи' : 'записей'} ожидают подтверждения`,
      });
    }

    const unpaid = await prisma.receipt.count({
      where: { clinicId, status: { in: ['pending', 'unpaid', 'partial'] } },
    });
    if (unpaid > 0) {
      alerts.push({
        type: 'warning',
        text: `${unpaid} неоплаченных ${unpaid === 1 ? 'счёт' : unpaid < 5 ? 'счёта' : 'счетов'}`,
      });
    }

    const labActive = await prisma.labOrder.count({
      where: { clinicId, status: 'in_progress' },
    });
    if (labActive > 0) {
      alerts.push({
        type: 'info',
        text: `${labActive} лабораторных работ в процессе`,
      });
    }
  } catch {
    // Silently fail — proactive alerts are best-effort
  }

  return alerts;
}

export default { gatherContext, gatherProactiveAlerts };
