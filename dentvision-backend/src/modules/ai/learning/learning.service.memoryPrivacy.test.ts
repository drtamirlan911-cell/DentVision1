import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => ({
  getLongTerm: vi.fn(),
  setLongTerm: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ default: {} }));
vi.mock('../memory/memory.engine.js', () => ({
  memoryEngine: {
    getLongTerm: memory.getLongTerm,
    setLongTerm: memory.setLongTerm,
  },
}));

import { learnFromUserUtterance, listPrefs, upsertPref } from './learning.service.js';

beforeEach(() => {
  memory.getLongTerm.mockReset().mockResolvedValue({ items: [] });
  memory.setLongTerm.mockReset().mockResolvedValue(undefined);
});

describe('AI learned preference workspace isolation', () => {
  it('keeps explicit free-form facts inside the active clinic scope', async () => {
    await upsertPref('user-1', 'clinic-1', {
      key: 'fact_patient_case',
      label: 'Факт / правило',
      value: 'Patient at clinic one has a medication allergy',
      source: 'explicit',
    });

    expect(memory.setLongTerm).toHaveBeenCalledTimes(1);
    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      expect.objectContaining({ items: [expect.objectContaining({ source: 'explicit' })] }),
      'user-1',
      'clinic-1',
    );
  });

  it('does not learn free-form facts without an active clinic scope', async () => {
    const learned = await learnFromUserUtterance(
      'Запомни, что у пациента аллергия на препарат',
      'user-1',
      null,
    );

    expect(learned).toEqual([]);
    expect(memory.setLongTerm).not.toHaveBeenCalled();
  });

  it('filters historical unscoped facts out of global preferences', async () => {
    const style = {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай кратко',
      source: 'style' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    const oldFact = {
      key: 'fact_patient',
      label: 'Факт / правило',
      value: 'Patient at another workspace has a medication allergy',
      source: 'explicit' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    memory.getLongTerm.mockImplementation(async (_key, _userId, scope) => (
      scope === '__global__' ? { items: [style, oldFact] } : null
    ));

    await expect(listPrefs('user-1', 'clinic-2')).resolves.toEqual([style]);
  });

  it('persists only generic style preferences in the global bucket', async () => {
    await upsertPref('user-1', null, {
      key: 'fact_patient_case',
      label: 'Факт / правило',
      value: 'Patient context from an unscoped workspace',
      source: 'explicit',
    });

    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [] },
      'user-1',
      '__global__',
    );
  });

  it('keeps generic style preferences portable across workspaces', async () => {
    await upsertPref('user-1', 'clinic-1', {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай кратко',
      source: 'style',
    });

    expect(memory.setLongTerm).toHaveBeenCalledTimes(2);
    expect(memory.setLongTerm.mock.calls[0][3]).toBe('clinic-1');
    expect(memory.setLongTerm.mock.calls[1][3]).toBe('__global__');
  });
});
