import { AbstractAgent, type AgentTool, type EventActionDefinition } from '../interfaces.js';
import type { AgentMetadata } from '../interfaces.js';
import type { AIContext, AIResponse } from '../../types/ai.types.js';
import type { CRMEvent } from '../../../events/EventTypes.js';
import type { EventActionResult } from '../interfaces.js';
import {
  getMRR,
  getChurn,
  getLTV,
  getCAC,
  getUnitEconomics,
  getCashFlow,
  getScenarios,
  getBIDashboard,
} from '../../../bi/bi.service.js';
import { CFO_TOOLS } from './tools.js';
import { simpleChat } from '../../llm/client.js';

export class CFOAgent extends AbstractAgent {
  readonly metadata: AgentMetadata = {
    id: 'cfo',
    name: 'AI CFO',
    domain: 'finance',
    description: 'ИИ-финансовый директор: ежедневный брифинг, MRR/Churn/LTV/CAC, прогнозы, рекомендации',
    version: '1.0.0',
    status: 'active',
    allowedRoles: ['*'],
    maxConcurrency: 2,
  };

  constructor() {
    super();
    for (const tool of CFO_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  canHandle(intent: string): boolean {
    const intents = [
      'CFO_DAILY_BRIEFING',
      'CFO_MRR_ANALYSIS',
      'CFO_CHURN_ALERT',
      'CFO_CAC_ALERT',
      'CFO_roi_WARNING',
      'CFO_FINANCIAL_ADVICE',
      'CFO_SCENARIO_FORECAST',
    ];
    return intents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'CFO_DAILY_BRIEFING':
        return this.dailyBriefing(context);
      case 'CFO_MRR_ANALYSIS':
        return this.mrrAnalysis(context);
      case 'CFO_CHURN_ALERT':
        return this.churnAlert(context);
      case 'CFO_CAC_ALERT':
        return this.cacAlert(context);
      case 'CFO_roi_WARNING':
        return this.roiWarning(context);
      case 'CFO_FINANCIAL_ADVICE':
        return this.financialAdvice(context, params);
      case 'CFO_SCENARIO_FORECAST':
        return this.scenarioForecast(context);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  getEventActions(): EventActionDefinition[] {
    return [];
  }

  // ─── Intent Handlers ───

  private async dailyBriefing(context: AIContext): Promise<AIResponse> {
    try {
      const dashboard = await getBIDashboard();

      const briefing = [
        `📊 **Ежедневный брифинг AI CFO**`,
        ``,
        `**MRR:** ${dashboard.mrr.mrr.toLocaleString('ru-RU')} ₸ (ARR: ${dashboard.mrr.arr.toLocaleString('ru-RU')} ₸)`,
        `**Рост MRR:** ${dashboard.mrr.mrrGrowthPct > 0 ? '+' : ''}${dashboard.mrr.mrrGrowthPct.toFixed(1)}%`,
        `**Активные клиники:** ${dashboard.mrr.activeClinics} из ${dashboard.mrr.payingUsers + dashboard.mrr.freeUsers}`,
        ``,
        `**Churn Rate:** ${dashboard.churn.churnRate.toFixed(1)}% (-net: ${dashboard.churn.netGrowth > 0 ? '+' : ''}${dashboard.churn.netGrowth})`,
        `**LTV:** ${dashboard.ltv.ltv.toLocaleString('ru-RU')} ₸ | **CAC:** ${dashboard.cac?.cac.toLocaleString('ru-RU') || '—'} ₸`,
        `**LTV/CAC:** ${dashboard.ltv.ltvCacRatio.toFixed(1)}x`,
        ``,
        `**Unit Economics (30д):**`,
        `  Выручка/клиника: ${dashboard.unitEconomics.revenuePerClinic.toLocaleString('ru-RU')} ₸`,
        `  Выручка/доктор: ${dashboard.unitEconomics.revenuePerDoctor.toLocaleString('ru-RU')} ₸`,
        `  Чистая маржа: ${dashboard.unitEconomics.netMargin}%`,
      ];

      // AI recommendations based on data
      const recommendations: string[] = [];
      if (dashboard.mrr.mrrGrowthPct < 0) {
        recommendations.push('⚠️ MRR снижается — рассмотрите маркетинговые кампании');
      }
      if (dashboard.churn.churnRate > 5) {
        recommendations.push('🔴 Churn > 5% — нужно удержание клиентов');
      }
      if (dashboard.ltv.ltvCacRatio < 3) {
        recommendations.push('🟡 LTV/CAC < 3x — оптимизируйте стоимость привлечения');
      }
      if (dashboard.unitEconomics.netMargin < 20) {
        recommendations.push('🟠 Чистая маржа < 20% — сократите операционные расходы');
      }
      if (recommendations.length === 0) {
        recommendations.push('✅ Все показатели в норме');
      }

      return {
        message: briefing.join('\n') + '\n\n' + recommendations.join('\n'),
        intent: 'CFO_DAILY_BRIEFING',
        action: { type: 'BRIEFING_GENERATED', payload: dashboard },
        suggestions: ['CFO_MRR_ANALYSIS', 'CFO_SCENARIO_FORECAST', 'CFO_FINANCIAL_ADVICE'],
      };
    } catch (error) {
      return {
        message: 'Ошибка генерации брифинга. Попробуйте позже.',
        intent: 'CFO_DAILY_BRIEFING',
        suggestions: [],
      };
    }
  }

  private async mrrAnalysis(context: AIContext): Promise<AIResponse> {
    const [mrr, cashFlow] = await Promise.all([getMRR(), getCashFlow()]);

    return {
      message: [
        `📈 **Анализ MRR**`,
        `Текущий MRR: ${mrr.mrr.toLocaleString('ru-RU')} ₸`,
        `Рост: ${mrr.mrrGrowthPct > 0 ? '+' : ''}${mrr.mrrGrowthPct.toFixed(1)}%`,
        `Прогноз 12мес: ${cashFlow.totalRevenue.toLocaleString('ru-RU')} ₸`,
        `Точка безубыточности: ${cashFlow.breakEvenMonth || 'не достигнута'}`,
      ].join('\n'),
      intent: 'CFO_MRR_ANALYSIS',
      action: { type: 'MRR_ANALYZED', payload: { mrr, cashFlow } },
      suggestions: ['CFO_DAILY_BRIEFING', 'CFO_SCENARIO_FORECAST'],
    };
  }

  private async churnAlert(context: AIContext): Promise<AIResponse> {
    const churn = await getChurn(1);

    const severity = churn.churnRate > 10 ? '🔴 КРИТИЧНО' : churn.churnRate > 5 ? '🟡 ВНИМАНИЕ' : '🟢 НОРМА';

    return {
      message: [
        `${severity} **Churn Analysis**`,
        `Churn Rate: ${churn.churnRate.toFixed(1)}% за месяц`,
        `Потеряно клиник: ${churn.churnedClinics} из ${churn.totalClinics}`,
        `Новых клиник: ${churn.newClinics}`,
        `Чистый рост: ${churn.netGrowth > 0 ? '+' : ''}${churn.netGrowth}`,
      ].join('\n'),
      intent: 'CFO_CHURN_ALERT',
      action: { type: 'CHURN_ANALYZED', payload: churn },
      suggestions: ['CFO_FINANCIAL_ADVICE', 'CFO_DAILY_BRIEFING'],
    };
  }

  private async cacAlert(context: AIContext): Promise<AIResponse> {
    const cac = await getCAC();

    const severity = cac.paybackPeriodMonths > 12 ? '🔴' : cac.paybackPeriodMonths > 6 ? '🟡' : '🟢';

    return {
      message: [
        `${severity} **CAC Analysis**`,
        `CAC: ${cac.cac.toLocaleString('ru-RU')} ₸`,
        `Период окупаемости: ${cac.paybackPeriodMonths} мес`,
        `Расходы на привлечение: ${cac.totalAcquisitionSpend.toLocaleString('ru-RU')} ₸`,
        `Новых клиентов: ${cac.newCustomers}`,
      ].join('\n'),
      intent: 'CFO_CAC_ALERT',
      action: { type: 'CAC_ANALYZED', payload: cac },
      suggestions: ['CFO_FINANCIAL_ADVICE', 'CFO_DAILY_BRIEFING'],
    };
  }

  private async roiWarning(context: AIContext): Promise<AIResponse> {
    const unit = await getUnitEconomics();

    return {
      message: [
        `💰 **Unit Economics**`,
        `Выручка/клиника: ${unit.revenuePerClinic.toLocaleString('ru-RU')} ₸`,
        `Выручка/доктор: ${unit.revenuePerDoctor.toLocaleString('ru-RU')} ₸`,
        `Выручка/пациент: ${unit.revenuePerPatient.toLocaleString('ru-RU')} ₸`,
        `Чистая маржа: ${unit.netMargin}%`,
        `Валовая маржа: ${unit.grossMargin}%`,
      ].join('\n'),
      intent: 'CFO_roi_WARNING',
      action: { type: 'UNIT_ECONOMICS_ANALYZED', payload: unit },
      suggestions: ['CFO_FINANCIAL_ADVICE', 'CFO_SCENARIO_FORECAST'],
    };
  }

  private async financialAdvice(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const question = String(params.question || 'Общая финансовая оценка');

    try {
      const dashboard = await getBIDashboard();

      const systemPrompt = `Ты — AI CFO стоматологической платформы DentVision. Данные:\nMRR: ${dashboard.mrr.mrr} ₸\nChurn: ${dashboard.churn.churnRate}%\nLTV: ${dashboard.ltv.ltv} ₸\nCAC: ${dashboard.cac?.cac || '—'} ₸\nЧистая маржа: ${dashboard.unitEconomics.netMargin}%\nОтвечай на русском, кратко, с конкретными рекомендациями.`;

      const response = await simpleChat(systemPrompt, question);

      return {
        message: response || 'Не удалось сгенерировать рекомендацию',
        intent: 'CFO_FINANCIAL_ADVICE',
        action: { type: 'ADVICE_GENERATED', payload: { question, dashboard } },
        suggestions: ['CFO_DAILY_BRIEFING', 'CFO_SCENARIO_FORECAST'],
      };
    } catch {
      return {
        message: 'Ошибка генерации рекомендации',
        intent: 'CFO_FINANCIAL_ADVICE',
        suggestions: [],
      };
    }
  }

  private async scenarioForecast(context: AIContext): Promise<AIResponse> {
    const scenarios = await getScenarios();

    return {
      message: [
        `🔮 **Прогноз 12 месяцев**`,
        ``,
        `**Оптимистичный:** безубыточность ${scenarios.breakEven.optimistic || 'до конца периода'}`,
        `**Базовый:** безубыточность ${scenarios.breakEven.base || 'до конца периода'}`,
        `**Пессимистичный:** безубыточность ${scenarios.breakEven.worst || 'не достигнута'}`,
        ``,
        `Итого за 12 мес:`,
        `  Оптимистичный: +${scenarios.optimistic[11]?.cumulative.toLocaleString('ru-RU')} ₸`,
        `  Базовый: ${scenarios.base[11]?.cumulative.toLocaleString('ru-RU')} ₸`,
        `  Пессимистичный: ${scenarios.worst[11]?.cumulative.toLocaleString('ru-RU')} ₸`,
      ].join('\n'),
      intent: 'CFO_SCENARIO_FORECAST',
      action: { type: 'SCENARIO_GENERATED', payload: scenarios },
      suggestions: ['CFO_DAILY_BRIEFING', 'CFO_MRR_ANALYSIS'],
    };
  }
}
