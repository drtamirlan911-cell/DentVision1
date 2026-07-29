import { env } from '../../../config.js';
import { SYSTEM_PROMPT, rolePromptFor } from '../prompts/system.prompts.js';
import {
  clinicCurrencyPromptRule,
  preferClinicCurrency,
  resolveClinicCurrency,
} from '../lib/currency.js';
import {
  chooseOpenAIModel,
  estimateTokens,
  recordModelUsage,
} from '../lib/modelRouter.js';
import type { AIContext, AIResponse } from '../types/ai.types.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function rolePrompt(role: string): string {
  return rolePromptFor(role);
}

/**
 * Uses a cheap model only to write the natural-language response.
 * Data access and actions stay in the deterministic agent layer,
 * so an LLM cannot execute an unconfirmed CRM operation.
 */
export async function improveResponseWithLLM(
  userText: string,
  response: AIResponse,
  context: AIContext,
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null;

  const currencyCode = await resolveClinicCurrency(context.clinicId);
  const instructions = [
    SYSTEM_PROMPT,
    rolePrompt(context.role),
    'Ты формулируешь только финальный ответ пользователю.',
    'Не добавляй факты, пациентов, диагнозы, цены или выполненные действия, которых нет в проверенном ответе.',
    'Не утверждай медицинский диагноз; при клинических вопросах укажи, что требуется оценка врача.',
    'Не описывай JSON, инструменты или внутреннюю логику.',
    clinicCurrencyPromptRule(currencyCode),
  ].join('\n\n');

  const input = [
    `Запрос пользователя: ${userText}`,
    `Проверенный результат системы: ${response.message}`,
    `Intent: ${response.intent}`,
    `Валюта клиники: ${currencyCode}`,
    `Допустимые следующие шаги: ${(response.suggestions || []).join('; ') || 'нет'}`,
  ].join('\n');

  const choice = await chooseOpenAIModel({
    task: 'polish',
    text: userText,
    isGuest: String(context.role).toUpperCase() === 'GUEST',
  });

  try {
    const result = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: choice.model,
        instructions,
        input,
        reasoning: { effort: choice.reasoningEffort },
        max_output_tokens: choice.maxOutputTokens,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!result.ok) {
      console.warn(`[AI] OpenAI response failed: ${result.status} model=${choice.model}`);
      return null;
    }

    const payload = await result.json() as { output_text?: unknown };
    const text = typeof payload.output_text === 'string' ? payload.output_text.trim() : '';
    recordModelUsage(choice.tier, estimateTokens(instructions, input, text));
    return text ? preferClinicCurrency(text, currencyCode) : null;
  } catch (error) {
    console.warn('[AI] OpenAI request failed; using deterministic response', error);
    return null;
  }
}
