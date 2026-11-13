import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => ({
  getLongTerm: vi.fn(),
  setLongTerm: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ default: {} }));
vi.mock('../memory/memory.engine.js', () => ({
  memoryEngine: {
    getLongTerm: memory.getLongTerm,
    setLongTerm: memory.setLongTerm,
    getSession: memory.getSession,
  },
}));

import { buildLearningContext, deletePref, learnFromUserUtterance, listPrefs, upsertPref } from './learning.service.js';

beforeEach(() => {
  memory.getLongTerm.mockReset().mockResolvedValue({ items: [] });
  memory.setLongTerm.mockReset().mockResolvedValue(undefined);
  memory.getSession.mockReset().mockResolvedValue(null);
});

describe('AI learned preference workspace isolation', () => {
  it('keeps explicit free-form facts inside the active clinic scope', async () => {
    await upsertPref('user-1', 'clinic-1', {
      key: 'fact_patient_case',
      label: 'Факт / правило',
      value: 'Patient at clinic one has a medication allergy',
      source: 'explicit',
    });

    expect(memory.setLongTerm).toHaveBeenCalledTimes(2);
    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      expect.objectContaining({ items: [expect.objectContaining({ source: 'explicit' })] }),
      'user-1',
      'clinic-1',
    );
    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [] },
      'user-1',
      '__global__',
    );
  });

  it('does not inject a clinic-derived digital twin without an active clinic', async () => {
    const context = await buildLearningContext({
      userId: 'user-1',
      clinicId: null,
      isGuest: false,
      query: 'Покажи расписание',
    });

    expect(context.twinBlock).toBe('');
    expect(memory.getSession).not.toHaveBeenCalled();
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

  it('merges exact-clinic facts with portable global style settings only', async () => {
    const clinicFact = {
      key: 'fact_clinic_rule',
      label: 'Факт / правило',
      value: 'Keep this clinic-specific instruction',
      source: 'explicit' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    const style = {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай кратко',
      source: 'style' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    const oldGlobalFact = {
      key: 'fact_other_clinic',
      label: 'Факт / правило',
      value: 'Do not expose this fact to another clinic',
      source: 'explicit' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    memory.getLongTerm.mockImplementation(async (_key, _userId, scope) => (
      scope === 'clinic-1' ? { items: [clinicFact] }
        : scope === '__global__' ? { items: [style, oldGlobalFact] }
          : null
    ));

    await expect(listPrefs('user-1', 'clinic-1')).resolves.toEqual([clinicFact, style]);
  });

  it('loads global style settings when the active clinic bucket exists but is empty', async () => {
    const style = {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай кратко',
      source: 'style' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    memory.getLongTerm.mockImplementation(async (_key, _userId, scope) => (
      scope === 'clinic-1' ? { items: [] }
        : scope === '__global__' ? { items: [style] }
          : null
    ));

    await expect(listPrefs('user-1', 'clinic-1')).resolves.toEqual([style]);
  });

  it('permanently deletes the final global style preference from a clinic workspace', async () => {
    const style = {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай кратко',
      source: 'style' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    memory.getLongTerm.mockImplementation(async (_key, _userId, scope) => (
      scope === 'clinic-1' ? { items: [] }
        : scope === '__global__' ? { items: [style] }
          : null
    ));

    await expect(deletePref('user-1', 'clinic-1', 'style_length')).resolves.toBe(true);
    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [] },
      'user-1',
      '__global__',
    );
  });

  it('persists an empty global bucket when the final global style preference is deleted', async () => {
    const style = {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай кратко',
      source: 'style' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    memory.getLongTerm.mockResolvedValue({ items: [style] });

    await expect(deletePref('user-1', null, 'style_length')).resolves.toBe(true);
    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [] },
      'user-1',
      '__global__',
    );
  });

  it('does not persist an explicit fact in the global bucket without an active clinic', async () => {
    await upsertPref('user-1', null, {
      key: 'fact_patient_case',
      label: 'Факт / правило',
      value: 'Patient context from an unscoped workspace',
      source: 'explicit',
    });

    expect(memory.setLongTerm).toHaveBeenCalledTimes(1);
    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [] },
      'user-1',
      '__global__',
    );
  });


  it('does not copy inherited global styles into clinic-local fact writes', async () => {
    const style = {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай кратко',
      source: 'style' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    memory.getLongTerm.mockImplementation(async (_key, _userId, scope) => (
      scope === 'clinic-1' ? { items: [] } : scope === '__global__' ? { items: [style] } : null
    ));

    await upsertPref('user-1', 'clinic-1', {
      key: 'fact_clinic_rule',
      label: 'Факт / правило',
      value: 'Keep this fact in clinic one',
      source: 'explicit',
    });

    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [expect.objectContaining({ key: 'fact_clinic_rule' })] },
      'user-1',
      'clinic-1',
    );
    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [style] },
      'user-1',
      '__global__',
    );
  });

  it('does not overwrite a portable global style with a clinic-local override during a fact save', async () => {
    const localStyle = {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Локальный стиль клиники',
      source: 'style' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    const globalStyle = {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Глобальный стиль',
      source: 'style' as const,
      updatedAt: '2026-11-12T00:00:00.000Z',
    };
    memory.getLongTerm.mockImplementation(async (_key, _userId, scope) => (
      scope === 'clinic-1' ? { items: [localStyle] } : scope === '__global__' ? { items: [globalStyle] } : null
    ));

    await upsertPref('user-1', 'clinic-1', {
      key: 'fact_clinic_rule',
      label: 'Факт / правило',
      value: 'Keep this fact in clinic one',
      source: 'explicit',
    });

    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [expect.objectContaining({ key: 'fact_clinic_rule' }), localStyle] },
      'user-1',
      'clinic-1',
    );
    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [globalStyle] },
      'user-1',
      '__global__',
    );
  });

  it('does not truncate portable styles when the clinic has many local facts', async () => {
    const style = {
      key: 'style_length',
      label: 'Стиль ответа',
      value: 'Отвечай кратко',
      source: 'style' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    };
    const localFacts = Array.from({ length: 40 }, (_, index) => ({
      key: `fact_${index}`,
      label: 'Факт / правило',
      value: `Clinic fact ${index}`,
      source: 'explicit' as const,
      updatedAt: '2026-11-13T00:00:00.000Z',
    }));
    memory.getLongTerm.mockImplementation(async (_key, _userId, scope) => (
      scope === 'clinic-1' ? { items: localFacts } : scope === '__global__' ? { items: [style] } : null
    ));

    await upsertPref('user-1', 'clinic-1', {
      key: 'fact_new',
      label: 'Факт / правило',
      value: 'A new clinic fact',
      source: 'explicit',
    });

    expect(memory.setLongTerm).toHaveBeenCalledWith(
      'user_prefs',
      { items: [style] },
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
