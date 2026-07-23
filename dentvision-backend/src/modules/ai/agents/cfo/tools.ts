import type { AgentTool } from '../interfaces.js';

export const CFO_TOOLS: AgentTool[] = [
  {
    name: 'getDailyBriefing',
    description: 'Ежедневный финансовый брифинг: MRR, churn, LTV, CAC, рекомендации',
    parameters: {},
    destructive: false,
  },
  {
    name: 'getMRR',
    description: 'Текущий MRR и ARR с ростом',
    parameters: {},
    destructive: false,
  },
  {
    name: 'getChurnAnalysis',
    description: 'Анализ оттока клиентов за период',
    parameters: {
      months: { type: 'number', description: 'Количество месяцев для анализа (1-12)', required: false },
    },
    destructive: false,
  },
  {
    name: 'getCACAnalysis',
    description: 'Анализ стоимости привлечения клиента',
    parameters: {},
    destructive: false,
  },
  {
    name: 'getLTVAnalysis',
    description: 'Анализ пожизненной ценности клиента',
    parameters: {},
    destructive: false,
  },
  {
    name: 'getUnitEconomics',
    description: 'Юнит-экономика: выручка на клиника/доктора/пациента, маржа',
    parameters: {},
    destructive: false,
  },
  {
    name: 'getCashFlow',
    description: 'Прогноз денежных потоков на 12 месяцев',
    parameters: {},
    destructive: false,
  },
  {
    name: 'getScenarioForecast',
    description: 'Трёхсценарный прогноз: оптимистичный/базовый/пессимистичный',
    parameters: {},
    destructive: false,
  },
  {
    name: 'getPartnerROI',
    description: 'ROI по партнёрам: продажи, конверсия, повторные покупки',
    parameters: {},
    destructive: false,
  },
  {
    name: 'askCFO',
    description: 'Задать вопрос AI CFO по финансам',
    parameters: {
      question: { type: 'string', description: 'Вопрос по финансам', required: true },
    },
    destructive: false,
  },
];
