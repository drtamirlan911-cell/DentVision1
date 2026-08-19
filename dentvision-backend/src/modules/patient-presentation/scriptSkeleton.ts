/**
 * Turns an approved, frozen plan into a presentation script — deterministically.
 *
 * No LLM, no I/O, no randomness. Every sentence comes from a template and every
 * number from the snapshot, so this cannot invent a diagnosis, a tooth or a
 * price. That is not a limitation to be lifted later: a later LLM pass may only
 * *rephrase* these lines, checked against each beat's `refs`, and when it fails
 * the check these lines are what the patient hears.
 *
 * All six acts, and each of the three that were deferred appears only when the
 * thing it depends on is really there: consequences (act 3) when the plan
 * records a finding a clinician has written an entry for, options (act 5) when
 * the doctor marked alternatives that actually differ in price, financing (in
 * act 6) when the clinic entered a term. A plan with none of those still plays
 * — it simply has fewer acts, which is honest rather than degraded.
 *
 * **Where priority comes from.** From the order of the stages the doctor set,
 * not from a rule engine's opinion about a tooth. The clinician's staging *is*
 * the priority; re-deriving it would put a machine clinical judgement in front
 * of a patient, which is exactly what this layer exists to prevent.
 */

import {
  collectPlanFindings,
  enrichStages,
  lineItemTotal,
  normalizePlanItems,
  stageTotal,
  type TreatmentPlanItems,
  type TreatmentPlanStage,
} from '../../lib/treatmentPlanShape.js';
import { buildPlanOptions, presentableOptions, type PlanOption, type PlanOptionKey } from '../../lib/planOptions.js';
import { CONSEQUENCE_DISCLAIMER, lookupConsequence } from './consequences.catalog.js';
import { monthlyFigure, type ConciergeSettings } from './conciergeSettings.js';
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
  /** The clinic's own concierge configuration; absent means nothing enabled. */
  concierge?: ConciergeSettings | null;
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
  actConsequences: string;
  actOptions: string;
  actNextStep: string;
  consequenceIntro: string;
  consequenceDisclaimer: string;
  optionsIntro: string;
  optionLabel: Record<PlanOptionKey, string>;
  optionLine: (label: string, total: string) => string;
  optionRecommended: (label: string) => string;
  optionsNotConsent: string;
  financingLine: (monthly: string, months: number) => string;
  financingCaveat: string;
  nextStepLine: string;
  nextStepRequestOnly: string;
  nextStepPrint: string;
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
    actConsequences: 'Почему это важно',
    actOptions: 'Варианты',
    actNextStep: 'Следующий шаг',
    consequenceIntro: 'Коротко о том, почему врач предлагает не откладывать.',
    consequenceDisclaimer: CONSEQUENCE_DISCLAIMER.ru,
    optionsIntro: 'У части работ есть альтернативы из прайса клиники — можно собрать план по-разному.',
    optionLabel: { essential: 'Базовый', optimal: 'Рекомендованный', premium: 'Расширенный' },
    optionLine: (label, total) => `${label} — ${total}.`,
    optionRecommended: (label) => `Врач рекомендует «${label}» — это тот состав, который он собрал для вас.`,
    optionsNotConsent:
      'Выбор здесь ни к чему не обязывает: это не согласие на лечение, а способ обсудить план с врачом.',
    financingLine: (monthly, months) => `Если разбить сумму на ${months} мес., получится около ${monthly} в месяц.`,
    financingCaveat: 'Это простое деление суммы, без процентов. Точные условия — в клинике.',
    nextStepLine: 'Если план понятен, можно оставить заявку на приём — удобное время подберём вместе.',
    nextStepRequestOnly:
      'Заявка — это ещё не запись: клиника перезвонит и подтвердит время. И это не согласие на лечение.',
    nextStepPrint: 'План можно сохранить или распечатать, чтобы обсудить дома.',
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
    actConsequences: 'Бұл неге маңызды',
    actOptions: 'Нұсқалар',
    actNextStep: 'Келесі қадам',
    consequenceIntro: 'Дәрігер неге кейінге қалдырмауды ұсынатыны туралы қысқаша.',
    consequenceDisclaimer: CONSEQUENCE_DISCLAIMER.kk,
    optionsIntro: 'Кейбір жұмыстардың клиника прайсында баламасы бар — жоспарды әртүрлі жинауға болады.',
    optionLabel: { essential: 'Базалық', optimal: 'Ұсынылған', premium: 'Кеңейтілген' },
    optionLine: (label, total) => `${label} — ${total}.`,
    optionRecommended: (label) => `Дәрігер «${label}» нұсқасын ұсынады — сізге дәл осы құрамды жинаған.`,
    optionsNotConsent:
      'Мұндағы таңдау ешнәрсеге міндеттемейді: бұл емге келісім емес, дәрігермен талқылау тәсілі.',
    financingLine: (monthly, months) => `Соманы ${months} айға бөлсек, айына шамамен ${monthly} шығады.`,
    financingCaveat: 'Бұл — пайызсыз қарапайым бөлу. Нақты шарттар клиникада.',
    nextStepLine: 'Жоспар түсінікті болса, қабылдауға өтінім қалдыруға болады — уақытын бірге таңдаймыз.',
    nextStepRequestOnly:
      'Өтінім — әлі жазылу емес: клиника хабарласып, уақытты растайды. Бұл емге келісім де емес.',
    nextStepPrint: 'Жоспарды сақтап немесе басып шығарып, үйде талқылауға болады.',
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
    actConsequences: 'Why this matters',
    actOptions: 'Options',
    actNextStep: 'Next step',
    consequenceIntro: 'Briefly, why your doctor suggests not putting this off.',
    consequenceDisclaimer: CONSEQUENCE_DISCLAIMER.en,
    optionsIntro: 'Some of this work has alternatives in the clinic price list, so the plan can be put together differently.',
    optionLabel: { essential: 'Essential', optimal: 'Recommended', premium: 'Extended' },
    optionLine: (label, total) => `${label} — ${total}.`,
    optionRecommended: (label) => `Your doctor recommends "${label}" — that is the combination they put together for you.`,
    optionsNotConsent:
      'Choosing here commits you to nothing: this is not consent to treatment, it is a way to discuss the plan with your doctor.',
    financingLine: (monthly, months) => `Split across ${months} months, that is roughly ${monthly} a month.`,
    financingCaveat: 'That is a plain division of the total, with no interest. Exact terms are agreed at the clinic.',
    nextStepLine: 'If the plan makes sense, you can send a request for an appointment and we will find a time together.',
    nextStepRequestOnly:
      'A request is not a booking yet: the clinic will call to confirm the time. It is not consent to treatment either.',
    nextStepPrint: 'You can save or print the plan to talk it over at home.',
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

  // ── Act 3: consequences — quoted from the library, never authored ────────
  //
  // A beat appears only where the plan really records the finding *and* a
  // clinician has written an entry for it. A plan typed by hand carries no
  // findings, so it simply has no consequences act — that is the correct
  // outcome, not a degraded one, because the alternative is inventing a
  // prognosis for a patient out of a service name.
  const consequences: Beat[] = [];
  const findingsInPlan = collectPlanFindings(stages);
  const quotable = findingsInPlan
    .map((f) => ({ ...f, entry: lookupConsequence(f.finding.status, f.finding.urgency) }))
    .filter((f) => f.entry !== null);

  if (quotable.length > 0) {
    consequences.push(
      beat('consequences', 1, copy.consequenceIntro, {
        scene: 'arches',
        camera: { focus: 'full_arches', zoom: 'wide' },
      }, []),
    );
    quotable.forEach((f, index) => {
      const entry = f.entry!;
      consequences.push(
        beat('consequences', index + 2, entry.text[locale], {
          scene: f.teeth.length ? 'tooth_focus' : 'arches',
          highlightTeeth: f.teeth,
          emphasis: { priority: f.finding.urgency === 'high' ? 'now' : f.finding.urgency === 'medium' ? 'plan' : 'watch' },
          camera: { focus: f.teeth.length ? 'teeth' : 'full_arches', zoom: f.teeth.length ? 'close' : 'wide' },
        }, [
          { kind: 'consequence', libraryKey: entry.key, version: entry.version },
          ...f.teeth.map((fdi): BeatRef => ({ kind: 'tooth', fdi })),
        ]),
      );
    });
    // Not optional and not merged into the last line: the patient has to be
    // told plainly that none of the above was a prediction about them.
    consequences.push(
      beat('consequences', quotable.length + 2, copy.consequenceDisclaimer, {
        scene: 'arches',
        camera: { focus: 'full_arches', zoom: 'wide' },
      }, [{ kind: 'clinicPolicy', key: 'disclaimer' }]),
    );
    acts.push({ id: 'consequences', title: copy.actConsequences, beats: consequences });
  }

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

  // ── Act 5: options — only when there is a real choice to make ────────────
  //
  // The three levels come from `buildPlanOptions`, which uses the plan's own
  // arithmetic, so a level cannot disagree with the plan about a price. When
  // the doctor marked no alternatives all three levels are identical, and the
  // act is skipped: three identical prices is a worse screen than one price.
  const options: PlanOption[] = Array.isArray((items as { options?: PlanOption[] }).options)
    ? (items as { options?: PlanOption[] }).options!
    : buildPlanOptions(stages);
  const shown = presentableOptions(options);

  if (shown.length > 1) {
    const optionBeats: Beat[] = [
      beat('options', 1, copy.optionsIntro, {
        scene: 'options',
        camera: { focus: 'none' },
      }, []),
    ];
    shown.forEach((option, index) => {
      optionBeats.push(
        beat('options', index + 2, copy.optionLine(copy.optionLabel[option.key], formatTenge(option.total, locale)), {
          scene: 'options',
          camera: { focus: 'none' },
          optionKey: option.key,
        }, [{ kind: 'price', amount: option.total, of: 'option', id: option.key }], {
          caption: { text: formatTenge(option.total, locale), kind: 'price' },
        }),
      );
    });
    // Said only because `optimal` *is* the doctor's own composition — this is
    // a fact about the data, not a sales line.
    optionBeats.push(
      beat('options', shown.length + 2, copy.optionRecommended(copy.optionLabel.optimal), {
        scene: 'options',
        camera: { focus: 'none' },
        optionKey: 'optimal',
      }, [{ kind: 'price', amount: options.find((o) => o.key === 'optimal')?.total ?? total, of: 'option', id: 'optimal' }]),
    );
    optionBeats.push(
      beat('options', shown.length + 3, copy.optionsNotConsent, {
        scene: 'options',
        camera: { focus: 'none' },
      }, [{ kind: 'clinicPolicy', key: 'disclaimer' }]),
    );
    acts.push({ id: 'options', title: copy.actOptions, beats: optionBeats });
  }

  // ── Act 6: the next step — a request, never a booking, never consent ─────
  const nextStep: Beat[] = [];
  const months = input.concierge?.financingMonths ?? null;
  const monthly = months ? monthlyFigure(total, months) : 0;

  if (months && monthly > 0) {
    // Plain division, no rate, no schedule — and the caveat is a separate beat
    // so it cannot be dropped by trimming the first one.
    nextStep.push(
      beat('next_step', 1, copy.financingLine(formatTenge(monthly, locale), months), {
        scene: 'closing',
        camera: { focus: 'none' },
      }, [
        { kind: 'price', amount: monthly, of: 'plan' },
        { kind: 'clinicPolicy', key: 'financing' },
      ], {
        caption: { text: formatTenge(monthly, locale), kind: 'price' },
      }),
    );
    nextStep.push(
      beat('next_step', 2, copy.financingCaveat, {
        scene: 'closing',
        camera: { focus: 'none' },
      }, [{ kind: 'clinicPolicy', key: 'financing' }]),
    );
  }

  nextStep.push(
    beat('next_step', nextStep.length + 1, copy.nextStepLine, {
      scene: 'closing',
      camera: { focus: 'full_arches', zoom: 'wide' },
    }, [{ kind: 'clinicPolicy', key: 'contact' }]),
  );
  // Hard-coded, like the "I am not a doctor" line: a patient who watched six
  // acts and tapped a button has not consented to treatment, and that has to
  // survive even a total failure of the LLM pass.
  nextStep.push(
    beat('next_step', nextStep.length + 1, copy.nextStepRequestOnly, {
      scene: 'closing',
      camera: { focus: 'none' },
    }, [{ kind: 'clinicPolicy', key: 'disclaimer' }]),
  );
  nextStep.push(
    beat('next_step', nextStep.length + 1, copy.nextStepPrint, {
      scene: 'closing',
      camera: { focus: 'none' },
    }, [{ kind: 'clinicPolicy', key: 'contact' }]),
  );
  acts.push({ id: 'next_step', title: copy.actNextStep, beats: nextStep });

  return {
    version: 1,
    locale,
    releaseId: input.releaseId,
    personaName: persona,
    acts,
  };
}
