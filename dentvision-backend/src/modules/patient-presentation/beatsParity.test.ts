import { describe, expect, it } from 'vitest';

import * as be from './beats.js';
import * as fe from '../../../../src/lib/presentation/beats';

/**
 * The beat contract exists twice: once here, once in the browser bundle. The
 * projects do not share a build and the renderer needs these types, so a copy
 * is unavoidable — but a *silent* divergence is not. If the two ever disagree
 * about how long a line may be, or what counts as a quote, the renderer and the
 * generator stop agreeing about the same script.
 */

describe('the two copies of the beat contract agree', () => {
  it('on the limits', () => {
    expect(fe.MAX_BEAT_CHARS).toBe(be.MAX_BEAT_CHARS);
    expect(fe.MAX_BEAT_SENTENCES).toBe(be.MAX_BEAT_SENTENCES);
    expect(fe.MS_PER_CHARACTER).toBe(be.MS_PER_CHARACTER);
    expect(fe.MIN_BEAT_MS).toBe(be.MIN_BEAT_MS);
    expect([...fe.PRESENTATION_LOCALES]).toEqual([...be.PRESENTATION_LOCALES]);
  });

  const lines = [
    '',
    'Одно предложение.',
    'Первое. Второе. Третье.',
    'Первое. Второе. Третье. Четвёртое.',
    'Без завершающей точки',
    'Вопрос? Восклицание! И многоточие…',
    'x'.repeat(320),
    'x'.repeat(321),
  ];

  it('on sentence counting', () => {
    for (const line of lines) {
      expect(fe.countSentences(line)).toBe(be.countSentences(line));
    }
  });

  it('on what fits inside a beat', () => {
    for (const line of lines) {
      expect(fe.beatWithinLimits(line)).toBe(be.beatWithinLimits(line));
    }
  });

  it('on playback timing', () => {
    for (const line of lines) {
      expect(fe.estimateBeatMs(line)).toBe(be.estimateBeatMs(line));
    }
  });

  const refSets: be.BeatRef[][] = [
    [],
    [{ kind: 'tooth', fdi: 16 }, { kind: 'tooth', fdi: 24 }],
    [{ kind: 'price', amount: 480_000, of: 'plan' }],
    [{ kind: 'diagnosisText' }],
    [{ kind: 'consultationNote' }],
    [{ kind: 'clinicPolicy', key: 'disclaimer' }],
    [{ kind: 'tooth', fdi: 36 }, { kind: 'price', amount: 5_000, of: 'item', id: 'i1' }],
  ];

  it('on which beats are verbatim quotes', () => {
    for (const refs of refSets) {
      expect(fe.isVerbatimQuote({ refs })).toBe(be.isVerbatimQuote({ refs }));
    }
  });

  it('on which teeth and amounts a beat may state', () => {
    for (const refs of refSets) {
      expect(fe.teethInRefs(refs)).toEqual(be.teethInRefs(refs));
      expect(fe.amountsInRefs(refs)).toEqual(be.amountsInRefs(refs));
    }
  });
});
