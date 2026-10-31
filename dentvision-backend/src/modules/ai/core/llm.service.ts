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
import { providerFetch } from '../lib/providerFetch.js';
import type { AIContext, AIResponse } from '../types/ai.types.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const REQUEST_TIMEOUT_MS = 20_000;

function rolePrompt(role: string): string {
  return rolePromptFor(role);
}

interface PolishResponse {
  output_text?: unknown;
  usage?: {
    total_tokens?: number;
  };
}

/**
 * Uses a cheap model only to write the natural-language response.
 * Data access and actions stay in the deterministic agent layer,
 * so an LLM cannot execute an unconfirmed CRM operation.
 *
 * All Responses API requests use the shared provider adapter so retry,
 * timeout and terminal-provider-error behavior stays consistent.
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
    const payload = await providerFetch<PolishResponse>(OPENAI_RESPONSES_URL, {
      apiKey: env.OPENAI_API_KEY,
      body: {
        model: choice.model,
        instructions,
        input,
        ...(choice.supportsReasoning
          ? { reasoning: { effort: choice.reasoningEffort } }
          : {}),
        max_output_tokens: choice.maxOutputTokens,
      },
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    const text = typeof payload.output_text === 'string' ? payload.output_text.trim() : '';
    if (!text) return null;

    const reportedTokens = payload.usage?.total_tokens;
    const tokens = Number.isFinite(reportedTokens) && (reportedTokens as number) > 0
      ? (reportedTokens as number)
      : estimateTokens(instructions, input, text);
    await recordModelUsage(choice.tier, tokens);

    return preferClinicCurrency(text, currencyCode);
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? (error as { status?: number }).status
        : undefined;
    console.warn(
      '[AI] OpenAI request failed; using deterministic response',
      status ? { status } : undefined,
    );
    return null;
  }
}
