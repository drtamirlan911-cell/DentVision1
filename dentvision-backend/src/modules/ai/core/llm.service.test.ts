import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEnv,
  chooseOpenAIModel,
  estimateTokens,
  recordModelUsage,
  providerFetch,
  resolveClinicCurrency,
  preferClinicCurrency,
} = vi.hoisted(() => ({
  mockEnv: { OPENAI_API_KEY: 'test-openai-key-012345678901234567' },
  chooseOpenAIModel: vi.fn(),
  estimateTokens: vi.fn(() => 17),
  recordModelUsage: vi.fn(async () => undefined),
  providerFetch: vi.fn(),
  resolveClinicCurrency: vi.fn(async () => 'KZT'),
  preferClinicCurrency: vi.fn((text: string) => text),
}));

vi.mock('../../../config.js', () => ({ env: mockEnv }));
vi.mock('../prompts/system.prompts.js', () => ({
  SYSTEM_PROMPT: 'DentVision system prompt',
  rolePromptFor: () => 'Doctor role prompt',
}));
vi.mock('../lib/currency.js', () => ({
  clinicCurrencyPromptRule: () => 'Use clinic currency',
  preferClinicCurrency,
  resolveClinicCurrency,
}));
vi.mock('../lib/modelRouter.js', () => ({
  chooseOpenAIModel,
  estimateTokens,
  recordModelUsage,
}));
vi.mock('../lib/providerFetch.js', () => ({ providerFetch }));

import type { AIContext, AIResponse } from '../types/ai.types.js';
import { improveResponseWithLLM } from './llm.service.js';

const context = { clinicId: 'clinic-1', role: 'DOCTOR' } as unknown as AIContext;
const response = {
  message: 'Проверенные данные из системы',
  intent: 'SCHEDULE_QUERY',
  suggestions: ['Открыть расписание'],
} as unknown as AIResponse;

const miniChoice = {
  model: 'gpt-4o-mini',
  tier: 'mini' as const,
  reasoningEffort: 'low' as const,
  supportsReasoning: false,
  maxOutputTokens: 500,
  reason: 'polish_always_mini',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.OPENAI_API_KEY = 'test-openai-key-012345678901234567';
  chooseOpenAIModel.mockResolvedValue(miniChoice);
  providerFetch.mockResolvedValue({
    output_text: 'Готовый ответ',
    usage: { total_tokens: 42 },
  });
  resolveClinicCurrency.mockResolvedValue('KZT');
  preferClinicCurrency.mockImplementation((text: string) => text);
});

describe('improveResponseWithLLM', () => {
  it('skips the provider when OPENAI_API_KEY is absent', async () => {
    mockEnv.OPENAI_API_KEY = '';

    await expect(improveResponseWithLLM('Покажи расписание', response, context)).resolves.toBeNull();

    expect(chooseOpenAIModel).not.toHaveBeenCalled();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('uses the shared provider adapter and records provider-reported token usage', async () => {
    await expect(improveResponseWithLLM('Покажи расписание', response, context)).resolves.toBe('Готовый ответ');

    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect(providerFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        apiKey: 'test-openai-key-012345678901234567',
        timeoutMs: 20_000,
        body: expect.objectContaining({
          model: 'gpt-4o-mini',
          instructions: expect.stringContaining('DentVision system prompt'),
          input: expect.stringContaining('Проверенный результат системы: Проверенные данные из системы'),
          max_output_tokens: 500,
        }),
      }),
    );
    const [, options] = providerFetch.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    expect(options.body).not.toHaveProperty('reasoning');
    expect(recordModelUsage).toHaveBeenCalledWith('mini', 42);
    expect(preferClinicCurrency).toHaveBeenCalledWith('Готовый ответ', 'KZT');
  });

  it('sends reasoning settings only when the selected model supports reasoning', async () => {
    chooseOpenAIModel.mockResolvedValue({
      ...miniChoice,
      model: 'o3',
      tier: 'full',
      supportsReasoning: true,
      reasoningEffort: 'medium',
    });

    await improveResponseWithLLM('Объясни подробно', response, context);

    const [, options] = providerFetch.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    expect(options.body.reasoning).toEqual({ effort: 'medium' });
  });

  it('uses the local token estimate when the provider omits usage metadata', async () => {
    providerFetch.mockResolvedValue({ output_text: 'Готовый ответ' });

    await improveResponseWithLLM('Покажи расписание', response, context);

    expect(estimateTokens).toHaveBeenCalledTimes(1);
    expect(recordModelUsage).toHaveBeenCalledWith('mini', 17);
  });

  it('returns the deterministic response when the shared provider adapter fails', async () => {
    providerFetch.mockRejectedValue(new Error('provider unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(improveResponseWithLLM('Покажи расписание', response, context)).resolves.toBeNull();

    expect(recordModelUsage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
