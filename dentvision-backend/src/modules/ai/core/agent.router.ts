import { AIContext, AIResponse } from '../types/ai.types.js';

export interface Agent {
  name: string;
  handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse>;
  canHandle(intent: string): boolean;
}

export class AgentRouter {
  private agents: Map<string, Agent[]> = new Map();

  register(intent: string, agent: Agent): void {
    if (!this.agents.has(intent)) {
      this.agents.set(intent, []);
    }
    this.agents.get(intent)!.push(agent);
  }

  async route(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    const agents = this.agents.get(intent);
    if (!agents || agents.length === 0) {
      return this.fallbackResponse(intent);
    }

    for (const agent of agents) {
      if (agent.canHandle(intent)) {
        return agent.handle(context, intent, params);
      }
    }
    return this.fallbackResponse(intent);
  }

  private fallbackResponse(intent: string): AIResponse {
    return {
      message: `Для "${intent}" пока нет специализированного агента. Используйте меню или уточните запрос.`,
      intent,
      suggestions: ['Показать пациентов', 'Расписание', 'Создать счет', 'Найти курс'],
    };
  }
}

export const agentRouter = new AgentRouter();