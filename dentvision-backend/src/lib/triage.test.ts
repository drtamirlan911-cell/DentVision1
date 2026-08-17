import { describe, expect, it } from 'vitest';

import {
  assessTriage,
  nextTriageQuestion,
  TRIAGE_QUESTIONS,
  type TriageAnswers,
} from './triage.js';

/**
 * Triage is the one place in this product where being wrong has a clinical
 * cost, so it is tested the way the rules were written: every red flag gets a
 * case, and the cases that matter most are the ones where a plausible-sounding
 * answer must NOT soften the verdict.
 */

describe('red flags always reach emergency', () => {
  const cases: Array<[string, TriageAnswers]> = [
    ['trouble breathing or swallowing', { breathingOrSwallowing: true }],
    ['swelling spreading across the face', { swelling: 'spreading' }],
    ['local swelling with a fever', { swelling: 'local', fever: true }],
    ['bleeding that will not stop', { uncontrolledBleeding: true }],
    ['a permanent tooth knocked out', { toothKnockedOut: true }],
  ];

  for (const [name, answers] of cases) {
    it(name, () => {
      const verdict = assessTriage(answers);
      expect(verdict.level).toBe('emergency');
      expect(verdict.patientMessage.length).toBeGreaterThan(20);
    });
  }

  it('does not let a low pain score talk it down', () => {
    // The dangerous shape: an infection tracking toward the airway can hurt
    // less than the toothache that started it, because the pulp is already
    // dead. A patient reporting 1/10 with a spreading swelling is the case
    // this whole module exists for.
    const verdict = assessTriage({ painLevel: 1, swelling: 'spreading' });
    expect(verdict.level).toBe('emergency');
    expect(verdict.reasonCode).toBe('SPREADING_SWELLING');
  });

  it('does not let a short duration talk it down', () => {
    const verdict = assessTriage({ durationDays: 0, breathingOrSwallowing: true });
    expect(verdict.level).toBe('emergency');
  });

  it('puts the airway ahead of everything else', () => {
    const verdict = assessTriage({
      breathingOrSwallowing: true,
      swelling: 'spreading',
      toothKnockedOut: true,
      uncontrolledBleeding: true,
    });
    expect(verdict.reasonCode).toBe('AIRWAY');
  });

  it('tells the patient to call rather than to wait', () => {
    for (const [, answers] of cases) {
      expect(assessTriage(answers).callNow).toBe(true);
    }
  });
});

describe('urgent, but not an emergency run', () => {
  it('severe pain', () => {
    expect(assessTriage({ painLevel: 8 }).level).toBe('urgent');
  });

  it('swelling with no systemic signs', () => {
    const verdict = assessTriage({ swelling: 'local', fever: false });
    expect(verdict.level).toBe('urgent');
    expect(verdict.reasonCode).toBe('LOCAL_SWELLING');
  });

  it('a blow to the face, even with nothing visibly broken', () => {
    expect(assessTriage({ trauma: true, painLevel: 2 }).level).toBe('urgent');
  });

  it('pain that wakes the patient at night', () => {
    expect(assessTriage({ wakesAtNight: true, painLevel: 3 }).level).toBe('urgent');
  });
});

describe('the boundaries are where the rules actually live', () => {
  it('7 is urgent and 6 is not', () => {
    expect(assessTriage({ painLevel: 7 }).level).toBe('urgent');
    expect(assessTriage({ painLevel: 6 }).level).toBe('soon');
  });

  it('4 is soon and 3 is routine', () => {
    expect(assessTriage({ painLevel: 4 }).level).toBe('soon');
    expect(assessTriage({ painLevel: 3 }).level).toBe('routine');
  });

  it('14 days is soon and 13 is routine', () => {
    expect(assessTriage({ durationDays: 14 }).reasonCode).toBe('LINGERING');
    expect(assessTriage({ durationDays: 13 }).level).toBe('routine');
  });
});

describe('the verdict is total and stable', () => {
  it('answers nothing at all with routine rather than throwing', () => {
    const verdict = assessTriage({});
    expect(verdict.level).toBe('routine');
    expect(verdict.callNow).toBe(false);
  });

  it('treats unknown as unknown, never as reassuring', () => {
    // Absent swelling must not read as "no swelling" in a way that clears a
    // fever-driven flag: with only a fever known, nothing escalates, but the
    // moment swelling is reported the rule fires.
    expect(assessTriage({ fever: true }).level).toBe('routine');
    expect(assessTriage({ fever: true, swelling: 'local' }).level).toBe('emergency');
  });

  it('gives the same verdict for the same answers', () => {
    const answers: TriageAnswers = { painLevel: 5, swelling: 'none', durationDays: 3 };
    const first = assessTriage(answers);
    for (let i = 0; i < 20; i += 1) {
      expect(assessTriage(answers)).toEqual(first);
    }
  });

  it('never returns an empty message', () => {
    const levels = new Set<string>();
    for (const answers of [
      { breathingOrSwallowing: true },
      { painLevel: 9 },
      { painLevel: 5 },
      {},
    ] as TriageAnswers[]) {
      const v = assessTriage(answers);
      levels.add(v.level);
      expect(v.patientMessage.trim()).not.toBe('');
      expect(v.reasonCode).toMatch(/^[A-Z_]+$/);
    }
    // All four levels are reachable — a level nothing can produce is a bug.
    expect(levels).toEqual(new Set(['emergency', 'urgent', 'soon', 'routine']));
  });
});

describe('the question protocol', () => {
  it('asks about the airway before it asks about pain', () => {
    const slots = TRIAGE_QUESTIONS.map((q) => q.slot);
    expect(slots.indexOf('breathingOrSwallowing')).toBeLessThan(slots.indexOf('painLevel'));
  });

  it('walks every slot and then stops', () => {
    const answers: TriageAnswers = {};
    const asked: string[] = [];
    let q = nextTriageQuestion(answers);
    while (q) {
      asked.push(q);
      const slot = TRIAGE_QUESTIONS.find((x) => x.question === q)!.slot;
      (answers as any)[slot] = slot === 'painLevel' || slot === 'durationDays' ? 0 : false;
      q = nextTriageQuestion(answers);
      if (asked.length > TRIAGE_QUESTIONS.length) break;
    }
    expect(asked).toHaveLength(TRIAGE_QUESTIONS.length);
    expect(nextTriageQuestion(answers)).toBeNull();
  });
});
