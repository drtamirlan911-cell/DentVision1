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

import { upsertPref } from './learning.service.js';

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
