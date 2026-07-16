// ═══════════════════════════════════════════════════════════════
// AI PERSONALITY — DentVision Intelligence system prompt + tone
// ═══════════════════════════════════════════════════════════════

const ROLE_DESCRIPTIONS = {
  owner: 'руководитель клиники',
  director: 'директор клиники',
  admin: 'администратор',
  doctor: 'стоматолог',
  assistant: 'ассистент',
  reception: 'рецепшн',
  cashier: 'кассир',
  laboratory: 'лаборант',
  accountant: 'бухгалтер',
  manager: 'менеджер',
  intern: 'интерн',
  user: 'пользователь',
  superadmin: 'администратор платформы',
};

const GREETINGS = {
  morning: 'Доброе утро',
  afternoon: 'Добрый день',
  evening: 'Добрый вечер',
  night: 'Доброй ночи',
};

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

function getGreetingTimeOfDay() {
  return GREETINGS[getTimeOfDay()];
}

export function buildSystemPrompt(user, clinic, proactiveContext) {
  const roleName = ROLE_DESCRIPTIONS[user.role] || ROLE_DESCRIPTIONS[user.platformRole] || 'пользователь';
  const spec = user.spec ? `, специализация: ${user.spec}` : '';
  const city = user.city ? `, ${user.city}` : '';
  const clinicInfo = clinic ? `\nТекущее рабочее пространство: ${clinic.name} (${clinic.type || 'clinic'}).` : '\nПользователь находится в личном режиме (без активной клиники).';

  let proactiveBlock = '';
  if (proactiveContext) {
    const items = [];
    if (proactiveContext.todayAppointments !== undefined) items.push(`- Записей на сегодня: ${proactiveContext.todayAppointments}`);
    if (proactiveContext.pendingAppointments !== undefined) items.push(`- Ожидают подтверждения: ${proactiveContext.pendingAppointments}`);
    if (proactiveContext.unpaidReceipts !== undefined) items.push(`- Неоплаченных счетов: ${proactiveContext.unpaidReceipts}`);
    if (proactiveContext.activeLabOrders !== undefined) items.push(`- Активных лабораторных заказов: ${proactiveContext.activeLabOrders}`);
    if (proactiveContext.totalPatients !== undefined) items.push(`- Всего пациентов: ${proactiveContext.totalPatients}`);
    if (proactiveContext.revenue !== undefined) items.push(`- Выручка: ${proactiveContext.revenue.toLocaleString('ru-RU')} ₸`);
    if (items.length > 0) {
      proactiveBlock = `\n\nТекущие данные клиники:\n${items.join('\n')}`;
    }
  }

  return `Ты — DentVision Intelligence, интеллектуальный цифровой помощник стоматологической платформы DentVision.

## Личность
- Спокойный, уверенный, инициативный профессионал
- Говоришь кратко и по делу, без шаблонных фраз и длинных вступлений
- Используешь естественный русский язык
- Помнишь контекст диалога — не просишь повторять информацию
- Предлагаешь действия, а не просто отвечаешь вопросами
- Если информации недостаточно — задаёшь уточняющие вопросы

## Контекст пользователя
- Имя: ${user.name}${spec}${city}
- Роль: ${roleName}${clinicInfo}${proactiveBlock}

## Поведение
- Если пользователь спрашивает про расписание — используй GetTodaySchedule
- Если спрашивает про пациента — используй SearchPatients или OpenPatient
- Если спрашивает про цены/товары — используй SearchShop или RecommendEquipment
- Если спрашивает про обучение — используй SearchCourses или RecommendCourses
- Если спрашивает про финансы — используй GetClinicStats или GetUnpaidReceipts
- Если спрашивает про лабораторию — используй GetActiveLabOrders
- Если просит создать/изменить что-то — используй соответствующее действие
- Всегда предлагай релевантные действия после ответа

## Интеграции
- Shop: рекомендуй товары из каталога DentVision Shop, если это уместно
- School: предлагай курсы из DentVision Academy по специализации пользователя
- CRM: работай с данными клиники в реальном времени

## Важные правила
- Не выдумывай данные — если их нет, скажи об этом
- При внешних рекомендациях указывай источник
- Не навязывай товары — давай объективные рекомендации
- Для критических операций (создание записи, отмена) — запрашивай подтверждение
- Отвечай на языке пользователя (русский по умолчанию)`;
}

export function buildGreeting(user, clinic, proactiveContext) {
  const greeting = getGreetingTimeOfDay();
  const firstName = user.firstName || user.name?.split(' ')[0] || user.name;
  const roleName = ROLE_DESCRIPTIONS[user.role] || ROLE_DESCRIPTIONS[user.platformRole] || '';

  let text = `${greeting}, ${roleName ? roleName + ' ' : ''}${firstName}.`;

  if (proactiveContext) {
    const parts = [];
    if (proactiveContext.todayAppointments > 0) {
      parts.push(`Сегодня ${proactiveContext.todayAppointments} ${pluralize(proactiveContext.todayAppointments, 'запись', 'записи', 'записей')}`);
    }
    if (proactiveContext.pendingAppointments > 0) {
      parts.push(`${proactiveContext.pendingAppointments} ${pluralize(proactiveContext.pendingAppointments, 'ожидает подтверждения', 'ожидают подтверждения', 'ожидают подтверждения')}`);
    }
    if (proactiveContext.activeLabOrders > 0) {
      parts.push(`${proactiveContext.activeLabOrders} ${pluralize(proactiveContext.activeLabOrders, 'лабораторная работа', 'лабораторные работы', 'лабораторных работ')} в работе`);
    }
    if (proactiveContext.unpaidReceipts > 0) {
      parts.push(`${proactiveContext.unpaidReceipts} ${pluralize(proactiveContext.unpaidReceipts, 'неоплаченный счёт', 'неоплаченных счёта', 'неоплаченных счетов')}`);
    }
    if (parts.length > 0) {
      text += '\n\n' + parts.join('. ') + '.';
    }
  }

  if (clinic) {
    text += `\n\nРабочее пространство: ${clinic.name}.`;
  } else {
    text += '\n\nВы в личном режиме.';
  }

  text += '\n\nЧем могу помочь?';
  return text;
}

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export default { buildSystemPrompt, buildGreeting };
