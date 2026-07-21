/** Curated Academy OS content (cases, library, live) — no schema migration required. */

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

export function upcomingLiveSessions() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'live-1',
      title: 'Прямой эфир: ревизия каналов под микроскопом',
      lecturer: 'Dr. Айгерим Нурланова',
      category: 'Эндодонтия',
      startsAt: new Date(now + 2 * day).toISOString(),
      durationMin: 90,
      seats: 120,
      enrolled: 86,
      status: 'scheduled',
    },
    {
      id: 'live-2',
      title: 'Q&A: цифровой Wax-Up и коммуникация с лабораторией',
      lecturer: 'Dr. Алексей Петров',
      category: 'Ортопедия',
      startsAt: new Date(now + 5 * day).toISOString(),
      durationMin: 60,
      seats: 80,
      enrolled: 41,
      status: 'scheduled',
    },
    {
      id: 'live-3',
      title: 'International Live: Soft tissue around implants',
      lecturer: 'Dr. Sara Kim',
      category: 'Имплантация',
      startsAt: new Date(now + 9 * day).toISOString(),
      durationMin: 75,
      seats: 200,
      enrolled: 153,
      status: 'scheduled',
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
