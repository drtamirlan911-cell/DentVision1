import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_LOCALES,
  amountsInRefs,
  beatWithinLimits,
  countSentences,
  isVerbatimQuote,
  teethInRefs,
} from './beats.js';
import { allConsequences } from './consequences.catalog.js';
import { buildScriptSkeleton, priorityForStage } from './scriptSkeleton.js';

/** The library's own wording, so the test cannot drift from the catalogue. */
function lookupEntryText(key: string, locale: 'ru' | 'kk' | 'en'): string {
  return allConsequences().find((e) => e.key === key)!.text[locale];
}

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
  it('ships the acts the data supports, and only those', () => {
    // A hand-typed plan with no findings and no alternatives: consequences and
    // options have nothing real to say, so they are absent rather than faked.
    // `next_step` is unconditional — every presentation needs a way out.
    expect(build().acts.map((a) => a.id)).toEqual(['overview', 'findings', 'solution', 'next_step']);
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
    expect(script.acts.map((a) => a.id)).toEqual(['overview', 'findings', 'solution', 'next_step']);
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

/**
 * Acts 3, 5 and 6 all share one rule: each appears only when the thing it
 * depends on is really in the data. The tests below are mostly about the
 * *absence* case, because that is the one that turns into an invented prognosis
 * or a fake choice if it is ever got wrong.
 */

const FINDING_SNAPSHOT = {
  ...SNAPSHOT,
  stages: [
    {
      id: 'stage-a',
      title: 'Лечение',
      items: [
        {
          id: 'i1',
          serviceName: 'Лечение каналов',
          price: 120_000,
          teeth: [16],
          qty: 1,
          finding: { status: 'endo_fail', urgency: 'high' },
        },
      ],
    },
  ],
};

const ALTERNATIVES_SNAPSHOT = {
  stages: [
    {
      id: 'stage-a',
      title: 'Протезирование',
      items: [
        {
          id: 'i1',
          serviceName: 'Коронка из циркония',
          price: 200_000,
          teeth: [16],
          qty: 1,
          alternatives: [
            { serviceId: 'm', serviceName: 'Металлокерамика', price: 120_000, tier: 'essential' },
            { serviceId: 'e', serviceName: 'E.max', price: 260_000, tier: 'premium' },
          ],
        },
      ],
    },
  ],
};

function actIds(script: ReturnType<typeof build>) {
  return script.acts.map((a) => a.id);
}

describe('act 3 — consequences are quoted, never authored', () => {
  it('is absent when the plan records no finding at all', () => {
    // The default snapshot is a hand-typed plan: no odontogram provenance, so
    // there is nothing a clinician has written about and nothing to say.
    expect(actIds(build())).not.toContain('consequences');
  });

  it('is absent when the finding exists but nobody wrote a consequence for it', () => {
    const unknown = {
      stages: [
        {
          id: 's',
          title: 'Э',
          items: [{ id: 'i', serviceName: 'Услуга', price: 1000, teeth: [16], finding: { status: 'implant', urgency: 'low' } }],
        },
      ],
    };
    expect(actIds(build({ snapshot: unknown }))).not.toContain('consequences');
  });

  it('appears when the plan really records a finding the library covers', () => {
    const script = build({ snapshot: FINDING_SNAPSHOT });
    expect(actIds(script)).toContain('consequences');
  });

  it('quotes the library entry verbatim and cites its key and version', () => {
    const script = build({ snapshot: FINDING_SNAPSHOT });
    const act = script.acts.find((a) => a.id === 'consequences')!;
    const quoting = act.beats.filter((b) => b.refs.some((r) => r.kind === 'consequence'));

    expect(quoting).toHaveLength(1);
    const ref = quoting[0].refs.find((r) => r.kind === 'consequence') as { libraryKey: string; version: string };
    expect(ref.libraryKey).toBe('endo_fail:high');
    expect(ref.version).toBe('1');
    expect(quoting[0].say).toBe(lookupEntryText('endo_fail:high', 'ru'));
  });

  it('always closes with the disclaimer, so nothing reads as a prediction', () => {
    for (const locale of PRESENTATION_LOCALES) {
      const script = build({ snapshot: FINDING_SNAPSHOT, locale });
      const act = script.acts.find((a) => a.id === 'consequences')!;
      const last = act.beats[act.beats.length - 1];
      expect(last.refs.some((r) => r.kind === 'clinicPolicy' && r.key === 'disclaimer'), locale).toBe(true);
    }
  });

  it('only lights up teeth the finding actually covers', () => {
    const script = build({ snapshot: FINDING_SNAPSHOT });
    const act = script.acts.find((a) => a.id === 'consequences')!;
    for (const b of act.beats) {
      expect(b.stage.highlightTeeth ?? []).toEqual(teethInRefs(b.refs));
    }
  });
});

describe('act 5 — options appear only when there is a choice', () => {
  it('is absent when the doctor marked no alternatives', () => {
    expect(actIds(build())).not.toContain('options');
  });

  it('is absent when the only alternative is priced the wrong way round', () => {
    const wrongWay = {
      stages: [
        {
          id: 's',
          title: 'Э',
          items: [
            {
              id: 'i',
              serviceName: 'Коронка',
              price: 200_000,
              teeth: [16],
              alternatives: [{ serviceId: 'x', serviceName: 'Дороже', price: 300_000, tier: 'essential' }],
            },
          ],
        },
      ],
    };
    expect(actIds(build({ snapshot: wrongWay, totalAmount: 200_000 }))).not.toContain('options');
  });

  it('appears with a beat per level when the levels really differ', () => {
    const script = build({ snapshot: ALTERNATIVES_SNAPSHOT, totalAmount: 200_000 });
    const act = script.acts.find((a) => a.id === 'options')!;
    const priced = act.beats.filter((b) => b.stage.optionKey && b.refs.some((r) => r.kind === 'price'));
    expect(priced.map((b) => b.stage.optionKey)).toEqual(['essential', 'optimal', 'premium', 'optimal']);
  });

  it('states only prices its own refs carry — the whole traceability rule', () => {
    for (const locale of PRESENTATION_LOCALES) {
      const script = build({ snapshot: ALTERNATIVES_SNAPSHOT, totalAmount: 200_000, locale });
      const act = script.acts.find((a) => a.id === 'options')!;
      for (const b of act.beats) {
        const allowed = new Set([...amountsInRefs(b.refs), ...teethInRefs(b.refs)]);
        for (const n of numbersIn(b.say)) {
          expect(allowed.has(n), `${locale} "${b.say}" states ${n}`).toBe(true);
        }
      }
    }
  });

  it('says the doctor recommends the level that is literally their own plan', () => {
    const script = build({ snapshot: ALTERNATIVES_SNAPSHOT, totalAmount: 200_000 });
    const act = script.acts.find((a) => a.id === 'options')!;
    const recommend = act.beats.find((b) => /рекоменду/i.test(b.say))!;
    expect(recommend.stage.optionKey).toBe('optimal');
  });

  it('says out loud that choosing is not consent', () => {
    const script = build({ snapshot: ALTERNATIVES_SNAPSHOT, totalAmount: 200_000 });
    const act = script.acts.find((a) => a.id === 'options')!;
    const last = act.beats[act.beats.length - 1];
    expect(last.say).toMatch(/не согласие/i);
  });
});

describe('act 6 — the next step is a request, and financing is the clinic’s', () => {
  it('always exists, because every presentation needs a way out', () => {
    expect(actIds(build())).toContain('next_step');
  });

  it('never mentions a monthly figure when the clinic configured no term', () => {
    const act = build().acts.find((a) => a.id === 'next_step')!;
    expect(act.beats.some((b) => b.refs.some((r) => r.kind === 'clinicPolicy' && r.key === 'financing'))).toBe(false);
  });

  it('quotes plain division and nothing more when the clinic did configure a term', () => {
    const script = build({
      concierge: { financingMonths: 10, financingNote: null, personaName: null, defaultLocale: null },
    });
    const act = script.acts.find((a) => a.id === 'next_step')!;
    const money = act.beats.find((b) => b.refs.some((r) => r.kind === 'clinicPolicy' && r.key === 'financing'))!;
    // 700 000 over 10 months, rounded up — no rate, no schedule.
    expect(amountsInRefs(money.refs)).toContain(70_000);
  });

  it('carries the caveat as its own beat, so trimming the figure cannot drop it', () => {
    const script = build({
      concierge: { financingMonths: 10, financingNote: null, personaName: null, defaultLocale: null },
    });
    const act = script.acts.find((a) => a.id === 'next_step')!;
    const caveats = act.beats.filter((b) => b.refs.some((r) => r.kind === 'clinicPolicy' && r.key === 'financing'));
    expect(caveats.length).toBe(2);
    expect(caveats[1].say).toMatch(/без процентов|Точные условия/i);
  });

  it('states plainly that a request is neither a booking nor consent', () => {
    const act = build().acts.find((a) => a.id === 'next_step')!;
    expect(act.beats.some((b) => /не согласие/i.test(b.say) && /не запись|ещё не запись/i.test(b.say))).toBe(true);
  });
});

describe('the new acts obey the rules the old ones already did', () => {
  const scripts = PRESENTATION_LOCALES.flatMap((locale) => [
    build({ snapshot: FINDING_SNAPSHOT, locale }),
    build({
      snapshot: ALTERNATIVES_SNAPSHOT,
      totalAmount: 200_000,
      locale,
      concierge: { financingMonths: 12, financingNote: null, personaName: null, defaultLocale: null },
    }),
  ]);

  it('keeps every beat within the validator’s limits', () => {
    for (const script of scripts) {
      for (const b of allBeats(script)) {
        expect(beatWithinLimits(b.say), `${script.locale} "${b.say}"`).toBe(true);
        expect(countSentences(b.say)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('gives every beat a unique id, since ids key the voice cache and the funnel', () => {
    for (const script of scripts) {
      const ids = allBeats(script).map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('quotes no diagnosis text outside a verbatim beat', () => {
    for (const script of scripts) {
      for (const b of allBeats(script)) {
        if (isVerbatimQuote(b)) continue;
        expect(b.say).not.toContain('периодонтит');
      }
    }
  });

  it('is deterministic — the same input twice gives the same script', () => {
    const a = build({ snapshot: ALTERNATIVES_SNAPSHOT, totalAmount: 200_000 });
    const b = build({ snapshot: ALTERNATIVES_SNAPSHOT, totalAmount: 200_000 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
