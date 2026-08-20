import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { estimateBeatMs, type Beat } from './beats.js';
import {
  DIAGNOSIS_TERMS,
  NON_DIAGNOSTIC_ICD10,
  WHOLESALE_FALLBACK_RATIO,
  applyRewrite,
  numericTokens,
  validateBeat,
} from './scriptValidator.js';

/**
 * These tests are written as attacks, because that is what the validator is
 * for. Each case is something a model plausibly does — invent a price, add a
 * tooth, name a diagnosis, promise a result, frighten the patient — and each
 * one has to be refused and replaced by the template line.
 *
 * A validator whose tests only feed it good input tells you nothing.
 */

function beat(overrides: Partial<Beat> = {}): Beat {
  const say = overrides.say ?? 'Этап 2 — протезирование. Врач предлагает: коронка.';
  return {
    id: 'solution-2',
    actId: 'solution',
    order: 2,
    say,
    estimatedMs: estimateBeatMs(say),
    stage: { scene: 'timeline', camera: { focus: 'none' } },
    refs: [{ kind: 'price', amount: 200_000, of: 'stage', id: 'stage-b' }],
    ...overrides,
  };
}

function check(candidate: string, over: Partial<Beat> = {}, diagnosisText?: string | null) {
  return validateBeat({ beat: beat(over), candidate: { say: candidate }, diagnosisText });
}

describe('numericTokens reads money the way people write it', () => {
  it.each([
    ['1240000', [1_240_000]],
    ['1 240 000', [1_240_000]],
    ['1 240 000', [1_240_000]],
    ['1 240 000', [1_240_000]],
  ])('reads %s', (input, expected) => {
    expect(numericTokens(input)).toEqual(expected);
  });

  it('expands "млн" and "тыс", so a restated price is still comparable', () => {
    expect(numericTokens('1,24 млн')).toContain(1_240_000);
    expect(numericTokens('320 тыс')).toContain(320_000);
  });

  it('records both readings of a bare decimal, so punctuation cannot hide a number', () => {
    expect(numericTokens('1,24')).toEqual(expect.arrayContaining([1]));
  });

  it('finds every number in a sentence', () => {
    expect(numericTokens('Этап 2 — зубы 16 и 26, всего 285 000 ₸.')).toEqual(
      expect.arrayContaining([2, 16, 26, 285_000]),
    );
  });
});

describe('a model that invents a number is refused', () => {
  it('rejects a price that is in neither the template nor the refs', () => {
    const result = check('Протезирование обойдётся в 340 000 ₸.');
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('numbers');
  });

  it('accepts the price the beat actually references', () => {
    expect(check('Протезирование — 200 000 ₸.').ok).toBe(true);
  });

  it('catches the same invented price restated as "млн"', () => {
    const withMillion = check('Всё вместе — около 1,24 млн ₸.');
    expect(withMillion.ok).toBe(false);
    expect(withMillion.failures.map((f) => f.rule)).toContain('numbers');
  });

  it('keeps ordinals the template itself wrote, without special-casing them', () => {
    // "Этап 2" is in the template, so 2 is allowed — no threshold needed.
    expect(check('Второй этап, этап 2, — протезирование.').ok).toBe(true);
  });

  it('rejects a count the template never mentioned', () => {
    const result = check('Этап 2 займёт 5 визитов.');
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('numbers');
  });
});

describe('a model that adds a tooth is refused', () => {
  const withTeeth = { refs: [{ kind: 'tooth' as const, fdi: 16 }], say: 'Лечить в первую очередь: 16.' };

  it('accepts the tooth the beat references', () => {
    expect(check('В первую очередь — зуб 16.', withTeeth).ok).toBe(true);
  });

  it('rejects a tooth the beat does not reference', () => {
    const result = check('В первую очередь — зубы 16 и 26.', withTeeth);
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toEqual(expect.arrayContaining(['numbers', 'teeth']));
  });
});

describe('a model that names a diagnosis is refused', () => {
  it('rejects an ICD-10 term the doctor never wrote', () => {
    const result = check('Похоже на пульпит, это лечится.');
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('diagnosis');
  });

  it('rejects it even when phrased as a hedge', () => {
    expect(check('Возможно, у вас начинается периодонтит.').ok).toBe(false);
  });

  it('allows a term the doctor did write, in a beat that carries the snapshot text', () => {
    const result = check(
      'Врач отметил периодонтит и предлагает начать с него.',
      {},
      'Хронический периодонтит 16',
    );
    expect(result.failures.filter((f) => f.rule === 'diagnosis')).toHaveLength(0);
  });
});

describe('quotes are not rewritten at all', () => {
  const quote = {
    say: 'Врач записал: Хронический периодонтит 16.',
    refs: [{ kind: 'diagnosisText' as const }],
  };

  it('accepts a byte-identical reproduction', () => {
    expect(check('Врач записал: Хронический периодонтит 16.', quote).ok).toBe(true);
  });

  it('rejects even a harmless-looking paraphrase', () => {
    const result = check('Врач записал у вас хронический периодонтит зуба 16.', quote);
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('verbatim');
  });

  it('rejects a trimmed quote', () => {
    expect(check('Врач записал: Хронический периодонтит.', quote).ok).toBe(false);
  });

  it('refuses a simplified variant of a quote', () => {
    const result = validateBeat({
      beat: beat(quote),
      candidate: { say: quote.say, saySimple: 'У вас воспаление у корня.' },
    });
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('verbatim');
  });
});

describe('a model that promises or frightens is refused', () => {
  it.each([
    ['гарантированно', 'Мы гарантированно сохраним зуб.'],
    ['навсегда', 'Этого хватит навсегда.'],
    ['100%', 'Результат 100% предсказуем.'],
    ['без боли', 'Лечение проходит без боли.'],
    ['полностью вылечим', 'Мы полностью вылечим этот зуб.'],
  ])('rejects a promise: %s', (_label, text) => {
    const result = check(text);
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('promise');
  });

  it.each([
    ['выпадение', 'Без лечения зубы начнут выпадать.'],
    ['потеряете все зубы', 'Иначе вы потеряете все зубы.'],
    ['опасно для жизни', 'Это опасно для жизни.'],
  ])('rejects fear-mongering: %s', (_label, text) => {
    const result = check(text);
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('fear');
  });
});

describe('a model that runs on is refused', () => {
  it('rejects a line over the character limit', () => {
    const result = check('А'.repeat(321) + '.');
    expect(result.failures.map((f) => f.rule)).toContain('length');
  });

  it('rejects more than three sentences', () => {
    const result = check('Один. Два. Три. Четыре.');
    expect(result.failures.map((f) => f.rule)).toContain('sentences');
  });

  it('rejects an empty rewrite rather than showing a blank line', () => {
    const result = validateBeat({ beat: beat(), candidate: { say: '   ' } });
    expect(result.ok).toBe(false);
    expect(result.failures[0].rule).toBe('empty');
  });
});

describe('the simplified variant is held to the same rules', () => {
  it('rejects an invented number hiding in saySimple', () => {
    const result = validateBeat({
      beat: beat(),
      candidate: { say: 'Этап 2 — протезирование.', saySimple: 'Это будет стоить 340 000 ₸.' },
    });
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('numbers');
  });

  it('accepts a genuinely simpler restatement', () => {
    const result = validateBeat({
      beat: beat(),
      candidate: { say: 'Этап 2 — протезирование. Врач предлагает коронку.', saySimple: 'Дальше — коронка.' },
    });
    expect(result.ok).toBe(true);
  });
});

describe('applying a rewrite degrades in layers', () => {
  const beats = [
    beat({ id: 'b1', say: 'Первая реплика про этап 2.' }),
    beat({ id: 'b2', say: 'Вторая реплика про этап 2.' }),
    beat({ id: 'b3', say: 'Третья реплика про этап 2.' }),
    beat({ id: 'b4', say: 'Четвёртая реплика про этап 2.' }),
  ];

  it('keeps the good lines and replaces only the refused one', () => {
    // Four rewrites, one refusal — 25%, under the wholesale threshold, so the
    // accepted lines survive. (One refusal out of two would be 50% and would
    // correctly throw the whole rewrite away; that case is covered below.)
    const { beats: out, review } = applyRewrite(
      beats,
      new Map([
        ['b1', { say: 'Переписанная первая, этап 2.' }],
        ['b2', { say: 'Стоит 999 000 ₸.' }],
        ['b3', { say: 'Переписанная третья, этап 2.' }],
        ['b4', { say: 'Переписанная четвёртая, этап 2.' }],
      ]),
    );
    expect(out[0].say).toBe('Переписанная первая, этап 2.');
    expect(out[1].say).toBe('Вторая реплика про этап 2.');
    expect(out[3].say).toBe('Переписанная четвёртая, этап 2.');
    expect(review.acceptedCount).toBe(3);
    expect(review.rejectedCount).toBe(1);
  });

  it('throws the rewrite away when a single refusal is already too large a share', () => {
    const { beats: out, review } = applyRewrite(
      beats,
      new Map([
        ['b1', { say: 'Переписанная первая, этап 2.' }],
        ['b2', { say: 'Стоит 999 000 ₸.' }],
      ]),
    );
    expect(review.fellBackWholesale).toBe(true);
    expect(out.map((b) => b.say)).toEqual(beats.map((b) => b.say));
  });

  it('leaves beats the model did not touch exactly as they were', () => {
    const { beats: out } = applyRewrite(beats, new Map([['b1', { say: 'Переписанная, этап 2.' }]]));
    expect(out.slice(1).map((b) => b.say)).toEqual(beats.slice(1).map((b) => b.say));
  });

  it('throws away the whole rewrite when too much was refused', () => {
    const { beats: out, review } = applyRewrite(
      beats,
      new Map([
        ['b1', { say: 'Хорошая переписанная, этап 2.' }],
        ['b2', { say: 'Гарантированно навсегда.' }],
        ['b3', { say: 'Стоит 999 000 ₸.' }],
        ['b4', { say: 'У вас пульпит.' }],
      ]),
    );
    expect(review.rejectedCount / review.beats.length).toBeGreaterThan(WHOLESALE_FALLBACK_RATIO);
    expect(review.fellBackWholesale).toBe(true);
    // Even the line that passed is dropped: half template, half model reads as
    // neither, and the deterministic script is a complete, coherent one.
    expect(out.map((b) => b.say)).toEqual(beats.map((b) => b.say));
  });

  it('reports which rule each rejection broke, for the doctor’s preview', () => {
    const { review } = applyRewrite(beats, new Map([['b2', { say: 'Гарантированно вылечим за 999 000 ₸.' }]]));
    const rules = review.beats[0].failures.map((f) => f.rule);
    expect(rules).toEqual(expect.arrayContaining(['promise', 'numbers']));
  });

  it('is a no-op when the model returned nothing at all', () => {
    const { beats: out, review } = applyRewrite(beats, new Map());
    expect(out).toEqual(beats);
    expect(review.fellBackWholesale).toBe(false);
  });
});

/**
 * The head-term list has to keep up with the ICD-10 catalogue the product
 * already ships. Reading that file here — rather than copying its 118 rows into
 * the backend — keeps one source of truth and still fails loudly when a new
 * disease family is added that nothing here would catch.
 */
describe('the diagnosis term list covers the catalogue the product ships', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../../src/lib/icd10-data.ts'),
    'utf8',
  );
  const names = [...source.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
  const uncovered = names.filter(
    (name) => !DIAGNOSIS_TERMS.some((term) => name.toLowerCase().includes(term)),
  );

  it('finds the catalogue', () => {
    expect(names.length).toBeGreaterThan(50);
  });

  it('leaves uncovered only the entries that name a procedure, never a condition', () => {
    // The exclusion is narrow and named. "Зубное протезирование" has to stay
    // sayable — the deterministic template writes it in act 4 — while every
    // entry that names a *condition* must be caught. If a new code lands that
    // this list does not cover, this fails and the term goes in rather than the
    // exclusion growing.
    expect(uncovered.sort()).toEqual([...NON_DIAGNOSTIC_ICD10].sort());
  });

  it('does not block the treatment vocabulary the script itself uses', () => {
    for (const word of ['протезирование', 'обследование', 'консультация', 'экстракция', 'коронка', 'имплантация']) {
      expect(
        DIAGNOSIS_TERMS.some((term) => word.includes(term)),
        `"${word}" would be refused, but the template says it`,
      ).toBe(false);
    }
  });
});

describe('a consequence beat may use the vocabulary of the entry it cites', () => {
  const consequenceBeat = beat({
    id: 'consequences-2',
    actId: 'consequences',
    say: 'Кариес сам не проходит. Пока он небольшой, лечение обычно проще и дешевле, чем когда полость доходит до нерва.',
    refs: [{ kind: 'consequence', libraryKey: 'caries:medium', version: '1' }],
  });

  it('accepts a rephrasing that keeps the condition the library named', () => {
    // Otherwise the validator would refuse its own library: a clinician wrote
    // that sentence, and the beat cites it by key and version.
    const result = validateBeat({
      beat: consequenceBeat,
      candidate: { say: 'Кариес сам не пройдёт, и чем раньше им заняться, тем проще лечение.' },
    });
    expect(result.failures.filter((f) => f.rule === 'diagnosis')).toHaveLength(0);
  });

  it('still refuses a different condition the cited entry never mentioned', () => {
    const result = validateBeat({
      beat: consequenceBeat,
      candidate: { say: 'Кариес сам не пройдёт, а рядом уже начинается пульпит.' },
    });
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('diagnosis');
  });
});
