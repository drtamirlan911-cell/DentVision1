// ═══════════════════════════════════════════════════════════════
// SKILLS ROUTER — Routes user intent to specialized AI skills
// Each skill handles a domain of user requests
// ═══════════════════════════════════════════════════════════════

export const SKILLS = {
  clinical: {
    name: 'Clinical AI',
    description: 'Клиническая практика — пациенты, диагностика, планы лечения',
    patterns: [
      /пациент/i, /карт[ауы]/i, /лечени/i, /диагноз/i, /приём|прием/i,
      /осмотр/i, /рентген|снимок|кт|панорам/i, /пломб/i, /коронк/i,
      /имплант/i, /канал/i, /хирург/i, /лечение зуб/i, /боль/i,
      /зуб[а-я]*/i, /заболеван/i, /патолог/i, /процедур/i,
    ],
    actions: ['OpenPatient', 'OpenMedicalCard', 'OpenPatients', 'SearchPatients', 'CreatePatient'],
  },

  practice: {
    name: 'Practice AI',
    description: 'Управление практикой — расписание, записи, документы',
    patterns: [
      /расписан/i, /запис/i, /сегодня/i, /завтра/i, /календар/i,
      /график/i, /свободн/i, /занят/i, /окно/i, /приём/i, /смен/i,
      /подтверд/i, /отмен/i, /перенос/i, /визит/i,
    ],
    actions: ['OpenSchedule', 'GetTodaySchedule', 'CreateAppointment', 'UpdateAppointmentStatus', 'GetPendingAppointments', 'OpenVisits'],
  },

  analytics: {
    name: 'Analytics AI',
    description: 'Аналитика и отчёты — финансы, метрики, KPI',
    patterns: [
      /аналитик/i, /отчёт|отчет/i, /метрик/i, /статистик/i, /показател/i,
      /выручк/i, /прибыл/i, /средн/i, /деньг/i, /финанс/i, /kpi/i,
      /загрузк/i, /конверси/i, /рост/i, /тренд/i,
    ],
    actions: ['GetClinicStats', 'GenerateDailyReport', 'OpenAnalytics'],
  },

  shopping: {
    name: 'Shopping AI',
    description: 'Магазин — оборудование, материалы, товары',
    patterns: [
      /магазин/i, /купить/i, /заказ/i, /товар/i, /цена/i, /стоимость/i,
      /сканер/i, /компрессор/i, /автоклав/i, /кресл/i, /лазер/i,
      /композит/i, /материал/i, /расходник/i, /инструмент/i, /оборудован/i,
      /доставк/i, /поставщик/i, /каталог/i, /простав/i,
    ],
    actions: ['OpenShop', 'SearchShop', 'RecommendEquipment'],
  },

  learning: {
    name: 'Learning AI',
    description: 'Обучение — курсы, сертификаты, развитие',
    patterns: [
      /курс/i, /обучени/i, /академ/i, /школ/i, /учить/i, /изучить/i,
      /сертификат/i, /диплом/i, /вебинар/i, /лекци/i, /семинар/i,
      /программ/i, /специализац/i, /развити/i, /навык/i,
    ],
    actions: ['OpenSchool', 'SearchCourses', 'RecommendCourses', 'OpenProfile'],
  },

  research: {
    name: 'Research AI',
    description: 'Исследования и рекомендации — протоколы, сравнения',
    patterns: [
      /сравни/i, /протокол/i, /исследован/i, /доказатель/i, /lit/i,
      /научн/i, /рекомендац/i, /обзор/i, /meta/i, /эффективн/i,
      /лучше/i, /лучший/i, /совет/i, /помоги выбрать/i,
    ],
    actions: ['RecommendEquipment', 'RecommendCourses'],
  },

  automation: {
    name: 'Automation AI',
    description: 'Автоматизация — уведомления, напоминания, настройки',
    patterns: [
      /настройк/i, /уведомлен/i, /напомин/i, /автомат/i, /шаблон/i,
      /рассылк/i, /повторя/i, /расписани/i, /процесс/i,
    ],
    actions: ['OpenSettings', 'OpenStaff'],
  },

  patient: {
    name: 'Patient AI',
    description: 'Работа с пациентами — поиск, история, напоминания',
    patterns: [
      /найти пацие/i, /пациент/i, /телефон/i, /номер/i, /контакт/i,
      /истори/i, /визит/i, /напомнить пацие/i, /звон/i,
    ],
    actions: ['SearchPatients', 'OpenPatient', 'OpenPatients', 'CreatePatient'],
  },
};

export function detectSkill(message) {
  const msg = message.toLowerCase();
  const scores = {};

  for (const [skillId, skill] of Object.entries(SKILLS)) {
    let score = 0;
    for (const pattern of skill.patterns) {
      if (pattern.test(msg)) score++;
    }
    if (score > 0) scores[skillId] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : 'practice';
}

export function getSkill(skillId) {
  return SKILLS[skillId] || SKILLS.practice;
}

export default { SKILLS, detectSkill, getSkill };
