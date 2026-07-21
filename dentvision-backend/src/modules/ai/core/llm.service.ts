import { env } from '../../../config.js';
import { SYSTEM_PROMPT, ROLE_PROMPTS } from '../prompts/system.prompts.js';
import {
  clinicCurrencyPromptRule,
  preferClinicCurrency,
  resolveClinicCurrency,
} from '../lib/currency.js';
import type { AIContext, AIResponse } from '../types/ai.types.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function rolePrompt(role: string): string {
  const normalizedRole = role.toLowerCase() as keyof typeof ROLE_PROMPTS;
  return ROLE_PROMPTS[normalizedRole] || '';
}

/**
 * Uses the configured frontier model only to write the natural-language
 * response. Data access and actions stay in the deterministic agent layer,
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

  try {
    const result = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        instructions,
        input,
        reasoning: { effort: env.OPENAI_REASONING_EFFORT },
        max_output_tokens: 700,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!result.ok) {
      console.warn(`[AI] OpenAI response failed: ${result.status}`);
      return null;
    }

    const payload = await result.json() as { output_text?: unknown };
    const text = typeof payload.output_text === 'string' ? payload.output_text.trim() : '';
    return text ? preferClinicCurrency(text, currencyCode) : null;
  } catch (error) {
    console.warn('[AI] OpenAI request failed; using deterministic response', error);
    return null;
  }
}
