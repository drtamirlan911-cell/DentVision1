/**
 * Default exam banks for School lessons (type=test|exam).
 * Real courses can override via lesson.content JSON.
 */
export const DEFAULT_EXAM_BANK = {
  therapy: {
    title: 'Тест: терапия',
    passingScore: 70,
    questions: [
      {
        id: 'q1',
        text: 'Какой код МКБ чаще соответствует кариесу дентина?',
        options: ['K02.0', 'K02.1', 'K04.0', 'K05.2'],
        correctIndex: 1,
      },
      {
        id: 'q2',
        text: 'Основной принцип адгезивной реставрации:',
        options: ['Максимальное препарирование', 'Минимально инвазивный подход', 'Только амальгама', 'Без изоляции'],
        correctIndex: 1,
      },
      {
        id: 'q3',
        text: 'Для диагностики скрытого кариеса наиболее информативен:',
        options: ['Только визуальный осмотр', 'Bitewing / прицельный снимок', 'Только зондирование', 'Цвет слизистой'],
        correctIndex: 1,
      },
      {
        id: 'q4',
        text: 'После постановки композитной реставрации важно:',
        options: ['Игнорировать окклюзию', 'Проверить окклюзию и полировку', 'Назначить антибиотик всегда', 'Удалить зуб'],
        correctIndex: 1,
      },
    ],
  },
  endo: {
    title: 'Тест: эндодонтия',
    passingScore: 70,
    questions: [
      {
        id: 'q1',
        text: 'Главная цель эндодонтического лечения:',
        options: ['Отбеливание', 'Устранение инфекции корневых каналов', 'Установка брекетов', 'Синус-лифтинг'],
        correctIndex: 1,
      },
      {
        id: 'q2',
        text: 'Рабочая длина обычно определяется с помощью:',
        options: ['Только визуально', 'Апекслокатора / рентгена', 'Только цвета гуттаперчи', 'Шприца'],
        correctIndex: 1,
      },
      {
        id: 'q3',
        text: 'Ирригация каналов чаще всего включает:',
        options: ['Только воду', 'NaOCl (и доп. протоколы)', 'Только спирт', 'Перекись всегда без NaOCl'],
        correctIndex: 1,
      },
    ],
  },
  general: {
    title: 'Итоговый экзамен',
    passingScore: 75,
    questions: [
      {
        id: 'q1',
        text: 'DentVision — это прежде всего:',
        options: ['Только CRM', 'AI Operating System для стоматологии', 'Только маркетплейс', 'Только чат'],
        correctIndex: 1,
      },
      {
        id: 'q2',
        text: 'Перед необратимым клиническим действием AI должен:',
        options: ['Сделать молча', 'Запросить подтверждение', 'Удалить данные', 'Закрыть чат'],
        correctIndex: 1,
      },
      {
        id: 'q3',
        text: 'Обязательные разделы CRM включают:',
        options: ['Только прайс', 'Расписание, пациентов, финансы, склад, документы, зубную карту, планы', 'Только вакансии', 'Только Stories'],
        correctIndex: 1,
      },
      {
        id: 'q4',
        text: 'Marketplace в DentVision продают:',
        options: ['Только клиники пациентам', 'Поставщики', 'Только студенты', 'Только AI'],
        correctIndex: 1,
      },
    ],
  },
};

export function resolveExamPayload(lesson) {
  const raw = lesson?.content;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed?.questions?.length) {
        return {
          title: parsed.title || lesson.title || 'Экзамен',
          passingScore: Number(parsed.passingScore) || 70,
          questions: parsed.questions,
        };
      }
    } catch { /* fall through */ }
  }

  const title = `${lesson?.title || ''} ${lesson?.type || ''}`.toLowerCase();
  if (title.includes('эндо') || title.includes('endo')) return { ...DEFAULT_EXAM_BANK.endo };
  if (title.includes('терап') || title.includes('кариес') || title.includes('therapy')) return { ...DEFAULT_EXAM_BANK.therapy };
  if (lesson?.type === 'exam') return { ...DEFAULT_EXAM_BANK.general };
  return { ...DEFAULT_EXAM_BANK.therapy };
}

export function publicExamView(exam) {
  return {
    title: exam.title,
    passingScore: exam.passingScore,
    questionCount: exam.questions.length,
    questions: exam.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
      // correctIndex intentionally omitted
    })),
  };
}

export function gradeExam(exam, answers = {}) {
  const total = exam.questions.length || 1;
  let correct = 0;
  const details = exam.questions.map((q) => {
    const selected = answers[q.id];
    const ok = Number(selected) === Number(q.correctIndex);
    if (ok) correct += 1;
    return {
      id: q.id,
      selected: selected ?? null,
      correctIndex: q.correctIndex,
      correct: ok,
    };
  });
  const score = Math.round((correct / total) * 100);
  const passed = score >= (exam.passingScore || 70);
  return { score, passed, total, correct, details, passingScore: exam.passingScore || 70 };
}
