/**
 * Build a live digital twin for the authenticated user from clinic + school data.
 * Profile title, skills, KPIs and advice follow clinic membership role —
 * admins are not treated as dentists.
 */
import prisma from '../../../lib/prisma.js';

type TwinRole =
  | 'OWNER'
  | 'ADMIN'
  | 'DOCTOR'
  | 'ASSISTANT'
  | 'MANAGER'
  | 'LAB'
  | 'STUDENT'
  | 'SUPERADMIN'
  | string;

const ROLE_LABEL_RU: Record<string, string> = {
  OWNER: 'Руководитель',
  DIRECTOR: 'Руководитель',
  ADMIN: 'Администратор',
  DOCTOR: 'Врач',
  ASSISTANT: 'Ассистент',
  MANAGER: 'Менеджер',
  LAB: 'Лаборатория',
  STUDENT: 'Студент',
  SUPERADMIN: 'Платформа',
  CASHIER: 'Администратор',
};

function normalizeRole(raw?: string | null): TwinRole {
  const r = String(raw || '').toUpperCase();
  if (r === 'DIRECTOR') return 'OWNER';
  if (r === 'CASHIER') return 'ADMIN';
  return r || 'DOCTOR';
}

function isClinicalDoctor(role: TwinRole): boolean {
  return role === 'DOCTOR';
}

function isClinicOps(role: TwinRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || role === 'SUPERADMIN';
}

/** Product guide twin for anonymous guests — not an empty clinic CRM profile. */
function sanitizeGuestDisplayName(raw?: string | null): string {
  const v = String(raw || '').trim();
  if (!v || /Р.|Ð.|Ñ./.test(v) || !/[А-Яа-яA-Za-z]/.test(v)) return 'Гость';
  if (/^gost/i.test(v)) return 'Гость';
  return v;
}

export function buildGuestPlatformTwin(user?: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null) {
  const rawName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    || (user?.email?.endsWith('@guest.local') ? 'Гость' : null)
    || 'Гость';
  const name = sanitizeGuestDisplayName(rawName);

  return {
    role: 'GUEST',
    roleLabel: 'Гость',
    profileKind: 'platform' as const,
    name: sanitizeGuestDisplayName(name),
    title: 'Гид по DentVision',
    specialty: 'Платформенный гид',
    clinic: null,
    skills: [
      { name: 'CRM клиники', level: 72 },
      { name: 'Маркетплейс', level: 68 },
      { name: 'Academy OS', level: 65 },
      { name: 'ИИ-ассистент', level: 80 },
    ],
    completedCourses: 0,
    inProgressCourses: 0,
    equipment: [] as string[],
    learningPath: [
      'Открыть демо-клинику и посмотреть CRM',
      'Заглянуть в Academy OS — курсы и вебинары',
      'Зарегистрироваться и подключить свою клинику',
    ],
    recommendations: [
      'Спросите ИИ: «Чем полезен DentVision?»',
      'Откройте демо, чтобы увидеть расписание и кассу в деле',
      'После входа двойник станет живым профилем вашей роли',
    ],
    activityLevel: 'exploring',
    kpis: [
      { label: 'Модули платформы', value: 'CRM · Shop · School', change: '' },
      { label: 'ИИ для гостя', value: 'Гид', change: '' },
      { label: 'Демо клиника', value: 'Доступно', change: '' },
      { label: 'Регистрация', value: 'Бесплатно', change: '' },
    ],
    aiAdvice:
      'Я гид по DentVision: помогу разобраться в CRM, маркетплейсе и Academy. Данные вашей клиники появятся после входа — пока могу рассказать о возможностях или открыть демо.',
    recentCourses: [] as Array<{ title: string; progress: number; completed: boolean }>,
  };
}

export async function buildDigitalTwin(userId: string, clinicId?: string | null, opts?: { isGuest?: boolean }) {
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

  const guestByEmail = String(user.email || '').endsWith('@guest.local');
  if (opts?.isGuest || guestByEmail) {
    return buildGuestPlatformTwin(user);
  }

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
  const role = normalizeRole(membership?.role || user.role);
  const roleLabel = ROLE_LABEL_RU[role] || String(role);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [
    enrollments,
    monthAppts,
    completedAppts,
    unpaidInvoices,
    todayAppts,
    staffCount,
    patientCount,
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
            ...(isClinicalDoctor(role) ? { doctorId: userId } : {}),
            date: { gte: monthStart },
            status: { notIn: ['cancelled'] },
          },
        }).catch(() => 0)
      : Promise.resolve(0),
    activeClinicId
      ? prisma.appointment.count({
          where: {
            clinicId: activeClinicId,
            ...(isClinicalDoctor(role) ? { doctorId: userId } : {}),
            status: 'completed',
            date: { gte: monthStart },
          },
        }).catch(() => 0)
      : Promise.resolve(0),
    activeClinicId
      ? prisma.invoice.count({
          where: { clinicId: activeClinicId, status: { in: ['unpaid', 'partial', 'overdue'] } },
        }).catch(() => 0)
      : Promise.resolve(0),
    activeClinicId
      ? prisma.appointment.count({
          where: {
            clinicId: activeClinicId,
            date: { gte: dayStart, lt: dayEnd },
            status: { notIn: ['cancelled'] },
          },
        }).catch(() => 0)
      : Promise.resolve(0),
    activeClinicId && isClinicOps(role)
      ? prisma.clinicMember.count({ where: { clinicId: activeClinicId } }).catch(() => 0)
      : Promise.resolve(0),
    activeClinicId && isClinicOps(role)
      ? prisma.patient.count({ where: { clinicId: activeClinicId } }).catch(() => 0)
      : Promise.resolve(0),
  ]);

  const completedCourses = enrollments.filter((e) => e.completed || e.progress >= 100);
  const inProgressCourses = enrollments.filter((e) => !e.completed && e.progress < 100);
  const categories = [...new Set(enrollments.map((e) => e.course?.category).filter(Boolean))] as string[];

  // Doctors may keep clinical specialty; others use role title — never force «Стоматолог».
  const clinicalSpec = String(user.spec || meta.specialty || meta.spec || '').trim();
  const specialty = isClinicalDoctor(role)
    ? (clinicalSpec || 'Стоматолог')
    : (clinicalSpec && !looksLikeGenericDentist(clinicalSpec) ? clinicalSpec : roleLabel);

  const skillsRaw = Array.isArray(meta.skills) ? meta.skills : [];
  const skills = skillsRaw.length
    ? skillsRaw.map((s: any) => ({
        name: String(s.name || s),
        level: typeof s.level === 'number' ? s.level : Number(s.level) || 50,
      }))
    : defaultSkillsForRole(role, specialty).map((name) => ({ name, level: 60 }));

  const activityScore = monthAppts + completedCourses.length * 2 + inProgressCourses.length;
  const activityLevel =
    activityScore >= 40 ? 'very_active'
      : activityScore >= 20 ? 'active'
        : activityScore >= 8 ? 'moderate'
          : 'low';

  const learningPath = buildLearningPath(role, specialty, categories);
  const kpis = buildKpis({
    role,
    monthAppts,
    completedAppts,
    completedCourses: completedCourses.length,
    unpaidInvoices,
    todayAppts,
    staffCount,
    patientCount,
  });

  return {
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    specialty,
    title: specialty,
    role,
    roleLabel,
    profileKind: isClinicalDoctor(role) ? 'doctor' : isClinicOps(role) ? 'ops' : 'staff',
    clinic: membership?.clinic || null,
    skills,
    completedCourses: completedCourses.length,
    inProgressCourses: inProgressCourses.length,
    courseCategories: categories,
    equipment: Array.isArray(meta.equipment) ? meta.equipment.map(String) : [],
    learningPath,
    activityLevel,
    kpis,
    recommendations: learningPath.slice(0, 3),
    aiAdvice: buildAdvice({
      role,
      roleLabel,
      specialty,
      activity: activityLevel,
      inProgress: inProgressCourses.length,
      unpaid: unpaidInvoices,
      todayAppts,
    }),
    recentCourses: enrollments.slice(0, 5).map((e) => ({
      id: e.courseId,
      title: e.course?.title || e.courseId,
      progress: e.progress,
      completed: e.completed,
    })),
    builtAt: Date.now(),
  };
}

function looksLikeGenericDentist(spec: string): boolean {
  const s = spec.toLowerCase();
  return s === 'стоматолог' || s === 'dentist' || s === 'врач' || s === 'doctor';
}

function defaultSkillsForRole(role: TwinRole, specialty: string): string[] {
  if (role === 'OWNER' || role === 'SUPERADMIN') {
    return ['Управление клиникой', 'Финансы', 'Команда', 'Качество сервиса'];
  }
  if (role === 'ADMIN' || role === 'MANAGER') {
    return ['Расписание', 'Регистрация пациентов', 'Касса', 'Коммуникация'];
  }
  if (role === 'ASSISTANT') {
    return ['Ассистирование', 'Стерилизация', 'Подготовка кабинета', 'Коммуникация'];
  }
  if (role === 'LAB') {
    return ['Зуботехника', 'Материалы', 'Качество работы', 'Сроки заказов'];
  }
  if (role === 'STUDENT') {
    return ['Теория', 'Практика', 'Диагностика', 'Гигиена'];
  }
  return defaultSkillsForSpec(specialty);
}

function defaultSkillsForSpec(spec: string): string[] {
  const s = spec.toLowerCase();
  if (s.includes('хирург')) return ['Хирургия', 'Имплантация', 'Анестезия', 'Диагностика'];
  if (s.includes('ортоп')) return ['Ортопедия', 'Протезирование', 'Диагностика', 'Эстетика'];
  if (s.includes('ортод')) return ['Ортодонтия', 'Диагностика', 'Эстетика'];
  return ['Терапия', 'Эндодонтия', 'Диагностика', 'Гигиена'];
}

function buildKpis(opts: {
  role: TwinRole;
  monthAppts: number;
  completedAppts: number;
  completedCourses: number;
  unpaidInvoices: number;
  todayAppts: number;
  staffCount: number;
  patientCount: number;
}): Array<{ label: string; value: string; change: string }> {
  const {
    role, monthAppts, completedAppts, completedCourses,
    unpaidInvoices, todayAppts, staffCount, patientCount,
  } = opts;

  if (isClinicOps(role)) {
    return [
      { label: 'Записей сегодня', value: String(todayAppts), change: '' },
      { label: 'Записей в месяце', value: String(monthAppts), change: '' },
      { label: 'Пациентов в базе', value: String(patientCount), change: '' },
      { label: 'Сотрудников', value: String(staffCount), change: '' },
      { label: 'Курсов пройдено', value: String(completedCourses), change: '' },
      { label: 'Неоплаченных счетов', value: String(unpaidInvoices), change: '' },
    ];
  }

  if (role === 'ASSISTANT' || role === 'LAB' || role === 'STUDENT') {
    return [
      { label: 'Сменных задач / записей (мес.)', value: String(monthAppts), change: '' },
      { label: 'Завершено', value: String(completedAppts), change: '' },
      { label: 'Курсов пройдено', value: String(completedCourses), change: '' },
      { label: 'Неоплаченных счетов клиники', value: String(unpaidInvoices), change: '' },
    ];
  }

  // Doctor
  return [
    { label: 'Приёмов в месяце', value: String(monthAppts), change: '' },
    { label: 'Завершено', value: String(completedAppts), change: '' },
    { label: 'Курсов пройдено', value: String(completedCourses), change: '' },
    { label: 'Неоплаченных счетов клиники', value: String(unpaidInvoices), change: '' },
  ];
}

function buildLearningPath(role: TwinRole, specialty: string, categories: string[]): string[] {
  const path: string[] = [];

  if (isClinicOps(role)) {
    if (!categories.includes('Управление')) path.push('Курс «Управление стоматологической клиникой»');
    if (!categories.includes('Финансы')) path.push('Вебинар «Касса и контроль дебиторки»');
    if (!categories.includes('Сервис')) path.push('Курс «Сервис и работа с пациентами»');
    path.push(`Развитие роли: ${ROLE_LABEL_RU[role] || specialty}`);
    return path;
  }

  if (role === 'ASSISTANT') {
    if (!categories.includes('Ассистирование')) path.push('Курс «Ассистент стоматолога: базовый протокол»');
    if (!categories.includes('Стерилизация')) path.push('Вебинар «Стерилизация и инфекционный контроль»');
    path.push('Курс «Коммуникация с пациентом на ресепшене»');
    return path;
  }

  if (role === 'LAB') {
    path.push('Курс «Цифровая зуботехника»');
    path.push('Вебинар «Материалы и качество протезов»');
    path.push(`Углубление: ${specialty}`);
    return path;
  }

  if (role === 'STUDENT') {
    path.push('Курс «Основы терапевтической стоматологии»');
    path.push('Вебинар «Диагностика для начинающих»');
    path.push('Курс «Гигиена и профилактика»');
    return path;
  }

  // Doctor clinical path
  if (!categories.includes('Хирургия')) path.push('Курс «Хирургическая стоматология для терапевтов»');
  if (!categories.includes('Эндодонтия')) path.push('Вебинар «Микроскопная эндодонтия»');
  if (!categories.includes('Имплантация')) path.push('Курс «Основы имплантации»');
  path.push(`Углубление: ${specialty}`);
  return path;
}

function buildAdvice(opts: {
  role: TwinRole;
  roleLabel: string;
  specialty: string;
  activity: string;
  inProgress: number;
  unpaid: number;
  todayAppts: number;
}): string {
  const { role, roleLabel, specialty, activity, inProgress, unpaid, todayAppts } = opts;
  const parts: string[] = [];

  if (isClinicalDoctor(role)) {
    parts.push(`Ваш профиль: ${specialty} (${roleLabel}).`);
  } else {
    parts.push(`Ваш профиль: ${roleLabel}${specialty !== roleLabel ? ` · ${specialty}` : ''}.`);
  }

  if (isClinicOps(role)) {
    if (activity === 'low') {
      parts.push('Активность низкая — проверьте расписание на сегодня и загрузку команды.');
    }
    if (todayAppts > 0) {
      parts.push(`Сегодня в клинике ${todayAppts} записей.`);
    }
    if (unpaid > 0) {
      parts.push(`В клинике ${unpaid} неоплаченных счетов — стоит проверить кассу.`);
    }
  } else if (isClinicalDoctor(role)) {
    if (activity === 'low') {
      parts.push('Активность низкая — запланируйте приёмы или продолжите обучение.');
    }
    if (unpaid > 0) {
      parts.push(`В клинике ${unpaid} неоплаченных счетов — уточните у администратора.`);
    }
  } else if (activity === 'low') {
    parts.push('Активность низкая — продолжите обучение или уточните задачи у руководителя.');
  }

  if (inProgress > 0) {
    parts.push(`У вас ${inProgress} курс(ов) в процессе — закройте прогресс для сертификата.`);
  }
  if (parts.length === 1) {
    parts.push('Продолжайте в том же темпе — AI подскажет следующие шаги по роли и обучению.');
  }
  return parts.join(' ');
}

export async function buildProactiveAlerts(opts: {
  userId: string;
  clinicId?: string | null;
  role?: string;
  isGuest?: boolean;
}): Promise<Array<{
  type: string;
  category: string;
  text: string;
  message: string;
  priority: number;
  action?: { type: string; path?: string };
}>> {
  const alerts: Array<{
    type: string;
    category: string;
    text: string;
    message: string;
    priority: number;
    action?: { type: string; path?: string };
  }> = [];

  const guestRole = String(opts.role || '').toUpperCase() === 'GUEST' || opts.isGuest;
  const clinicId = opts.clinicId;
  if (!clinicId) {
    if (guestRole) {
      alerts.push(
        {
          type: 'platform',
          category: 'product',
          text: 'Откройте демо-клинику — посмотрите CRM без регистрации',
          message: 'Откройте демо-клинику — посмотрите CRM без регистрации',
          priority: 5,
          action: { type: 'OpenDemo' },
        },
        {
          type: 'platform',
          category: 'product',
          text: 'Academy OS: курсы и вебинары для стоматологов',
          message: 'Academy OS: курсы и вебинары для стоматологов',
          priority: 4,
          action: { type: 'OpenSchool' },
        },
        {
          type: 'platform',
          category: 'product',
          text: 'Маркетплейс — закупки у поставщиков в одном месте',
          message: 'Маркетплейс — закупки у поставщиков в одном месте',
          priority: 3,
          action: { type: 'OpenShop' },
        },
      );
      return alerts;
    }
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
    inventoryRows,
    sub,
    unreadNotifs,
    inProgressCourses,
    dentCashWallet,
  ] = await Promise.all([
    prisma.invoice.count({ where: { clinicId, status: { in: ['unpaid', 'partial'] } } }).catch(() => 0),
    prisma.invoice.count({ where: { clinicId, status: 'overdue' } }).catch(() => 0),
    prisma.appointment.count({
      where: {
        clinicId,
        date: { gte: now, lte: in2h },
        status: { in: ['confirmed', 'pending'] },
      },
    }).catch(() => 0),
    prisma.appointment.count({
      where: {
        clinicId,
        date: { gte: dayStart, lte: tomorrow },
        status: 'pending',
      },
    }).catch(() => 0),
    prisma.inventoryItem.findMany({
      where: { clinicId },
      select: { id: true, name: true, quantity: true, minimum: true, category: true },
      take: 300,
    }).catch(() => [] as Array<{ id: string; name: string; quantity: number; minimum: number | null; category: string | null }>),
    prisma.subscription.findUnique({
      where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
    }).catch(() => null),
    prisma.notification.count({
      where: { userId: opts.userId, read: false },
    }).catch(() => 0),
    prisma.schoolEnrollment.count({
      where: { userId: opts.userId, completed: false, progress: { lt: 100 } },
    }).catch(() => 0),
    prisma.wallet.findUnique({
      where: {
        ownerType_ownerId_currency: {
          ownerType: 'USER',
          ownerId: opts.userId,
          currency: 'KZT',
        },
      },
    }).catch(() => null),
  ]);

  const lowStockItems = (inventoryRows || []).filter(
    (i) => (i.minimum ?? 0) > 0 && i.quantity <= (i.minimum ?? 0),
  );
  const lowStock = lowStockItems.length;

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
    const sample = lowStockItems.slice(0, 3).map((i) => i.name).filter(Boolean);
    const sampleText = sample.length ? `: ${sample.join(', ')}${lowStock > sample.length ? '…' : ''}` : '';

    // Prefer marketplace when we can match clinic items to shop products / analogs.
    let shopHitName: string | null = null;
    let shopQuery = sample[0] || '';
    try {
      for (const item of lowStockItems.slice(0, 5)) {
        const token = String(item.name || '').trim().split(/\s+/)[0];
        if (!token || token.length < 3) continue;
        const hit = await prisma.product.findFirst({
          where: {
            stock: { gt: 0 },
            OR: [
              { name: { contains: item.name, mode: 'insensitive' } },
              { name: { contains: token, mode: 'insensitive' } },
              ...(item.category
                ? [{ category: { contains: item.category, mode: 'insensitive' as const } }]
                : []),
            ],
          },
          select: { id: true, name: true },
          orderBy: { rating: 'desc' },
        });
        if (hit) {
          shopHitName = hit.name;
          shopQuery = item.name;
          break;
        }
      }
    } catch {
      /* shop catalog optional */
    }

    if (shopHitName) {
      alerts.push({
        type: 'inventory',
        category: 'stock',
        text: `Склад клиники: мало ${lowStock} поз.${sampleText}. В маркете есть «${shopHitName}» (или аналог)`,
        message: `Склад клиники: мало ${lowStock} поз.${sampleText}. В маркете есть «${shopHitName}» (или аналог)`,
        priority: 7,
        action: { type: 'OpenShop', path: `/shop?q=${encodeURIComponent(shopQuery)}` },
      });
    } else {
      alerts.push({
        type: 'inventory',
        category: 'stock',
        text: `На складе клиники заканчивается ${lowStock} позици${lowStock === 1 ? 'я' : lowStock < 5 ? 'и' : 'й'}${sampleText}`,
        message: `На складе клиники заканчивается ${lowStock} позици${lowStock === 1 ? 'я' : lowStock < 5 ? 'и' : 'й'}${sampleText}`,
        priority: 6,
        action: { type: 'OpenInventory' },
      });
    }
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

  const dentCashTenge = dentCashWallet?.balance != null
    ? Number(dentCashWallet.balance) / 100
    : 0;
  if (dentCashTenge >= 5000) {
    alerts.push({
      type: 'dentcash',
      category: 'wallet',
      text: `На Dent Wallet ${Math.round(dentCashTenge).toLocaleString('ru-KZ')} ₸ — можно списать в магазине или на курс`,
      message: `На Dent Wallet ${Math.round(dentCashTenge).toLocaleString('ru-KZ')} ₸ — можно списать в магазине или на курс`,
      priority: 3,
      action: { type: 'OpenShop' },
    });
  }

  // Proactive clinic load — tell admin about recall / open plans / empty slots without waiting for a question.
  try {
    const { buildClinicLoadSignals } = await import('./clinicLoadPlan.js');
    const signals = await buildClinicLoadSignals(clinicId);
    alerts.push(...signals.alerts);
  } catch (e) {
    console.warn('[proactive] clinic load signals failed', e);
  }

  // ─── Diagnostics referrals awaiting action ───
  try {
    const [pendingReferrals, pendingResults] = await Promise.all([
      prisma.referral.count({
        where: { clinicId, status: { in: ['SENT', 'DRAFT', 'SCHEDULED'] } },
      }),
      prisma.referral.count({
        where: {
          clinicId,
          status: { in: ['COMPLETED', 'REVIEWED'] },
          result: { signedBy: null },
        },
      }),
    ]);
    if (pendingReferrals > 0) {
      alerts.push({
        type: 'pending_referral', category: 'diagnostics',
        text: `Направлений на диагностику: ${pendingReferrals} в работе`,
        message: `Направлений на диагностику: ${pendingReferrals} в работе`,
        priority: 6,
        action: { type: 'OpenDiagnostics', path: `/diagnostics?filter=pending` },
      });
    }
    if (pendingResults > 0) {
      alerts.push({
        type: 'pending_result', category: 'diagnostics',
        text: `Результатов диагностики ждут подписи: ${pendingResults}`,
        message: `Результатов диагностики ждут подписи: ${pendingResults}`,
        priority: 8,
        action: { type: 'OpenDiagnostics', path: `/diagnostics?filter=results` },
      });
    }
  } catch { /* optional */ }

  // ─── Marketplace orders awaiting action ───
  try {
    const newOrders = await prisma.order.count({
      where: { clinicId, status: { in: ['pending', 'confirmed', 'processing'] } },
    });
    if (newOrders > 0) {
      alerts.push({
        type: 'new_order', category: 'marketplace',
        text: `Заказов в маркетплейсе: ${newOrders} в обработке`,
        message: `Заказов в маркетплейсе: ${newOrders} в обработке`,
        priority: 6,
        action: { type: 'OpenMarketplace', path: '/shop?filter=orders' },
      });
    }
  } catch { /* optional */ }

  // ─── Lab orders awaiting action ───
  try {
    const pendingLab = await prisma.labOrder.count({
      where: { clinicId, status: { in: ['pending', 'in_progress'] } },
    });
    if (pendingLab > 0) {
      alerts.push({
        type: 'pending_lab', category: 'lab',
        text: `Лабораторных заказов в работе: ${pendingLab}`,
        message: `Лабораторных заказов в работе: ${pendingLab}`,
        priority: 6,
        action: { type: 'OpenLab', path: '/crm/lab' },
      });
    }
  } catch { /* optional */ }

  // ─── New appointments today (not yet seen by staff) ───
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayNew = await prisma.appointment.count({
      where: { clinicId, date: today, status: { in: ['pending', 'confirmed'] } },
    });
    if (todayNew > 0) {
      alerts.push({
        type: 'today_appointments', category: 'schedule',
        text: `Сегодня записей: ${todayNew}. Проверьте расписание.`,
        message: `Сегодня записей: ${todayNew}. Проверьте расписание.`,
        priority: 7,
        action: { type: 'OpenSchedule', path: '/crm/schedule?filter=today' },
      });
    }
  } catch { /* optional */ }

  const sorted = alerts.sort((a, b) => b.priority - a.priority);
  try {
    const { filterAlertsForRole } = await import('./jarvisBriefing.js');
    return filterAlertsForRole(sorted, opts.role).slice(0, 30);
  } catch {
    return sorted.slice(0, 30);
  }
}

// ─── Screen-aware contextual suggestions ───

export type ProactiveSuggestionAction = { type: string; path?: string };

export interface ProactiveSuggestion {
  type: string;
  text: string;
  priority: number;
  action?: ProactiveSuggestionAction;
  icon?: string;
}

/**
 * Pure function: given the user's twin role, the current screen route, and
 * already-computed alerts, return screen-contextual suggestions (top 5).
 */
export function buildContextualSuggestions(
  twin: { role?: string; kpis?: Array<{ label: string; value: unknown }> },
  screen: string,
  alerts: Array<{ text: string; priority: number; type: string; action?: ProactiveSuggestionAction }>,
): ProactiveSuggestion[] {
  const role = String(twin.role || '').toUpperCase();
  const suggestions: ProactiveSuggestion[] = [];

  const screenMap: Array<{ match: RegExp; suggestions: () => ProactiveSuggestion[] }> = [
    {
      match: /schedule|appointment|calendar/i,
      suggestions: () => {
        const items: ProactiveSuggestion[] = [
          { type: 'schedule', text: 'Откройте расписание — видны загрузка врачей и свободные слоты', priority: 5, action: { type: 'Navigate', params: { to: '/crm/schedule' } } },
        ];
        const todayAppt = alerts.find(a => a.type === 'today_appointments');
        if (todayAppt) items.push({ type: 'appointment', text: todayAppt.text, priority: 7, action: { type: 'FilterToday' } });
        const recall = alerts.find(a => a.type === 'recall');
        if (recall) items.push({ type: 'recall', text: recall.text, priority: 8, action: recall.action });
        return items;
      },
    },
    {
      match: /patient|medical/i,
      suggestions: () => {
        const items: ProactiveSuggestion[] = [
          { type: 'patients', text: 'Поиск по имени, телефону или ИИН — быстро найти карту', priority: 4, action: { type: 'FocusSearch' } },
        ];
        const openPlans = alerts.find(a => a.type === 'open_treatment_plans');
        if (openPlans) items.push({ type: 'treatment', text: openPlans.text, priority: 6, action: openPlans.action });
        const followUp = alerts.find(a => a.type === 'follow_up');
        if (followUp) items.push({ type: 'followup', text: followUp.text, priority: 7, action: followUp.action });
        return items;
      },
    },
    {
      match: /billing|invoice|payment|finance/i,
      suggestions: () => {
        const items: ProactiveSuggestion[] = [];
        const overdue = alerts.filter(a => a.type === 'overdue_invoice');
        if (overdue.length) items.push({ type: 'overdue', text: `${overdue.length} просроченных счёта — отправьте напоминание`, priority: 9, action: { type: 'FilterOverdue' } });
        const subscription = alerts.find(a => a.type === 'subscription');
        if (subscription) items.push({ type: 'subscription', text: subscription.text, priority: 8, action: subscription.action });
        return items;
      },
    },
    {
      match: /inventory|stock|warehouse/i,
      suggestions: () => {
        const items: ProactiveSuggestion[] = [];
        const low = alerts.filter(a => a.type === 'low_inventory');
        if (low.length) items.push({ type: 'low_stock', text: `${low.length} позиций на минимуме — пора заказать`, priority: 8, action: { type: 'FilterLow' } });
        return items;
      },
    },
    {
      match: /diagnostic|referral|center|lab/i,
      suggestions: () => {
        const items: ProactiveSuggestion[] = [
          { type: 'diagnostics', text: 'Проверьте inbox — результаты диагностики ждут подписи', priority: 7, action: { type: 'Navigate', params: { to: '/diagnostics/referrals' } } },
        ];
        const pending = alerts.filter(a => a.type === 'pending_referral');
        if (pending.length) items.push({ type: 'pending', text: `${pending.length} направлений в работе`, priority: 7, action: { type: 'FilterPending' } });
        return items;
      },
    },
    {
      match: /marketplace|shop|order/i,
      suggestions: () => {
        const items: ProactiveSuggestion[] = [];
        const orders = alerts.find(a => a.type === 'new_order');
        if (orders) items.push({ type: 'orders', text: orders.text, priority: 7, action: orders.action });
        if (role === 'OWNER' || role === 'ADMIN' || role === 'SUPERADMIN') {
          items.push({ type: 'commission', text: 'Отчёт по комиссиям маркетплейса доступен в BI', priority: 4, action: { type: 'Navigate', params: { to: '/crm/bi' } } });
        }
        return items;
      },
    },
    {
      match: /school|academy|course/i,
      suggestions: () => {
        const items: ProactiveSuggestion[] = [
          { type: 'courses', text: 'Новые курсы и вебинары — записывайте сотрудников', priority: 4, action: { type: 'Navigate', params: { to: '/school' } } },
        ];
        return items;
      },
    },
  ];

  // Match first applicable screen
  for (const entry of screenMap) {
    if (entry.match.test(screen)) {
      suggestions.push(...entry.suggestions());
      break;
    }
  }

  // Always append top-priority cross-cutting alerts
  const topAlerts = alerts.filter(a => a.priority >= 8).slice(0, 3);
  for (const a of topAlerts) {
    suggestions.push({ type: a.type, text: a.text, priority: a.priority, action: a.action as ProactiveSuggestionAction });
  }

  return suggestions.slice(0, 5);
}
