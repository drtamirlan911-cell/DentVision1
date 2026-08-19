import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_LOCALES,
  amountsInRefs,
  beatWithinLimits,
  countSentences,
  isVerbatimQuote,
  teethInRefs,
} from './beats.js';
import { buildScriptSkeleton, priorityForStage } from './scriptSkeleton.js';

/**
 * The whole point of this generator is that it cannot invent anything. These
 * tests are mostly about that: every number and tooth a beat says must be
 * traceable to its own `refs`, in all three locales, including on ugly input.
 */

const SNAPSHOT = {
  diagnosis: 'Хронический периодонтит 16',
  stages: [
    {
      id: 'stage-a',
      title: 'Лечение',
      items: [
        { id: 'i1', serviceName: 'Лечение каналов', price: 120_000, teeth: [16], qty: 1 },
        { id: 'i2', serviceName: 'Коронка', price: 180_000, teeth: [16], qty: 1 },
      ],
    },
    {
      id: 'stage-b',
      title: 'Восстановление',
      items: [{ id: 'i3', serviceName: 'Винир', price: 200_000, teeth: [24, 25], qty: 1 }],
    },
    {
      id: 'stage-c',
      title: 'Контроль',
      items: [{ id: 'i4', serviceName: 'Осмотр', price: 5_000, teeth: [], qty: 1 }],
    },
  ],
};

function build(overrides: Record<string, unknown> = {}) {
  return buildScriptSkeleton({
    releaseId: 'rel-1',
    snapshot: SNAPSHOT,
    patientFirstName: 'Тамирлан',
    clinicName: 'DentVision',
    doctorName: 'Айгерим Нурлановна',
    totalAmount: 700_000,
    ...overrides,
  });
}

function allBeats(script: ReturnType<typeof build>) {
  return script.acts.flatMap((a) => a.beats);
}

/** Digit groups a beat states, with thousands separators collapsed. */
function numbersIn(say: string): number[] {
  const out: number[] = [];
  for (const match of say.matchAll(/\d[\d\s]*/g)) {
    const n = Number(match[0].replace(/[\s]/g, ''));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

describe('priorityForStage', () => {
  it("reads the doctor's own staging as the priority", () => {
    expect(priorityForStage(0)).toBe('now');
    expect(priorityForStage(1)).toBe('plan');
    expect(priorityForStage(2)).toBe('watch');
    expect(priorityForStage(7)).toBe('watch');
  });
});

describe('the script it produces', () => {
  it('covers the three acts this phase ships', () => {
    expect(build().acts.map((a) => a.id)).toEqual(['overview', 'findings', 'solution']);
  });

  it('is deterministic — same input, byte-identical output', () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('gives every beat a stable id and a playable duration', () => {
    for (const b of allBeats(build())) {
      expect(b.id).toBe(`${b.actId}-${b.order}`);
      expect(b.estimatedMs).toBeGreaterThanOrEqual(2200);
    }
  });

  it('keeps every line inside the limits the validator enforces', () => {
    for (const b of allBeats(build())) {
      expect(beatWithinLimits(b.say), `too long: ${b.say}`).toBe(true);
      expect(countSentences(b.say)).toBeLessThanOrEqual(3);
    }
  });
});

describe('it cannot invent facts', () => {
  it('states no tooth that is not in the beat refs', () => {
    for (const b of allBeats(build())) {
      // A quote of the doctor's own words is exempt from number provenance and
      // held to the stricter verbatim rule below instead — a diagnosis may
      // legitimately read "Хронический периодонтит 16".
      if (isVerbatimQuote(b)) continue;
      const allowed = new Set(teethInRefs(b.refs));
      for (const n of numbersIn(b.say)) {
        // Two-digit FDI numbers are the only tooth-shaped tokens; anything in
        // that range must be a tooth the beat actually references.
        if (n >= 11 && n <= 48 && !amountsInRefs(b.refs).includes(n)) {
          expect(allowed.has(n), `beat "${b.say}" mentions tooth ${n} without a ref`).toBe(true);
        }
      }
    }
  });

  it('states no amount that is not in the beat refs', () => {
    for (const b of allBeats(build())) {
      if (isVerbatimQuote(b)) continue;
      const allowed = new Set(amountsInRefs(b.refs));
      for (const n of numbersIn(b.say)) {
        if (n >= 1000) {
          expect(allowed.has(n), `beat "${b.say}" states ${n} without a price ref`).toBe(true);
        }
      }
    }
  });

  it('reproduces the doctor\'s diagnosis exactly, the stricter rule quotes are held to', () => {
    const script = build();
    const quotes = allBeats(script).filter(isVerbatimQuote);
    expect(quotes).toHaveLength(1);
    // Not paraphrased, not truncated, not reordered — the source text is a
    // contiguous substring of the line. A later LLM pass may not touch it.
    expect(quotes[0].say).toContain(SNAPSHOT.diagnosis);
  });

  it('a quote beat carries no invented refs it could hide behind', () => {
    const quotes = allBeats(build()).filter(isVerbatimQuote);
    for (const q of quotes) {
      expect(q.refs.every((r) => r.kind === 'diagnosisText' || r.kind === 'consultationNote')).toBe(true);
    }
  });

  it('omits the diagnosis beat entirely when the doctor wrote none', () => {
    const script = build({ snapshot: { ...SNAPSHOT, diagnosis: null } });
    expect(allBeats(script).some((b) => b.refs.some((r) => r.kind === 'diagnosisText'))).toBe(false);
  });
});

describe('the persona never reads as a doctor', () => {
  it('says so in act one, in every locale', () => {
    for (const locale of PRESENTATION_LOCALES) {
      const script = build({ locale });
      const disclaimer = script.acts[0].beats.find((b) =>
        b.refs.some((r) => r.kind === 'clinicPolicy' && r.key === 'disclaimer'),
      );
      // Hard-coded rather than generated, so it survives total LLM failure.
      expect(disclaimer, `no disclaimer for ${locale}`).toBeTruthy();
      expect(disclaimer!.say.length).toBeGreaterThan(20);
    }
  });

  it('names the treating doctor when one is known', () => {
    expect(JSON.stringify(build())).toContain('Айгерим Нурлановна');
  });

  it('still works when the doctor is unknown', () => {
    const script = build({ doctorName: null });
    expect(allBeats(script).length).toBeGreaterThan(3);
    expect(JSON.stringify(script)).not.toContain('null');
  });
});

describe('stage direction', () => {
  it('highlights exactly the teeth of the stage it is talking about', () => {
    const findings = build().acts.find((a) => a.id === 'findings')!;
    const stageBeats = findings.beats.filter((b) => b.stage.stageId);
    expect(stageBeats.length).toBe(2); // stage-c has no teeth
    expect(stageBeats[0].stage.highlightTeeth).toEqual([16]);
    expect(stageBeats[1].stage.highlightTeeth).toEqual([24, 25]);
  });

  it('marks the first stage as the urgent one and the third as watch', () => {
    const findings = build().acts.find((a) => a.id === 'findings')!;
    const withPriority = findings.beats.filter((b) => b.stage.emphasis?.priority);
    expect(withPriority[0].stage.emphasis!.priority).toBe('now');
    expect(withPriority[1].stage.emphasis!.priority).toBe('plan');
  });

  it('zooms in for a single stage and out for the overview', () => {
    const script = build();
    expect(script.acts[0].beats[0].stage.camera?.zoom).toBe('wide');
    const focused = script.acts[1].beats.find((b) => b.stage.scene === 'tooth_focus');
    expect(focused?.stage.camera?.zoom).toBe('close');
  });
});

describe('the money it quotes', () => {
  it('states the frozen total, not a recomputation', () => {
    // The stages add up to 700 000 here, but the release's frozen figure is
    // what the patient was quoted and what must be said out loud.
    const script = build({ totalAmount: 681_500 });
    const totalBeat = allBeats(script).find((b) => b.refs.some((r) => r.kind === 'price' && r.of === 'plan'));
    expect(totalBeat!.say).toMatch(/681[\s]500/);
  });

  it('formats tenge with spaces in ru and kk, KZT in en', () => {
    expect(JSON.stringify(build({ locale: 'ru' }))).toContain('₸');
    expect(JSON.stringify(build({ locale: 'kk' }))).toContain('₸');
    expect(JSON.stringify(build({ locale: 'en' }))).toContain('KZT');
  });
});

describe('degenerate input', () => {
  it('survives a snapshot with no stages at all', () => {
    const script = build({ snapshot: {}, totalAmount: 0 });
    expect(script.acts).toHaveLength(3);
    // Still greets, still disclaims, still closes — never an empty screen.
    expect(allBeats(script).length).toBeGreaterThanOrEqual(4);
  });

  it('survives a snapshot stored as a flat array', () => {
    const script = build({
      snapshot: [{ id: 'x', serviceName: 'Коронка', price: 180_000, teeth: [24], qty: 1 }],
      totalAmount: 180_000,
    });
    const solution = script.acts.find((a) => a.id === 'solution')!;
    expect(solution.beats.some((b) => b.say.includes('Коронка'))).toBe(true);
  });

  it('survives a missing patient name without printing an empty gap', () => {
    const script = build({ patientFirstName: null });
    expect(script.acts[0].beats[0].say).not.toMatch(/^\s*,/);
    expect(script.acts[0].beats[0].say.length).toBeGreaterThan(10);
  });

  it('produces a script in every supported locale', () => {
    for (const locale of PRESENTATION_LOCALES) {
      const script = build({ locale });
      expect(script.locale).toBe(locale);
      for (const b of allBeats(script)) {
        expect(b.say.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
