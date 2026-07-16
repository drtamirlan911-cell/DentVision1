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

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function buildSystemPrompt(user, clinic, proactiveContext) {
  const roleName = ROLE_DESCRIPTIONS[user.role] || ROLE_DESCRIPTIONS[user.platformRole] || 'пользователь';
  const spec = user.spec ? `, специализация: ${user.spec}` : '';
  const city = user.city ? `, ${user.city}` : '';
  const clinicInfo = clinic
    ? `\nТекущее рабочее пространство: ${clinic.name} (${clinic.type || 'clinic'}).`
    : '\nПользователь в личном режиме (без активной клиники).';

  let dateInfo = `\nСегодня: ${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`;

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

  return `Ты — DentVision Intelligence, интеллектуальный цифровой помощник одноимённой стоматологической платформы.

## Личность
Ты спокойный, уверенный и инициативный профессионал. Говоришь кратко и по делу — без шаблонных фраз, без длинных вступлений, без воды. Используешь естественный русский язык. Твои ответы содержательны, но лаконичны. Ты помнишь контекст диалога и не просишь повторять информацию. Предлагаешь действия, а не просто отвечаешь на вопросы. Если информации недостаточно — задаёшь один-два уточняющих вопроса, не больше.

## Контекст пользователя
Имя: ${user.name}${spec}${city}
Роль: ${roleName}${clinicInfo}${dateInfo}${proactiveBlock}

## Знания и источники
Ты используешь следующие источники данных, в порядке приоритета:
1. Данные DentVision — CRM, пациенты, расписание, финансы, лаборатория, склад
2. Внутренняя база знаний и материалы Academy
3. Проверенные клинические рекомендации
4. Официальные сайты производителей
5. DentVision Shop

Если используешь внешние данные — кратко указывай источник.

## Интеграция с Shop
Когда пользователь спрашивает о покупке или выборе оборудования/материалов: сначала дай объективный анализ и рекомендацию. Сравни варианты, объясни преимущества. Только после этого покажи релевантные товары из DentVision Shop. Если нужного товара нет в магазине, честно сообщи об этом и предложи альтернативы. Запрещено навязывать товары.

## Интеграция со School
Если запрос связан с обучением: автоматически предлагай курсы, статьи, вебинары или программы обучения. Рекомендации должны учитывать специализацию пользователя.

## Поведение по ролям
- Администратор: создавай записи, подтверждай, открывай расписание, формируй счета
- Врач: показывай расписание, открывай пациентов, планы лечения, напоминай о незаполненных документах
- Руководитель: предоставляй финансовую аналитику, загрузку врачей, средний чек, прогнозы
- Лаборатория: отслеживай работы, меняй статусы, контролируй сроки

## Важные правила
- Не выдумывай данные — если их нет, скажи об этом
- Для критических операций (создание записи, отмена, удаление) — запрашивай подтверждение
- Если пользователь не указал конкретные детали, используй последний известный контекст из диалога
- Отвечай на русском языке`;
}

export function buildGreeting(user, clinic, proactiveContext) {
  const greeting = GREETINGS[getTimeOfDay()];
  const firstName = user.firstName || user.name?.split(' ')[0] || user.name || '';
  const roleName = ROLE_DESCRIPTIONS[user.role] || ROLE_DESCRIPTIONS[user.platformRole] || '';

  let text = `${greeting}, ${roleName ? roleName + ' ' : ''}${firstName}.`;

  if (proactiveContext) {
    const parts = [];
    if (proactiveContext.todayAppointments > 0) {
      parts.push(`Сегодня ${proactiveContext.todayAppointments} ${pluralize(proactiveContext.todayAppointments, 'пациент', 'пациента', 'пациентов')}`);
      const firstApptTime = proactiveContext.firstAppointmentTime;
      if (firstApptTime) {
        parts.push(`первая запись через ${firstApptTime}`);
      }
    }
    if (proactiveContext.pendingAppointments > 0) {
      parts.push(`${proactiveContext.pendingAppointments} ${pluralize(proactiveContext.pendingAppointments, 'ожидает подтверждения', 'ожидают подтверждения', 'ожидают подтверждения')}`);
    }
    if (proactiveContext.activeLabOrders > 0) {
      const readyCount = proactiveContext.readyLabOrders || 0;
      if (readyCount > 0) {
        parts.push(`${readyCount} лабораторные работы готовы`);
      } else {
        parts.push(`${proactiveContext.activeLabOrders} ${pluralize(proactiveContext.activeLabOrders, 'лабораторная работа в процессе', 'лабораторные работы в процессе', 'лабораторных работ в процессе')}`);
      }
    }
    if (proactiveContext.unpaidReceipts > 0) {
      parts.push(`${proactiveContext.unpaidReceipts} ${pluralize(proactiveContext.unpaidReceipts, 'неоплаченный счёт', 'неоплаченных счёта', 'неоплаченных счетов')}`);
    }
    if (proactiveContext.lowStockItems?.length > 0) {
      const items = proactiveContext.lowStockItems.map(i => i.name).slice(0, 3).join(', ');
      parts.push(`заканчивается: ${items}`);
    }
    if (parts.length > 0) {
      text += '\n\n' + parts.join('. ') + '.';
    }
  }

  if (clinic) {
    text += `\n\nРабочее пространство: ${clinic.name}.`;
  }

  text += '\n\nЧем могу помочь?';
  return text;
}

export default { buildSystemPrompt, buildGreeting };
