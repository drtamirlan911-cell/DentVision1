import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The properties that matter: a model failure of any kind — no key, a
 * network error, a garbled response — degrades to `null`, never to a thrown
 * error or to malformed data reaching the validator. And a quoted beat is
 * never even offered to the model, because there is nothing legitimate it
 * could do with one.
 */

const { simpleChat } = vi.hoisted(() => ({ simpleChat: vi.fn() }));
vi.mock('../ai/llm/client.js', () => ({ simpleChat }));

const { rewriteScript } = await import('./presentationGenerator.js');

import { estimateBeatMs, type Beat, type PresentationScript } from './beats.js';

function beat(overrides: Partial<Beat> = {}): Beat {
  const say = overrides.say ?? 'Этап 1 — лечение. Врач предлагает: пломба.';
  return {
    id: 'solution-1',
    actId: 'solution',
    order: 1,
    say,
    estimatedMs: estimateBeatMs(say),
    stage: { scene: 'timeline', camera: { focus: 'none' } },
    refs: [{ kind: 'price', amount: 50_000, of: 'stage', id: 'stage-a' }],
    ...overrides,
  };
}

function script(beats: Beat[]): PresentationScript {
  return {
    version: 1,
    locale: 'ru',
    releaseId: 'rel-1',
    personaName: 'Aura',
    acts: [{ id: 'solution', title: 'Что предлагает врач', beats }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rewriteScript', () => {
  it('returns an empty Map without calling the model when every beat is a verbatim quote', async () => {
    const quoted = beat({ id: 'overview-4', refs: [{ kind: 'diagnosisText' }] });
    const result = await rewriteScript(script([quoted]));
    expect(result).toEqual(new Map());
    expect(simpleChat).not.toHaveBeenCalled();
  });

  it('never sends a verbatim-quote beat to the model, even alongside rewritable ones', async () => {
    const quoted = beat({ id: 'overview-4', refs: [{ kind: 'diagnosisText' }] });
    const normal = beat({ id: 'solution-1' });
    simpleChat.mockResolvedValue('[]');
    await rewriteScript(script([quoted, normal]));
    const sentInput = simpleChat.mock.calls[0][1] as string;
    const sentIds = JSON.parse(sentInput).map((b: { id: string }) => b.id);
    expect(sentIds).toEqual(['solution-1']);
  });

  it('returns null when the request throws', async () => {
    simpleChat.mockRejectedValue(new Error('network down'));
    const result = await rewriteScript(script([beat()]));
    expect(result).toBeNull();
  });

  it('returns null on an empty response', async () => {
    simpleChat.mockResolvedValue('');
    const result = await rewriteScript(script([beat()]));
    expect(result).toBeNull();
  });

  it('returns null when the response is not valid JSON', async () => {
    simpleChat.mockResolvedValue('Конечно! Вот переписанный текст: этап один.');
    const result = await rewriteScript(script([beat()]));
    expect(result).toBeNull();
  });

  it('returns null when the response is valid JSON but not an array', async () => {
    simpleChat.mockResolvedValue('{"say": "не массив"}');
    const result = await rewriteScript(script([beat()]));
    expect(result).toBeNull();
  });

  it('parses a well-formed JSON array into a Map keyed by beat id', async () => {
    simpleChat.mockResolvedValue(
      JSON.stringify([{ id: 'solution-1', say: 'Первый этап — лечение зуба пломбой.', saySimple: null }]),
    );
    const result = await rewriteScript(script([beat()]));
    expect(result?.get('solution-1')).toEqual({ say: 'Первый этап — лечение зуба пломбой.' });
  });

  it('extracts JSON wrapped in a markdown code fence', async () => {
    simpleChat.mockResolvedValue(
      '```json\n' + JSON.stringify([{ id: 'solution-1', say: 'Переписанный текст.' }]) + '\n```',
    );
    const result = await rewriteScript(script([beat()]));
    expect(result?.get('solution-1')?.say).toBe('Переписанный текст.');
  });

  it('skips entries with a missing id or empty say rather than throwing', async () => {
    simpleChat.mockResolvedValue(
      JSON.stringify([
        { id: '', say: 'без id' },
        { id: 'solution-1', say: '   ' },
      ]),
    );
    const result = await rewriteScript(script([beat()]));
    expect(result?.size).toBe(0);
  });

  it('carries a non-empty saySimple through, and omits it when blank', async () => {
    simpleChat.mockResolvedValue(
      JSON.stringify([{ id: 'solution-1', say: 'Текст.', saySimple: 'Проще.' }]),
    );
    const result = await rewriteScript(script([beat()]));
    expect(result?.get('solution-1')).toEqual({ say: 'Текст.', saySimple: 'Проще.' });
  });
});
