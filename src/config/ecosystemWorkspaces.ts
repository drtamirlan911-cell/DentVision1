import type { EcosystemParticipant, EcosystemServiceId } from './ecosystem';

export type WorkspaceActionId =
  | 'open-ai' | 'today' | 'patients' | 'cases' | 'diagnostics' | 'medical-lab' | 'dental-lab' | 'materials' | 'finance' | 'team' | 'academy' | 'jobs' | 'network' | 'orders' | 'catalog' | 'branches' | 'analytics';

export type WorkspaceMetricId = 'active-cases' | 'pending-results' | 'open-orders' | 'today-appointments' | 'unread-dialogs' | 'finance' | 'turnaround' | 'students' | 'jobs' | 'inventory' | 'network';

export interface WorkspaceAction { id: WorkspaceActionId; label: string; description: string; path: string; service: EcosystemServiceId; }
export interface WorkspaceMetric { id: WorkspaceMetricId; label: string; description: string; service: EcosystemServiceId; }
export interface EcosystemWorkspaceDefinition { participant: EcosystemParticipant; title: string; description: string; services: EcosystemServiceId[]; actions: WorkspaceAction[]; metrics: WorkspaceMetric[]; aiContext: string; }

const action = (id: WorkspaceActionId, label: string, description: string, path: string, service: EcosystemServiceId): WorkspaceAction => ({ id, label, description, path, service });
const metric = (id: WorkspaceMetricId, label: string, description: string, service: EcosystemServiceId): WorkspaceMetric => ({ id, label, description, service });

export const ECOSYSTEM_WORKSPACES: Record<EcosystemParticipant, EcosystemWorkspaceDefinition> = {
  patient: {
    participant: 'patient', title: 'Мой стоматологический путь', description: 'Записи, лечение, результаты, документы и связь со специалистами в одном контексте.',
    services: ['ai', 'practice', 'diagnostics', 'network'],
    actions: [action('open-ai', 'Спросить DentVision AI', 'Разобраться в следующем шаге лечения', '/ai', 'ai'), action('today', 'Мои записи', 'Посмотреть ближайшие визиты', '/appointments', 'practice'), action('diagnostics', 'Результаты диагностики', 'Открыть доступные результаты', '/diagnostics', 'diagnostics'), action('network', 'Найти специалиста', 'Поиск врача или клиники', '/community', 'network')],
    metrics: [metric('active-cases', 'Лечение', 'Активные клинические случаи', 'practice'), metric('pending-results', 'Результаты', 'Ожидаемые диагностические результаты', 'diagnostics'), metric('unread-dialogs', 'Диалоги', 'Непрочитанные сообщения', 'network')],
    aiContext: 'Пациентский контекст: лечение, записи, диагностика, документы и коммуникация.',
  },
  professional: {
    participant: 'professional', title: 'Рабочее пространство специалиста', description: 'Клинические случаи связаны с диагностикой, лабораториями, материалами и обучением.',
    services: ['ai', 'practice', 'diagnostics', 'medical-laboratory', 'dental-laboratory', 'market', 'academy', 'network'],
    actions: [action('open-ai', 'DentVision AI', 'Разобрать случай и следующий шаг', '/ai', 'ai'), action('cases', 'Клинические случаи', 'Работа с лечением и планами', '/crm/cases', 'practice'), action('diagnostics', 'Заказать диагностику', 'Найти центр и создать направление', '/diagnostics', 'diagnostics'), action('dental-lab', 'Зуботехническая лаборатория', 'Передать или открыть лабораторный заказ', '/crm/lab', 'dental-laboratory'), action('materials', 'Материалы и оборудование', 'Найти нужный материал или поставщика', '/shop', 'market'), action('academy', 'Academy', 'Продолжить профессиональное обучение', '/school', 'academy')],
    metrics: [metric('active-cases', 'Активные случаи', 'Клинические случаи в работе', 'practice'), metric('pending-results', 'Результаты', 'Диагностика и анализы, требующие внимания', 'diagnostics'), metric('open-orders', 'Лаборатория', 'Лабораторные заказы в работе', 'dental-laboratory'), metric('today-appointments', 'Сегодня', 'Запланированные визиты', 'practice')],
    aiContext: 'Профессиональный контекст: пациент, клинический случай, диагностика, лаборатория, материалы и обучение.',
  },
  clinic: {
    participant: 'clinic', title: 'Рабочее пространство клиники', description: 'Операции клиники, команда, пациенты, партнёры и экономика связаны в одном контексте.',
    services: ['ai', 'practice', 'diagnostics', 'medical-laboratory', 'dental-laboratory', 'market', 'finance', 'analytics', 'administration'],
    actions: [action('open-ai', 'AI Command Center', 'Управлять задачами через единый интеллект', '/ai', 'ai'), action('today', 'Сегодня', 'Расписание, пациенты и задачи дня', '/dashboard', 'practice'), action('team', 'Команда', 'Врачи, ассистенты и роли', '/crm/team', 'administration'), action('diagnostics', 'Партнёры диагностики', 'Направления и результаты', '/diagnostics', 'diagnostics'), action('finance', 'Финансы', 'Доходы, расходы и взаиморасчёты', '/analytics', 'finance'), action('branches', 'Филиалы', 'Рабочие пространства организации', '/settings/branches', 'administration')],
    metrics: [metric('today-appointments', 'Сегодня', 'Записи на текущий день', 'practice'), metric('active-cases', 'Лечение', 'Активные клинические случаи', 'practice'), metric('pending-results', 'Диагностика', 'Ожидаемые результаты', 'diagnostics'), metric('finance', 'Финансы', 'Данные финансового контура', 'finance')],
    aiContext: 'Контекст клиники: операции, команда, пациенты, филиалы, партнёры и экономика.',
  },
  diagnostic_center: {
    participant: 'diagnostic_center', title: 'Рабочее пространство диагностического центра', description: 'Входящие направления, исследования, результаты, SLA и расчёты с клиниками.',
    services: ['ai', 'diagnostics', 'finance', 'analytics', 'network'],
    actions: [action('open-ai', 'AI Operations', 'Приоритизировать входящие задачи', '/ai', 'ai'), action('orders', 'Направления', 'Обработать входящие исследования', '/diagnostics', 'diagnostics'), action('diagnostics', 'Результаты', 'Управлять готовыми результатами', '/diagnostics', 'diagnostics'), action('finance', 'Расчёты', 'Контроль начислений и выплат', '/analytics', 'finance'), action('network', 'Клиники-партнёры', 'Работа с направляющими организациями', '/community', 'network')],
    metrics: [metric('open-orders', 'Направления', 'Исследования в работе', 'diagnostics'), metric('pending-results', 'Результаты', 'Результаты, ожидающие выдачи', 'diagnostics'), metric('turnaround', 'Turnaround', 'Операционный показатель времени выполнения', 'analytics'), metric('finance', 'Расчёты', 'Финансовый контур партнёрских операций', 'finance')],
    aiContext: 'Контекст диагностического центра: направления, исследования, результаты, клиники-партнёры и расчёты.',
  },
  medical_laboratory: {
    participant: 'medical_laboratory', title: 'Рабочее пространство медицинской лаборатории', description: 'Анализы, образцы, результаты, сроки и взаиморасчёты с направляющими организациями.',
    services: ['ai', 'medical-laboratory', 'diagnostics', 'finance', 'analytics'],
    actions: [action('open-ai', 'AI Operations', 'Разобрать поток лабораторных задач', '/ai', 'ai'), action('orders', 'Заказы', 'Обработать лабораторные заказы', '/diagnostics/lab', 'medical-laboratory'), action('diagnostics', 'Результаты', 'Подготовить и выдать результаты', '/diagnostics/lab', 'medical-laboratory'), action('finance', 'Расчёты', 'Контроль начислений и выплат', '/analytics', 'finance')],
    metrics: [metric('open-orders', 'Заказы', 'Лабораторные заказы в работе', 'medical-laboratory'), metric('pending-results', 'Результаты', 'Результаты, требующие обработки', 'medical-laboratory'), metric('turnaround', 'Turnaround', 'Операционное время выполнения', 'analytics'), metric('finance', 'Финансы', 'Финансовый контур лаборатории', 'finance')],
    aiContext: 'Контекст медицинской лаборатории: заказы, образцы, результаты, сроки и партнёрские расчёты.',
  },
  dental_laboratory: {
    participant: 'dental_laboratory', title: 'Рабочее пространство зуботехнической лаборатории', description: 'Кейсы, производственная очередь, сроки, доставка, материалы и расчёты.',
    services: ['ai', 'dental-laboratory', 'market', 'finance', 'analytics', 'network'],
    actions: [action('open-ai', 'AI Production', 'Приоритизировать производственную очередь', '/ai', 'ai'), action('orders', 'Производство', 'Открытые лабораторные кейсы', '/crm/lab', 'dental-laboratory'), action('materials', 'Материалы', 'Поиск материалов и поставщиков', '/shop', 'market'), action('finance', 'Расчёты', 'Контроль взаиморасчётов', '/analytics', 'finance'), action('network', 'Клиники', 'Работа с направляющими врачами', '/community', 'network')],
    metrics: [metric('open-orders', 'В работе', 'Открытые производственные кейсы', 'dental-laboratory'), metric('turnaround', 'Сроки', 'Производственные сроки', 'analytics'), metric('inventory', 'Материалы', 'Состояние складского контура', 'market'), metric('finance', 'Расчёты', 'Финансовые операции лаборатории', 'finance')],
    aiContext: 'Контекст зуботехнической лаборатории: кейсы, производство, сроки, материалы, клиники и расчёты.',
  },
  supplier: {
    participant: 'supplier', title: 'Рабочее пространство поставщика', description: 'Каталог, запросы клиентов, заказы, остатки, партнёры и экономика продаж.',
    services: ['ai', 'market', 'finance', 'analytics', 'network'],
    actions: [action('open-ai', 'AI Sales', 'Разобрать запросы и возможности продаж', '/ai', 'ai'), action('catalog', 'Каталог', 'Управлять товарами и предложениями', '/shop', 'market'), action('orders', 'Заказы', 'Обработать заказы покупателей', '/shop', 'market'), action('materials', 'Запросы врачей', 'Найти релевантные материалы и товары', '/shop', 'market'), action('finance', 'Финансы', 'Контроль продаж и расчётов', '/analytics', 'finance')],
    metrics: [metric('open-orders', 'Заказы', 'Заказы в обработке', 'market'), metric('inventory', 'Каталог', 'Состояние товарного контура', 'market'), metric('network', 'Партнёры', 'Партнёрская сеть', 'network'), metric('finance', 'Финансы', 'Финансовые показатели', 'finance')],
    aiContext: 'Контекст поставщика: каталог, запросы врачей, заказы, остатки, партнёры и экономика.',
  },
  academy: {
    participant: 'academy', title: 'Рабочее пространство Academy', description: 'Обучение, преподаватели, студенты, контент, практика и профессиональное сообщество.',
    services: ['ai', 'academy', 'network', 'jobs', 'analytics', 'finance'],
    actions: [action('open-ai', 'AI Tutor', 'Навигация по обучению и знаниям', '/ai', 'ai'), action('academy', 'Academy', 'Управлять курсами и обучением', '/school', 'academy'), action('network', 'Сообщество', 'Работа со студентами и коллегами', '/community', 'network'), action('jobs', 'Карьера', 'Связать обучение с работой', '/jobs', 'jobs'), action('finance', 'Финансы', 'Контроль образовательного контура', '/analytics', 'finance')],
    metrics: [metric('students', 'Студенты', 'Активные обучающиеся', 'academy'), metric('jobs', 'Карьера', 'Профессиональные возможности', 'jobs'), metric('network', 'Сообщество', 'Активность профессиональной сети', 'network'), metric('finance', 'Финансы', 'Финансовый контур Academy', 'finance')],
    aiContext: 'Контекст Academy: курсы, студенты, преподаватели, практика, карьера и сообщество.',
  },
  lecturer: {
    participant: 'lecturer', title: 'Рабочее пространство преподавателя', description: 'Курсы, материалы, студенты, публикации и профессиональная сеть.',
    services: ['ai', 'academy', 'network', 'jobs'],
    actions: [action('open-ai', 'AI Tutor', 'Подготовить учебный материал или план', '/ai', 'ai'), action('academy', 'Мои курсы', 'Управлять образовательным контентом', '/school', 'academy'), action('network', 'Сообщество', 'Работа с профессиональной сетью', '/community', 'network'), action('jobs', 'Возможности', 'Профессиональные проекты и вакансии', '/jobs', 'jobs')],
    metrics: [metric('students', 'Студенты', 'Активные обучающиеся', 'academy'), metric('network', 'Сеть', 'Профессиональные связи', 'network'), metric('jobs', 'Возможности', 'Карьерные возможности', 'jobs')],
    aiContext: 'Контекст преподавателя: курсы, студенты, знания, профессиональная сеть и карьерные проекты.',
  },
  student: {
    participant: 'student', title: 'Рабочее пространство студента', description: 'Обучение, практика, наставники, сообщество и карьерный путь.',
    services: ['ai', 'academy', 'network', 'jobs', 'market'],
    actions: [action('open-ai', 'AI Tutor', 'Объяснить тему и построить следующий шаг', '/ai', 'ai'), action('academy', 'Продолжить обучение', 'Вернуться к курсам и материалам', '/school', 'academy'), action('network', 'Найти наставника', 'Связаться с профессионалами', '/community', 'network'), action('jobs', 'Найти работу', 'Посмотреть профессиональные возможности', '/jobs', 'jobs'), action('materials', 'Market', 'Найти материалы и оборудование', '/shop', 'market')],
    metrics: [metric('students', 'Обучение', 'Текущий образовательный прогресс', 'academy'), metric('jobs', 'Работа', 'Доступные карьерные возможности', 'jobs'), metric('network', 'Сеть', 'Профессиональное окружение', 'network')],
    aiContext: 'Контекст студента: обучение, практика, наставничество, материалы и карьера.',
  },
  employer: {
    participant: 'employer', title: 'Рабочее пространство работодателя', description: 'Вакансии, специалисты, найм, профессиональная сеть и развитие команды.',
    services: ['ai', 'jobs', 'network', 'academy', 'analytics'],
    actions: [action('open-ai', 'AI Recruiter', 'Сформировать следующий шаг по найму', '/ai', 'ai'), action('jobs', 'Вакансии', 'Управлять вакансиями и откликами', '/jobs', 'jobs'), action('network', 'Поиск специалистов', 'Найти профессионалов в сети', '/community', 'network'), action('academy', 'Обучение команды', 'Найти образовательные программы', '/school', 'academy')],
    metrics: [metric('jobs', 'Вакансии', 'Активные карьерные позиции', 'jobs'), metric('network', 'Кандидаты', 'Профессиональная сеть', 'network'), metric('students', 'Обучение', 'Образовательные возможности команды', 'academy')],
    aiContext: 'Контекст работодателя: вакансии, кандидаты, команда, обучение и профессиональная сеть.',
  },
  job_seeker: {
    participant: 'job_seeker', title: 'Рабочее пространство специалиста', description: 'Профиль, вакансии, профессиональная сеть, обучение и карьерные действия.',
    services: ['ai', 'jobs', 'network', 'academy'],
    actions: [action('open-ai', 'AI Career', 'Разобрать карьерную цель и следующий шаг', '/ai', 'ai'), action('jobs', 'Вакансии', 'Найти подходящие возможности', '/jobs', 'jobs'), action('network', 'Network', 'Развивать профессиональные связи', '/community', 'network'), action('academy', 'Обучение', 'Закрыть пробелы в навыках', '/school', 'academy')],
    metrics: [metric('jobs', 'Возможности', 'Доступные карьерные возможности', 'jobs'), metric('network', 'Сеть', 'Профессиональные связи', 'network'), metric('students', 'Навыки', 'Обучение и развитие', 'academy')],
    aiContext: 'Контекст соискателя: профиль, вакансии, навыки, обучение и профессиональная сеть.',
  },
  community: {
    participant: 'community', title: 'DentVision Network', description: 'Профессиональная сеть для обмена знаниями, поиска специалистов и совместной работы.',
    services: ['ai', 'network', 'academy', 'jobs', 'market'],
    actions: [action('open-ai', 'AI Navigator', 'Найти нужного человека или ресурс', '/ai', 'ai'), action('network', 'Network', 'Открыть профессиональную сеть', '/community', 'network'), action('academy', 'Knowledge', 'Найти обучение и экспертов', '/school', 'academy'), action('jobs', 'Jobs', 'Найти карьерные возможности', '/jobs', 'jobs')],
    metrics: [metric('network', 'Сеть', 'Профессиональные связи', 'network'), metric('jobs', 'Jobs', 'Карьерный контур', 'jobs'), metric('students', 'Knowledge', 'Образовательный контур', 'academy')],
    aiContext: 'Контекст Network: люди, знания, вакансии, обучение, материалы и профессиональные связи.',
  },
  platform: {
    participant: 'platform', title: 'DentVision Platform', description: 'Сквозной контроль экосистемы, партнёров, экономики, AI и безопасности.',
    services: ['ai', 'practice', 'diagnostics', 'medical-laboratory', 'dental-laboratory', 'market', 'academy', 'jobs', 'network', 'finance', 'analytics', 'administration'],
    actions: [action('open-ai', 'AI Command Center', 'Управлять платформенными задачами', '/ai', 'ai'), action('analytics', 'Analytics', 'Платформенная аналитика', '/analytics', 'analytics'), action('finance', 'Finance', 'Экономика и расчёты', '/analytics', 'finance'), action('network', 'Network', 'Экосистема участников', '/community', 'network'), action('branches', 'Administration', 'Управление платформой', '/admin', 'administration')],
    metrics: [metric('network', 'Network', 'Активность экосистемы', 'network'), metric('finance', 'Finance', 'Экономический контур', 'finance'), metric('open-orders', 'Operations', 'Операционные очереди', 'analytics'), metric('active-cases', 'Clinical', 'Клинический контур', 'practice')],
    aiContext: 'Платформенный контекст: экосистема, операции, экономика, AI, безопасность и развитие.',
  },
};

export function workspaceForParticipant(participant: EcosystemParticipant): EcosystemWorkspaceDefinition {
  return ECOSYSTEM_WORKSPACES[participant] ?? ECOSYSTEM_WORKSPACES.platform;
}
