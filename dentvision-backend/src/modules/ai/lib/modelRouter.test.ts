import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetModelUsageForTests,
  estimateTokens,
  isComplexQuery,
  pickModel,
  recordModelUsage,
  getModelUsageSnapshot,
  supportsReasoning,
} from './modelRouter';

describe('estimateTokens', () => {
  it('estimates from character length', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });
});

describe('isComplexQuery', () => {
  it('treats guests as never complex', () => {
    expect(isComplexQuery('Сделай глубокий анализ клиники', { isGuest: true })).toBe(false);
  });

  it('flags analytical clinic prompts', () => {
    expect(isComplexQuery('Сравни выручку и долги, дай анализ рисков')).toBe(true);
  });

  it('keeps short operational prompts simple', () => {
    expect(isComplexQuery('Покажи расписание на сегодня')).toBe(false);
  });
});

describe('pickModel', () => {
  beforeEach(() => {
    __resetModelUsageForTests();
  });

  const base = {
    miniModel: 'gpt-5.4-mini',
    fullModel: 'gpt-5.4',
    mode: 'auto' as const,
    reasoningEffort: 'medium' as const,
    miniUsed: 0,
    fullUsed: 0,
    miniBudget: 2_400_000,
    fullBudget: 240_000,
  };

  it('routes polish and guests to mini', () => {
    expect(
      pickModel({ ...base, task: 'polish', text: 'привет' }).tier,
    ).toBe('mini');
    expect(
      pickModel({ ...base, task: 'orchestrate', text: 'что умеет DentVision?', isGuest: true }).tier,
    ).toBe('mini');
  });

  it('escalates complex clinic queries to full', () => {
    const choice = pickModel({
      ...base,
      task: 'orchestrate',
      text: 'Сделай подробный анализ выручки и рисков кассы',
    });
    expect(choice.tier).toBe('full');
    expect(choice.model).toBe('gpt-5.4');
  });

  it('stays on mini for simple ops', () => {
    const choice = pickModel({
      ...base,
      task: 'orchestrate',
      text: 'Покажи расписание',
    });
    expect(choice.tier).toBe('mini');
    expect(choice.reason).toBe('default_cheap');
  });

  it('falls back to mini when full budget is exhausted', () => {
    const choice = pickModel({
      ...base,
      task: 'orchestrate',
      text: 'Сделай подробный анализ выручки и рисков кассы',
      fullUsed: 240_000,
    });
    expect(choice.tier).toBe('mini');
    expect(choice.reason).toBe('want_full_but_budget_exhausted');
  });

  it('records soft usage in process memory', () => {
    recordModelUsage('mini', 1000);
    recordModelUsage('full', 500);
    const snap = getModelUsageSnapshot();
    expect(snap.miniUsed).toBe(1000);
    expect(snap.fullUsed).toBe(500);
  });
});

describe('supportsReasoning', () => {
  // `reasoning` used to be sent on every request, including to gpt-4o, which
  // has no such mode. The predicate is what keeps it off those models.
  it.each(['o1', 'o1-mini', 'o3', 'gpt-5.4', 'gpt-5.4-mini', 'GPT-5'])(
    'recognises %s as a reasoning model',
    (model) => {
      expect(supportsReasoning(model)).toBe(true);
    },
  );

  it.each(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4o-mini-tts', ''])(
    'does not claim reasoning for %s',
    (model) => {
      expect(supportsReasoning(model)).toBe(false);
    },
  );
});

describe('pickModel — reasoning flag', () => {
  beforeEach(() => __resetModelUsageForTests());

  it('carries the flag for the model it actually picked', () => {
    const mini = pickModel({ task: 'polish', text: 'x', miniModel: 'gpt-4o-mini', fullModel: 'o3' });
    expect(mini.model).toBe('gpt-4o-mini');
    expect(mini.supportsReasoning).toBe(false);

    const full = pickModel({ task: 'orchestrate', text: 'x', mode: 'full', miniModel: 'gpt-4o-mini', fullModel: 'o3' });
    expect(full.model).toBe('o3');
    expect(full.supportsReasoning).toBe(true);
  });
});
