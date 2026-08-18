/**
 * Turns an approved, frozen plan into a presentation script — deterministically.
 *
 * No LLM, no I/O, no randomness. Every sentence comes from a template and every
 * number from the snapshot, so this cannot invent a diagnosis, a tooth or a
 * price. That is not a limitation to be lifted later: a later LLM pass may only
 * *rephrase* these lines, checked against each beat's `refs`, and when it fails
 * the check these lines are what the patient hears.
 *
 * Scope here is acts 1, 2 and 4 — the plan's own content. Consequences (act 3)
 * need a clinician-written library, options (act 5) need alternatives the doctor
 * marked, and the next step (act 6) needs the funnel. Each arrives with the
 * thing it depends on rather than being faked now.
 *
 * **Where priority comes from.** From the order of the stages the doctor set,
 * not from a rule engine's opinion about a tooth. The clinician's staging *is*
 * the priority; re-deriving it would put a machine clinical judgement in front
 * of a patient, which is exactly what this layer exists to prevent.
 */

import {
  enrichStages,
  lineItemTotal,
  normalizePlanItems,
  stageTotal,
  type TreatmentPlanItems,
  type TreatmentPlanStage,
} from '../../lib/treatmentPlanShape.js';
import {
  estimateBeatMs,
  type Beat,
  type BeatPriority,
  type BeatRef,
  type PresentationAct,
  type PresentationLocale,
  type PresentationScript,
} from './beats.js';

export interface BuildScriptInput {
  releaseId: string;
  snapshot: unknown;
  patientFirstName?: string | null;
  clinicName?: string | null;
  doctorName?: string | null;
  personaName?: string | null;
  locale?: PresentationLocale;
  totalAmount?: number | null;
}

export const DEFAULT_PERSONA_NAME = 'Aura';

/** The doctor's staging, read as priority. */
export function priorityForStage(index: number): BeatPriority {
  if (index === 0) return 'now';
  if (index === 1) return 'plan';
  return 'watch';
}

function formatTenge(amount: number, locale: PresentationLocale): string {
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return locale === 'en' ? `${grouped} KZT` : `${grouped} ₸`;
}

function formatTeeth(teeth: number[]): string {
  return [...teeth].sort((a, b) => a - b).join(', ');
}

interface Copy {
  actOverview: string;
  actFindings: string;
  actSolution: string;
  greeting: (name: string, clinic: string) => string;
  personaIntro: (persona: string, doctor: string | null) => string;
  notADoctor: string;
  overviewCount: (zones: number) => string;
  noFindings: string;
  priorityLabel: Record<BeatPriority, string>;
  findingLine: (teeth: string, label: string) => string;
  findingLineSimple: (teeth: string) => string;
  stageLine: (n: number, title: string, services: string) => string;
  stageCaption: (n: number) => string;
  totalLine: (total: string, stages: number) => string;
  closing: (doctor: string | null) => string;
  diagnosisLine: (diagnosis: string) => string;
}

const COPY: Record<PresentationLocale, Copy> = {
  ru: {
    actOverview: 'Ваш план лечения',
    actFindings: 'Что мы увидели',
    actSolution: 'Что предлагает врач',
    greeting: (name, clinic) =>
      name ? `${name}, это ваш персональный план лечения в клинике «${clinic}».` : `Это ваш персональный план лечения в клинике «${clinic}».`,
    personaIntro: (persona, doctor) =>
      doctor
        ? `Меня зовут ${persona}, я ассистент клиники. План составил ваш врач — ${doctor}.`
        : `Меня зовут ${persona}, я ассистент клиники. План составил ваш лечащий врач.`,
    notADoctor:
      'Я не ставлю диагноз и не назначаю лечение — я помогаю разобраться в том, что предложил врач. Все решения принимает он.',
    overviewCount: (zones) =>
      zones === 1
        ? 'Есть одна зона, которой стоит уделить внимание.'
        : `Есть ${zones} зоны, которым стоит уделить внимание. Они не одинаково срочные.`,
    noFindings: 'В этом плане врач не отметил отдельных зубов — посмотрим этапы лечения.',
    priorityLabel: { now: 'Лечить в первую очередь', plan: 'Запланировать', watch: 'Наблюдать' },
    findingLine: (teeth, label) => `${label}: ${teeth}.`,
    findingLineSimple: (teeth) => `Вот эти зубы: ${teeth}.`,
    stageLine: (n, title, services) => `Этап ${n} — ${title}. Врач предлагает: ${services}.`,
    stageCaption: (n) => `Этап ${n}`,
    totalLine: (total, stages) =>
      stages === 1
        ? `Весь план — один этап, ${total}.`
        : `Всего ${stages} этапа, вместе — ${total}.`,
    closing: (doctor) =>
      doctor
        ? `Если что-то осталось непонятным, спросите меня или напишите врачу — ${doctor}.`
        : 'Если что-то осталось непонятным, спросите меня или напишите вашему врачу.',
    diagnosisLine: (diagnosis) => `Врач записал: ${diagnosis}.`,
  },
  kk: {
    actOverview: 'Сіздің емдеу жоспарыңыз',
    actFindings: 'Біз не байқадық',
    actSolution: 'Дәрігер не ұсынады',
    greeting: (name, clinic) =>
      name ? `${name}, бұл «${clinic}» клиникасындағы жеке емдеу жоспарыңыз.` : `Бұл «${clinic}» клиникасындағы жеке емдеу жоспарыңыз.`,
    personaIntro: (persona, doctor) =>
      doctor
        ? `Менің атым ${persona}, мен клиника ассистентімін. Жоспарды дәрігеріңіз — ${doctor} — құрды.`
        : `Менің атым ${persona}, мен клиника ассистентімін. Жоспарды емдеуші дәрігеріңіз құрды.`,
    notADoctor:
      'Мен диагноз қоймаймын және ем тағайындамаймын — дәрігер ұсынғанды түсінуге көмектесемін. Барлық шешімді дәрігер қабылдайды.',
    overviewCount: (zones) =>
      zones === 1
        ? 'Назар аударуға тұрарлық бір аймақ бар.'
        : `Назар аударуға тұрарлық ${zones} аймақ бар. Олардың шұғылдығы бірдей емес.`,
    noFindings: 'Бұл жоспарда дәрігер жеке тістерді белгілемеген — емдеу кезеңдерін қарайық.',
    priorityLabel: { now: 'Бірінші кезекте емдеу', plan: 'Жоспарлау', watch: 'Бақылау' },
    findingLine: (teeth, label) => `${label}: ${teeth}.`,
    findingLineSimple: (teeth) => `Мына тістер: ${teeth}.`,
    stageLine: (n, title, services) => `${n}-кезең — ${title}. Дәрігер ұсынады: ${services}.`,
    stageCaption: (n) => `${n}-кезең`,
    totalLine: (total, stages) =>
      stages === 1 ? `Бүкіл жоспар — бір кезең, ${total}.` : `Барлығы ${stages} кезең, жиыны — ${total}.`,
    closing: (doctor) =>
      doctor
        ? `Түсініксіз нәрсе қалса, менен сұраңыз немесе дәрігерге — ${doctor} — жазыңыз.`
        : 'Түсініксіз нәрсе қалса, менен сұраңыз немесе дәрігеріңізге жазыңыз.',
    diagnosisLine: (diagnosis) => `Дәрігер жазып қойған: ${diagnosis}.`,
  },
  en: {
    actOverview: 'Your treatment plan',
    actFindings: 'What we found',
    actSolution: 'What your doctor proposes',
    greeting: (name, clinic) =>
      name ? `${name}, this is your personal treatment plan at ${clinic}.` : `This is your personal treatment plan at ${clinic}.`,
    personaIntro: (persona, doctor) =>
      doctor
        ? `I am ${persona}, the clinic's assistant. Your doctor, ${doctor}, put this plan together.`
        : `I am ${persona}, the clinic's assistant. Your treating doctor put this plan together.`,
    notADoctor:
      'I do not diagnose or prescribe — I help you understand what your doctor proposed. Every decision is theirs.',
    overviewCount: (zones) =>
      zones === 1
        ? 'There is one area worth attention.'
        : `There are ${zones} areas worth attention, and they are not equally urgent.`,
    noFindings: 'Your doctor did not single out individual teeth here — let us look at the stages instead.',
    priorityLabel: { now: 'Treat first', plan: 'Schedule', watch: 'Keep an eye on' },
    findingLine: (teeth, label) => `${label}: ${teeth}.`,
    findingLineSimple: (teeth) => `These teeth: ${teeth}.`,
    stageLine: (n, title, services) => `Stage ${n} — ${title}. Your doctor proposes: ${services}.`,
    stageCaption: (n) => `Stage ${n}`,
    totalLine: (total, stages) =>
      stages === 1 ? `The whole plan is a single stage, ${total}.` : `${stages} stages in total, ${total} together.`,
    closing: (doctor) =>
      doctor
        ? `If anything is unclear, ask me or message your doctor, ${doctor}.`
        : 'If anything is unclear, ask me or message your doctor.',
    diagnosisLine: (diagnosis) => `Your doctor noted: ${diagnosis}.`,
  },
};

function beat(
  actId: Beat['actId'],
  order: number,
  say: string,
  stage: Beat['stage'],
  refs: BeatRef[],
  extra: Partial<Pick<Beat, 'saySimple' | 'caption' | 'interrupt'>> = {},
): Beat {
  return {
    id: `${actId}-${order}`,
    actId,
    order,
    say,
    estimatedMs: estimateBeatMs(say),
    stage,
    refs,
    interrupt: { allowed: true },
    ...extra,
  };
}

function teethOfStage(stage: TreatmentPlanStage): number[] {
  const set = new Set<number>();
  for (const item of stage.items || []) {
    for (const tooth of item.teeth || []) set.add(tooth);
  }
  return [...set].sort((a, b) => a - b);
}

function serviceNames(stage: TreatmentPlanStage): string[] {
  const names: string[] = [];
  for (const item of stage.items || []) {
    const name = item.serviceName || item.name;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function buildScriptSkeleton(input: BuildScriptInput): PresentationScript {
  const locale = input.locale ?? 'ru';
  const copy = COPY[locale];
  const persona = input.personaName || DEFAULT_PERSONA_NAME;
  const clinic = input.clinicName || (locale === 'ru' ? 'клиника' : locale === 'kk' ? 'клиника' : 'the clinic');
  const doctor = input.doctorName || null;

  const items: TreatmentPlanItems = normalizePlanItems(input.snapshot);
  const stages = enrichStages(items.stages);
  const total = input.totalAmount ?? stages.reduce((sum, s) => sum + stageTotal(s), 0);

  const acts: PresentationAct[] = [];

  // ── Act 1: who this is, what it is, and what I am not ────────────────────
  const allTeeth = stages.flatMap(teethOfStage);
  const uniqueTeeth = [...new Set(allTeeth)].sort((a, b) => a - b);

  const overview: Beat[] = [
    beat('overview', 1, copy.greeting(input.patientFirstName?.trim() || '', clinic), {
      scene: 'arches',
      camera: { focus: 'full_arches', zoom: 'wide' },
    }, []),
    beat('overview', 2, copy.personaIntro(persona, doctor), {
      scene: 'arches',
      camera: { focus: 'full_arches', zoom: 'wide' },
    }, []),
    // Hard-coded rather than generated, so it survives even total LLM failure:
    // the persona must never read as a doctor.
    beat('overview', 3, copy.notADoctor, {
      scene: 'arches',
      camera: { focus: 'full_arches', zoom: 'wide' },
    }, [{ kind: 'clinicPolicy', key: 'disclaimer' }]),
  ];

  if (items.diagnosis) {
    // Quoted verbatim. The concierge never re-authors a diagnosis.
    overview.push(
      beat('overview', 4, copy.diagnosisLine(String(items.diagnosis).trim()), {
        scene: 'arches',
        camera: { focus: 'full_arches', zoom: 'wide' },
      }, [{ kind: 'diagnosisText' }]),
    );
  }

  acts.push({ id: 'overview', title: copy.actOverview, beats: overview });

  // ── Act 2: the findings, ordered by the doctor's own staging ─────────────
  const findings: Beat[] = [];
  if (uniqueTeeth.length === 0) {
    findings.push(
      beat('findings', 1, copy.noFindings, { scene: 'arches', camera: { focus: 'full_arches', zoom: 'wide' } }, []),
    );
  } else {
    findings.push(
      beat('findings', 1, copy.overviewCount(uniqueTeeth.length), {
        scene: 'arches',
        highlightTeeth: uniqueTeeth,
        camera: { focus: 'teeth', zoom: 'medium' },
      }, uniqueTeeth.map((fdi): BeatRef => ({ kind: 'tooth', fdi }))),
    );

    let order = 2;
    stages.forEach((stage, index) => {
      const teeth = teethOfStage(stage);
      if (teeth.length === 0) return;
      const priority = priorityForStage(index);
      findings.push(
        beat('findings', order, copy.findingLine(formatTeeth(teeth), copy.priorityLabel[priority]), {
          scene: 'tooth_focus',
          highlightTeeth: teeth,
          emphasis: { priority },
          camera: { focus: 'teeth', zoom: 'close' },
          stageId: stage.id,
        }, [
          ...teeth.map((fdi): BeatRef => ({ kind: 'tooth', fdi })),
          { kind: 'stage', stageId: String(stage.id) },
        ], {
          saySimple: copy.findingLineSimple(formatTeeth(teeth)),
          caption: { text: copy.priorityLabel[priority], kind: 'label' },
        }),
      );
      order += 1;
    });
  }
  acts.push({ id: 'findings', title: copy.actFindings, beats: findings });

  // ── Act 4: the doctor's stages, and only then the total ──────────────────
  const solution: Beat[] = [];
  stages.forEach((stage, index) => {
    const names = serviceNames(stage);
    if (names.length === 0) return;
    const teeth = teethOfStage(stage);
    const cost = stageTotal(stage);
    solution.push(
      beat('solution', index + 1, copy.stageLine(index + 1, String(stage.title || ''), names.join(', ')), {
        scene: 'timeline',
        highlightTeeth: teeth,
        emphasis: { priority: priorityForStage(index) },
        camera: { focus: teeth.length ? 'teeth' : 'none', zoom: 'medium' },
        stageId: stage.id,
      }, [
        { kind: 'stage', stageId: String(stage.id) },
        { kind: 'price', amount: cost, of: 'stage', id: String(stage.id) },
        ...teeth.map((fdi): BeatRef => ({ kind: 'tooth', fdi })),
        ...(stage.items || []).map((item): BeatRef => ({
          kind: 'lineItem',
          stageId: String(stage.id),
          itemId: String(item.id),
        })),
        ...(stage.items || []).map((item): BeatRef => ({
          kind: 'price',
          amount: lineItemTotal(item),
          of: 'item',
          id: String(item.id),
        })),
      ], {
        caption: { text: copy.stageCaption(index + 1), kind: 'stage' },
      }),
    );
  });

  const pricedStages = solution.length;
  if (pricedStages > 0) {
    solution.push(
      beat('solution', pricedStages + 1, copy.totalLine(formatTenge(total, locale), pricedStages), {
        scene: 'timeline',
        camera: { focus: 'none' },
      }, [{ kind: 'price', amount: total, of: 'plan' }], {
        caption: { text: formatTenge(total, locale), kind: 'price' },
      }),
    );
  }

  solution.push(
    beat('solution', solution.length + 1, copy.closing(doctor), {
      scene: 'closing',
      camera: { focus: 'full_arches', zoom: 'wide' },
    }, [{ kind: 'clinicPolicy', key: 'contact' }]),
  );

  acts.push({ id: 'solution', title: copy.actSolution, beats: solution });

  return {
    version: 1,
    locale,
    releaseId: input.releaseId,
    personaName: persona,
    acts,
  };
}
