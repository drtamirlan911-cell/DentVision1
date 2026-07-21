/** Curated Academy OS commerce content — webinars & office courses first. */

export const CLINICAL_CASES = [
  {
    id: 'case-endo-01',
    title: 'Ревизия каналов 16 зуба с перфорацией',
    description: 'Повторное эндодонтическое лечение с закрытием перфорации MTA и восстановлением культи.',
    category: 'Эндодонтия',
    difficulty: 'advanced',
    diagnosis: 'K04.5 Хронический апикальный периодонтит, перфорация',
    author: 'Dr. Айгерим Нурланова',
    tags: ['MTA', 'микроскоп', 'ревизия'],
  },
  {
    id: 'case-impl-01',
    title: 'Имплантация в эстетической зоне 11–21',
    description: 'Немедленная имплантация с временными коронками и мягкотканной пластикой.',
    category: 'Имплантация',
    difficulty: 'advanced',
    diagnosis: 'Частичная адентия 11, 21',
    author: 'Dr. Timur Bek',
    tags: ['эстетика', 'немедленная нагрузка'],
  },
  {
    id: 'case-ortho-01',
    title: 'Элайнеры при скученности и открытом прикусе',
    description: 'Цифровой план, IPR, аттачменты, контроль через 6 месяцев.',
    category: 'Ортодонтия',
    difficulty: 'intermediate',
    diagnosis: 'Скученность, открытый прикус',
    author: 'Dr. Sara Kim',
    tags: ['элайнеры', 'цифровой план'],
  },
  {
    id: 'case-perio-01',
    title: 'Закрытый кюретаж + лазерная поддержка',
    description: 'Пародонтит стадии II, протокол гигиены и поддержка лазером.',
    category: 'Пародонтология',
    difficulty: 'beginner',
    diagnosis: 'Хронический генерализованный пародонтит',
    author: 'Dr. Ольга Смирнова',
    tags: ['кюретаж', 'лазер'],
  },
  {
    id: 'case-prost-01',
    title: 'Циркониевые коронки на 14–16 после санации',
    description: 'Wax-up, временные коронки, финальная фиксация на dual-cure цемент.',
    category: 'Ортопедия',
    difficulty: 'intermediate',
    diagnosis: 'Разрушение коронок 14–16',
    author: 'Dr. Алексей Петров',
    tags: ['цирконий', 'wax-up'],
  },
];

export const LIBRARY_ITEMS = [
  { id: 'lib-1', title: 'Протокол эндодонтии под микроскопом', type: 'PDF', category: 'Эндодонтия', author: 'Academy OS', pages: 24 },
  { id: 'lib-2', title: 'Чек-лист имплантации в эстетической зоне', type: 'PDF', category: 'Имплантация', author: 'Academy OS', pages: 8 },
  { id: 'lib-3', title: 'Фотопротокол улыбки — 12 ракурсов', type: 'PDF', category: 'Фотография', author: 'Academy OS', pages: 12 },
  { id: 'lib-4', title: 'AI в диагностике кариеса — обзор 2026', type: 'Статья', category: 'AI', author: 'DentVision Research', pages: 6 },
  { id: 'lib-5', title: 'Юридический чек-лист информированного согласия РК', type: 'PDF', category: 'Юридические вопросы', author: 'Academy OS', pages: 10 },
  { id: 'lib-6', title: 'Шаблоны плана лечения для пациента', type: 'Шаблон', category: 'Менеджмент', author: 'Academy OS', pages: 4 },
];

/** Paid webinars — primary online commerce format. */
export function upcomingWebinars() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'wb-1',
      format: 'webinar' as const,
      title: 'Ревизия каналов под микроскопом — live demo',
      lecturer: 'Dr. Айгерим Нурланова',
      academy: 'EndoLab Academy',
      category: 'Эндодонтия',
      startsAt: new Date(now + 2 * day).toISOString(),
      durationMin: 90,
      seats: 120,
      enrolled: 86,
      price: 25000,
      currency: 'KZT',
      includes: ['Запись 30 дней', 'PDF-протокол', 'Q&A'],
      certificate: false,
      status: 'scheduled',
    },
    {
      id: 'wb-2',
      format: 'webinar' as const,
      title: 'Цифровой Wax-Up и коммуникация с лабораторией',
      lecturer: 'Dr. Алексей Петров',
      academy: 'Prostho Hub',
      category: 'Ортопедия',
      startsAt: new Date(now + 5 * day).toISOString(),
      durationMin: 60,
      seats: 80,
      enrolled: 41,
      price: 18000,
      currency: 'KZT',
      includes: ['Чек-лист лаборатории', 'Шаблоны ТЗ', 'Запись'],
      certificate: false,
      status: 'scheduled',
    },
    {
      id: 'wb-3',
      format: 'webinar' as const,
      title: 'Soft tissue around implants (International)',
      lecturer: 'Dr. Sara Kim',
      academy: 'Global Implant Forum',
      category: 'Имплантация',
      startsAt: new Date(now + 9 * day).toISOString(),
      durationMin: 75,
      seats: 200,
      enrolled: 153,
      price: 35000,
      currency: 'KZT',
      includes: ['EN + RU субтитры', 'Case pack', 'Запись 60 дней'],
      certificate: true,
      status: 'scheduled',
    },
    {
      id: 'wb-4',
      format: 'webinar' as const,
      title: 'Фотопротокол улыбки за 45 минут',
      lecturer: 'Dr. Ольга Смирнова',
      academy: 'Smile Media Lab',
      category: 'Фотография',
      startsAt: new Date(now + 12 * day).toISOString(),
      durationMin: 45,
      seats: 150,
      enrolled: 62,
      price: 12000,
      currency: 'KZT',
      includes: ['12 ракурсов', 'Пресеты', 'Запись'],
      certificate: false,
      status: 'scheduled',
    },
  ];
}

/** @deprecated use upcomingWebinars — kept for hub/live alias */
export function upcomingLiveSessions() {
  return upcomingWebinars();
}

/** Hands-on office courses — primary offline commerce format. */
export function upcomingOfficeCourses() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'off-1',
      format: 'office' as const,
      title: 'Hands-on: эндодонтия под микроскопом (2 дня)',
      lecturer: 'Dr. Айгерим Нурланова',
      academy: 'EndoLab Academy',
      category: 'Эндодонтия',
      city: 'Алматы',
      venue: 'Учебный центр EndoLab, пр. Достык 89',
      startsAt: new Date(now + 14 * day).toISOString(),
      endsAt: new Date(now + 15 * day).toISOString(),
      durationDays: 2,
      seats: 12,
      enrolled: 9,
      price: 280000,
      currency: 'KZT',
      includes: ['Материалы и расходники', 'Микроскоп 1:1', 'Сертификат', 'Обед'],
      certificate: true,
      level: 'advanced',
      status: 'open',
    },
    {
      id: 'off-2',
      format: 'office' as const,
      title: 'Офис-курс: имплантация в эстетической зоне',
      lecturer: 'Dr. Timur Bek',
      academy: 'Implant Pro',
      category: 'Имплантация',
      city: 'Астана',
      venue: 'Clinic Campus, ул. Сыганак 17',
      startsAt: new Date(now + 21 * day).toISOString(),
      endsAt: new Date(now + 22 * day).toISOString(),
      durationDays: 2,
      seats: 10,
      enrolled: 7,
      price: 450000,
      currency: 'KZT',
      includes: ['Модели и импланты для практики', 'Хирургический сет', 'Сертификат', 'Networking dinner'],
      certificate: true,
      level: 'advanced',
      status: 'open',
    },
    {
      id: 'off-3',
      format: 'office' as const,
      title: 'Очный воркшоп: циркониевые реставрации',
      lecturer: 'Dr. Алексей Петров',
      academy: 'Prostho Hub',
      category: 'Ортопедия',
      city: 'Алматы',
      venue: 'Digital Lab Studio, ул. Жандосова 54',
      startsAt: new Date(now + 28 * day).toISOString(),
      endsAt: new Date(now + 28 * day).toISOString(),
      durationDays: 1,
      seats: 16,
      enrolled: 11,
      price: 195000,
      currency: 'KZT',
      includes: ['Wax-up практика', 'Временные коронки', 'Сертификат'],
      certificate: true,
      level: 'intermediate',
      status: 'open',
    },
    {
      id: 'off-4',
      format: 'office' as const,
      title: 'Office course: soft tissue grafting around implants',
      lecturer: 'Dr. Sara Kim',
      academy: 'Global Implant Forum',
      category: 'Имплантация',
      city: 'Алматы',
      venue: 'Rixos Conference Hall B',
      startsAt: new Date(now + 40 * day).toISOString(),
      endsAt: new Date(now + 41 * day).toISOString(),
      durationDays: 2,
      seats: 20,
      enrolled: 14,
      price: 520000,
      currency: 'KZT',
      includes: ['Pig-head hands-on', 'EN/RU', 'International certificate', 'Coffee breaks'],
      certificate: true,
      level: 'expert',
      status: 'open',
    },
  ];
}

export const DEFAULT_EXAM = {
  title: 'Итоговый экзамен модуля',
  passScore: 70,
  questions: [
    {
      id: 'q1',
      text: 'Какой материал предпочтителен для закрытия перфорации?',
      options: ['Амальгама', 'MTA / bioceramic', 'Композит flow', 'Гуттаперча без силера'],
      correctIndex: 1,
    },
    {
      id: 'q2',
      text: 'Минимальный фотопротокол улыбки включает:',
      options: ['1 ракурс', '3–5 ракурсов', '12 ключевых ракурсов', 'Только ОПТГ'],
      correctIndex: 2,
    },
    {
      id: 'q3',
      text: 'Перед имплантацией в эстетической зоне критично оценить:',
      options: ['Только цвет зубов', 'Мягкие ткани и биотип', 'Только бренд импланта', 'Только цену'],
      correctIndex: 1,
    },
    {
      id: 'q4',
      text: 'Сертификат Academy OS выдаётся после:',
      options: ['Просмотра 1 видео', 'Оплаты курса', 'Успешной сдачи экзамена', 'Регистрации'],
      correctIndex: 2,
    },
  ],
};

export function reviewHomework(input: {
  title?: string;
  notes?: string;
  category?: string;
  imageCount?: number;
}): { score: number; verdict: string; feedback: string[]; suggestions: string[] } {
  const notes = String(input.notes || '').toLowerCase();
  const feedback: string[] = [];
  const suggestions: string[] = [];
  let score = 55;

  if ((input.imageCount || 0) >= 3) {
    score += 15;
    feedback.push('Хороший фотопротокол: достаточно ракурсов для разбора.');
  } else {
    suggestions.push('Добавьте минимум 3 фото (окклюзия, вестибулярно, крупный план).');
  }

  if (notes.length > 80) {
    score += 10;
    feedback.push('Клиническое описание достаточно подробное.');
  } else {
    suggestions.push('Опишите жалобы, диагноз и этапы лечения подробнее.');
  }

  if (notes.includes('диагноз') || notes.includes('мкб') || notes.includes('k0')) {
    score += 8;
    feedback.push('Диагноз указан — это важно для сертификации.');
  } else {
    suggestions.push('Добавьте диагноз (МКБ-10) и показания.');
  }

  if (notes.includes('протокол') || notes.includes('материал')) {
    score += 7;
    feedback.push('Упомянуты материалы/протокол — плюс к практическому разбору.');
  } else {
    suggestions.push('Укажите использованные материалы и ключевые шаги протокола.');
  }

  score = Math.min(98, Math.max(40, score));
  const verdict = score >= 80 ? 'Отличная работа' : score >= 65 ? 'Принято с замечаниями' : 'Требует доработки';

  return {
    score,
    verdict,
    feedback: feedback.length ? feedback : ['Работа получена. Добавьте детали для более точной оценки.'],
    suggestions,
  };
}
