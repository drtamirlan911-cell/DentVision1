/**
 * Build a live digital twin for the authenticated user from clinic + school data.
 */
import prisma from '../../../lib/prisma.js';

export async function buildDigitalTwin(userId: string, clinicId?: string | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      spec: true,
      phone: true,
      avatar: true,
      profileMeta: true,
    },
  });
  if (!user) return null;

  const meta = (user.profileMeta && typeof user.profileMeta === 'object')
    ? (user.profileMeta as Record<string, unknown>)
    : {};

  const membership = clinicId
    ? await prisma.clinicMember.findUnique({
        where: { userId_clinicId: { userId, clinicId } },
        include: { clinic: { select: { id: true, name: true, city: true, plan: true } } },
      })
    : await prisma.clinicMember.findFirst({
        where: { userId },
        include: { clinic: { select: { id: true, name: true, city: true, plan: true } } },
      });

  const activeClinicId = clinicId || membership?.clinicId || null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    enrollments,
    monthAppts,
    completedAppts,
    unpaidInvoices,
  ] = await Promise.all([
    prisma.schoolEnrollment.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, category: true } } },
      take: 50,
    }).catch(() => []),
    activeClinicId
      ? prisma.appointment.count({
          where: {
            clinicId: activeClinicId,
            doctorId: userId,
            date: { gte: monthStart },
            status: { notIn: ['CANCELLED'] },
          },
        }).catch(() => 0)
      : Promise.resolve(0),
    activeClinicId
      ? prisma.appointment.count({
          where: {
            clinicId: activeClinicId,
            doctorId: userId,
            status: 'COMPLETED',
            date: { gte: monthStart },
          },
        }).catch(() => 0)
      : Promise.resolve(0),
    activeClinicId
      ? prisma.invoice.count({
          where: { clinicId: activeClinicId, status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        }).catch(() => 0)
      : Promise.resolve(0),
  ]);

  const completedCourses = enrollments.filter((e) => e.completed || e.progress >= 100);
  const inProgressCourses = enrollments.filter((e) => !e.completed && e.progress < 100);
  const categories = [...new Set(enrollments.map((e) => e.course?.category).filter(Boolean))] as string[];

  const specialty = String(user.spec || meta.specialty || meta.spec || 'Стоматолог');
  const skillsRaw = Array.isArray(meta.skills) ? meta.skills : [];
  const skills = skillsRaw.length
    ? skillsRaw.map((s: any) => ({
        name: String(s.name || s),
        level: typeof s.level === 'number' ? s.level : Number(s.level) || 50,
      }))
    : defaultSkillsForSpec(specialty).map((name) => ({ name, level: 60 }));

  const activityScore = monthAppts + completedCourses.length * 2 + inProgressCourses.length;
  const activityLevel =
    activityScore >= 40 ? 'very_active'
      : activityScore >= 20 ? 'active'
        : activityScore >= 8 ? 'moderate'
          : 'low';

  const learningPath = buildLearningPath(specialty, categories);

  return {
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    specialty,
    role: membership?.role || user.role,
    clinic: membership?.clinic || null,
    skills,
    completedCourses: completedCourses.length,
    inProgressCourses: inProgressCourses.length,
    courseCategories: categories,
    equipment: Array.isArray(meta.equipment) ? meta.equipment.map(String) : [],
    learningPath,
    activityLevel,
    kpis: [
      { label: 'Приёмов в месяце', value: String(monthAppts), change: '' },
      { label: 'Завершено', value: String(completedAppts), change: '' },
      { label: 'Курсов пройдено', value: String(completedCourses.length), change: '' },
      { label: 'Неоплаченных счетов клиники', value: String(unpaidInvoices), change: '' },
    ],
    recommendations: learningPath.slice(0, 3),
    aiAdvice: buildAdvice(specialty, activityLevel, inProgressCourses.length, unpaidInvoices),
    recentCourses: enrollments.slice(0, 5).map((e) => ({
      id: e.courseId,
      title: e.course?.title || e.courseId,
      progress: e.progress,
      completed: e.completed,
    })),
    builtAt: Date.now(),
  };
}

function defaultSkillsForSpec(spec: string): string[] {
  const s = spec.toLowerCase();
  if (s.includes('хирург')) return ['Хирургия', 'Имплантация', 'Анестезия', 'Диагностика'];
  if (s.includes('ортоп')) return ['Ортопедия', 'Протезирование', 'Диагностика', 'Эстетика'];
  if (s.includes('ортод')) return ['Ортодонтия', 'Диагностика', 'Эстетика'];
  return ['Терапия', 'Эндодонтия', 'Диагностика', 'Гигиена'];
}

function buildLearningPath(specialty: string, categories: string[]): string[] {
  const path: string[] = [];
  if (!categories.includes('Хирургия')) path.push('Курс «Хирургическая стоматология для терапевтов»');
  if (!categories.includes('Эндодонтия')) path.push('Вебинар «Микроскопная эндодонтия»');
  if (!categories.includes('Имплантация')) path.push('Курс «Основы имплантации»');
  path.push(`Углубление: ${specialty}`);
  return path;
}

function buildAdvice(specialty: string, activity: string, inProgress: number, unpaid: number): string {
  const parts: string[] = [];
  parts.push(`Ваш профиль: ${specialty}.`);
  if (activity === 'low') parts.push('Активность низкая — запланируйте приёмы или продолжите обучение.');
  if (inProgress > 0) parts.push(`У вас ${inProgress} курс(ов) в процессе — закройте прогресс для сертификата.`);
  if (unpaid > 0) parts.push(`В клинике ${unpaid} неоплаченных счетов — стоит проверить кассу.`);
  if (parts.length === 1) parts.push('Продолжайте в том же темпе — AI подскажет следующие шаги по обучению и расписанию.');
  return parts.join(' ');
}

export async function buildProactiveAlerts(opts: {
  userId: string;
  clinicId?: string | null;
  role?: string;
}): Promise<Array<{
  type: string;
  category: string;
  text: string;
  message: string;
  priority: number;
  action?: { type: string };
}>> {
  const alerts: Array<{
    type: string;
    category: string;
    text: string;
    message: string;
    priority: number;
    action?: { type: string };
  }> = [];

  const clinicId = opts.clinicId;
  if (!clinicId) {
    alerts.push({
      type: 'clinic',
      category: 'setup',
      text: 'Клиника не выбрана — переключите контекст в профиле',
      message: 'Клиника не выбрана — переключите контекст в профиле',
      priority: 6,
      action: { type: 'OpenProfile' },
    });
    return alerts;
  }

  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [
    unpaid,
    overdue,
    upcomingSoon,
    todayPending,
    lowStock,
    sub,
    unreadNotifs,
    inProgressCourses,
  ] = await Promise.all([
    prisma.invoice.count({ where: { clinicId, status: { in: ['UNPAID', 'PARTIAL'] } } }),
    prisma.invoice.count({ where: { clinicId, status: 'OVERDUE' } }),
    prisma.appointment.count({
      where: {
        clinicId,
        date: { gte: now, lte: in2h },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    }),
    prisma.appointment.count({
      where: {
        clinicId,
        date: { gte: dayStart, lte: tomorrow },
        status: 'PENDING',
      },
    }),
    prisma.inventoryItem.count({
      where: {
        clinicId,
        OR: [
          { quantity: { lte: 5 } },
          // Prisma can't compare two columns easily; low stock via quantity threshold
        ],
      },
    }).catch(() => 0),
    prisma.subscription.findUnique({
      where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
    }).catch(() => null),
    prisma.notification.count({
      where: { userId: opts.userId, read: false },
    }),
    prisma.schoolEnrollment.count({
      where: { userId: opts.userId, completed: false, progress: { lt: 100 } },
    }),
  ]);

  if (overdue > 0) {
    alerts.push({
      type: 'finance', category: 'billing',
      text: `Просроченных счетов: ${overdue}`,
      message: `Просроченных счетов: ${overdue}`,
      priority: 9,
      action: { type: 'OpenCashier' },
    });
  }
  if (unpaid > 0) {
    alerts.push({
      type: 'finance', category: 'billing',
      text: `Неоплаченных счетов: ${unpaid}`,
      message: `Неоплаченных счетов: ${unpaid}`,
      priority: 8,
      action: { type: 'OpenCashier' },
    });
  }
  if (upcomingSoon > 0) {
    alerts.push({
      type: 'schedule', category: 'appointments',
      text: `Ближайшие 2 часа: ${upcomingSoon} записей`,
      message: `Ближайшие 2 часа: ${upcomingSoon} записей`,
      priority: 8,
      action: { type: 'OpenSchedule' },
    });
  }
  if (todayPending > 0) {
    alerts.push({
      type: 'schedule', category: 'appointments',
      text: `Неподтверждённых записей сегодня/завтра: ${todayPending}`,
      message: `Неподтверждённых записей сегодня/завтра: ${todayPending}`,
      priority: 6,
      action: { type: 'OpenSchedule' },
    });
  }
  if (lowStock > 0) {
    alerts.push({
      type: 'inventory', category: 'stock',
      text: `Позиций с низким остатком: ${lowStock}`,
      message: `Позиций с низким остатком: ${lowStock}`,
      priority: 5,
      action: { type: 'OpenInventory' },
    });
  }
  if (sub?.periodEnd) {
    const days = Math.ceil((sub.periodEnd.getTime() - now.getTime()) / 86400000);
    if (sub.status === 'expired' || days < 0) {
      alerts.push({
        type: 'subscription', category: 'billing',
        text: 'Подписка клиники истекла — продлите тариф',
        message: 'Подписка клиники истекла — продлите тариф',
        priority: 9,
        action: { type: 'OpenBilling' },
      });
    } else if (days <= 14) {
      alerts.push({
        type: 'subscription', category: 'billing',
        text: `Подписка истекает через ${days} дн.`,
        message: `Подписка истекает через ${days} дн.`,
        priority: days <= 3 ? 9 : 7,
        action: { type: 'OpenBilling' },
      });
    }
  }
  if (inProgressCourses > 0) {
    alerts.push({
      type: 'learning', category: 'school',
      text: `Курсов в процессе: ${inProgressCourses}`,
      message: `Курсов в процессе: ${inProgressCourses}`,
      priority: 3,
      action: { type: 'OpenSchool' },
    });
  }
  if (unreadNotifs > 0) {
    alerts.push({
      type: 'notifications', category: 'inbox',
      text: `Непрочитанных уведомлений: ${unreadNotifs}`,
      message: `Непрочитанных уведомлений: ${unreadNotifs}`,
      priority: 4,
      action: { type: 'OpenNotifications' },
    });
  }

  return alerts.sort((a, b) => b.priority - a.priority).slice(0, 20);
}
