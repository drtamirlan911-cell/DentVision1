/**
 * The gate every LLM-rewritten line has to pass before a patient can see it.
 *
 * The generator is allowed to do exactly one thing: say the template's sentence
 * more naturally. It may not add a fact. This file is what makes that a
 * property of the system rather than a hope about a prompt — a rejected line is
 * replaced by the deterministic template, so the worst case is wooden prose,
 * never a wrong number.
 *
 * **How "no new facts" is decided.** Not by thresholds — "numbers over 1000 are
 * prices, 11–48 are teeth" is a guess that an adversarial or merely careless
 * model walks straight through ("лечение займёт 5 визитов"). Instead the
 * allowed set is exact:
 *
 *     allowed = numbers already in the template line
 *             ∪ amounts in the beat's refs
 *             ∪ teeth in the beat's refs
 *
 * Anything else the rewrite states is, by construction, something the model
 * introduced. Ordinals the skeleton legitimately writes ("Этап 2", "10 мес.")
 * are in the template, so they pass without being special-cased.
 *
 * **Quotes are not rewritten at all.** A beat carrying the doctor's own words
 * must come back byte-identical. Paraphrasing a diagnosis is authoring one.
 */

import {
  MAX_BEAT_CHARS,
  MAX_BEAT_SENTENCES,
  amountsInRefs,
  countSentences,
  isVerbatimQuote,
  teethInRefs,
  type Beat,
} from './beats.js';
import {
  FORBIDDEN_FEAR_PATTERNS,
  FORBIDDEN_PROMISE_PATTERNS,
  allConsequences,
} from './consequences.catalog.js';
import type { PresentationLocale } from './beats.js';

export type ValidationRule =
  | 'empty'
  | 'length'
  | 'sentences'
  | 'verbatim'
  | 'numbers'
  | 'teeth'
  | 'diagnosis'
  | 'promise'
  | 'fear';

export interface ValidationFailure {
  rule: ValidationRule;
  detail: string;
}

export interface ValidationResult {
  ok: boolean;
  failures: ValidationFailure[];
}

export interface ValidateBeatInput {
  /** The deterministic beat the generator was given. */
  beat: Beat;
  /** What the model returned. */
  candidate: { say: string; saySimple?: string | null };
  /** The doctor's diagnosis from the snapshot, quoted verbatim or not at all. */
  diagnosisText?: string | null;
  /** Which language the beat is in; picks the consequence text to compare with. */
  locale?: PresentationLocale;
}

/**
 * The clinical vocabulary this particular beat is entitled to use.
 *
 * The doctor's diagnosis, plus the text of any consequence-library entry the
 * beat cites. Without the second part the validator would reject its own
 * library: a consequence beat legitimately says "кариес" because a clinician
 * wrote that sentence — the beat cites it by key and version, which is exactly
 * the provenance the rule is asking for.
 */
function allowedClinicalText(beat: Beat, diagnosisText: string | null | undefined, locale: PresentationLocale): string {
  const parts = [String(diagnosisText ?? '')];
  const cited = new Set(
    beat.refs
      .filter((r): r is Extract<typeof r, { kind: 'consequence' }> => r.kind === 'consequence')
      .map((r) => r.libraryKey),
  );
  if (cited.size > 0) {
    for (const entry of allConsequences()) {
      if (cited.has(entry.key)) parts.push(entry.text[locale] ?? '');
    }
  }
  return parts.join(' ').toLowerCase();
}

/**
 * Words that name a dental diagnosis.
 *
 * Head terms rather than full ICD-10 names on purpose: a model that writes
 * "похоже на пульпит" has authored a diagnosis just as surely as one that
 * writes "Пульпит K04.0", and only the head term catches both. A test reads
 * `src/lib/icd10-data.ts` and fails if any code in that catalogue is not
 * covered here, so the list cannot quietly fall behind — and no third copy of
 * the catalogue has to exist.
 */
export const DIAGNOSIS_TERMS: readonly string[] = [
  'кариес',
  'пульпит',
  'периодонтит',
  'периапикальн',
  'гингивит',
  'пародонтит',
  'пародонтоз',
  'пародонтальн',
  'абсцесс',
  'кист',
  'гранулем',
  'гранулём',
  'остеомиелит',
  'перикоронит',
  'стоматит',
  'глоссит',
  'хейлит',
  'лейкоплаки',
  'некроз',
  'резорбци',
  'эрози',
  'абрази',
  'стираемост',
  'гиперцементоз',
  'анкилоз',
  'апексификаци',
  'альвеолит',
  'ретенц',
  'дистопи',
  'адентия',
  'сверхкомплектн',
  'гиподонти',
  'гипердонти',
  'флюороз',
  'гипоплази',
  'дисплази',
  'одонтодисплази',
  'дентиногенез',
  'амелогенез',
  'бруксизм',
  'вывих',
  'перелом',
  'трещин',
  'атрофи',
  'гипертрофи',
  'воспалени',
  'инфильтрат',
  'свищ',
  'пигментаци',
  'конкремент',
  'зубной камень',
  'галитоз',
  'ксеростоми',
  'невралги',
  'артрит',
  'артроз',
  'дисфункци',
  'опухол',
  'новообразовани',
  // Families the catalogue names with ordinary words rather than a Latin term.
  // "Болезнь", "травма", "аномалия" read as plain Russian, which is exactly why
  // a model reaches for them — and why they have to be here.
  'болезн',
  'травма',
  'травм ',
  'аномали',
  'деформац',
  'дегенерац',
  'гиперплази',
  'неправильн',
  'синдром',
  'потеря зуб',
  'отсутствие зуб',
  'ретинирован',
  'афта',
  'смыкани',
  'географический язык',
  'складчатый язык',
  'пульп',
  'пародонт',
];

/**
 * Words the catalogue contains that name a **procedure or an encounter**, not a
 * condition — "Зубное протезирование", "Экстракция зуба", "Стоматологическое
 * обследование".
 *
 * These are deliberately *not* diagnosis terms. The deterministic script says
 * "Этап 2 — протезирование" as a matter of course, and a validator that refused
 * its own template would make the whole rewrite unusable. Naming them here, and
 * asserting in the tests that they are the only uncovered entries, is what stops
 * that exclusion from quietly widening.
 */
export const NON_DIAGNOSTIC_ICD10: readonly string[] = [
  'Экстракция зуба',
  'Стоматологическое обследование',
  'Зубное протезирование',
  'Консультация по поводу неуточнённого состояния',
];

const THOUSAND_WORDS = /^(тыс|тысяч\w*|мың)$/i;
const MILLION_WORDS = /^(млн|миллион\w*|миллиард\w*)$/i;

/**
 * Every number a line states, normalised to a comparable value.
 *
 * Handles the shapes money actually takes in this product: `1 240 000` with
 * ordinary, non-breaking or narrow spaces, `1240000`, and `1,24 млн`. Without
 * the last one a model could restate a price in a form the check would not
 * recognise and slip an invented figure past — which is exactly the case worth
 * catching, because "1,24 млн" is how a person would naturally say it.
 */
export function numericTokens(text: string): number[] {
  const out: number[] = [];
  const source = String(text ?? '');
  // Thousands separators as escapes: a literal NBSP in a character class is
  // invisible in review and trips `no-irregular-whitespace`.
  const pattern = /(\d[\d \u00a0\u202f]*)(?:[.,](\d+))?\s*([A-Za-zА-Яа-яЁё]+)?/g;

  for (const match of source.matchAll(pattern)) {
    const whole = match[1].replace(/[ \u00a0\u202f]/g, '');
    if (!whole) continue;
    const fraction = match[2] ?? '';
    const word = match[3] ?? '';

    let value = Number(fraction ? `${whole}.${fraction}` : whole);
    if (!Number.isFinite(value)) continue;

    if (MILLION_WORDS.test(word)) value *= 1_000_000;
    else if (THOUSAND_WORDS.test(word)) value *= 1_000;
    else if (fraction) {
      // A decimal with no unit is not a quantity this product ever states —
      // record both readings so a rewrite cannot hide behind the punctuation.
      out.push(Number(whole));
    }

    out.push(Math.round(value));
  }
  return out;
}

/** FDI-shaped tokens: the only two-digit numbers that could name a tooth. */
function toothTokens(text: string): number[] {
  return numericTokens(text).filter((n) => n >= 11 && n <= 48 && Number.isInteger(n));
}

function checkForbidden(text: string, failures: ValidationFailure[]): void {
  for (const pattern of FORBIDDEN_PROMISE_PATTERNS) {
    if (pattern.test(text)) failures.push({ rule: 'promise', detail: `promises: ${pattern}` });
  }
  for (const pattern of FORBIDDEN_FEAR_PATTERNS) {
    if (pattern.test(text)) failures.push({ rule: 'fear', detail: `frightens: ${pattern}` });
  }
}

function checkLength(text: string, failures: ValidationFailure[]): void {
  if (text.length > MAX_BEAT_CHARS) {
    failures.push({ rule: 'length', detail: `${text.length} > ${MAX_BEAT_CHARS} characters` });
  }
  if (countSentences(text) > MAX_BEAT_SENTENCES) {
    failures.push({ rule: 'sentences', detail: `${countSentences(text)} > ${MAX_BEAT_SENTENCES} sentences` });
  }
}

/**
 * A diagnosis may appear only as the doctor's own words.
 *
 * The comparison is against the snapshot's diagnosis text, so "Хронический
 * периодонтит 16" passes in the beat that quotes it and is refused everywhere
 * else. A term the doctor never wrote is refused outright, whichever beat it
 * turns up in.
 */
function checkDiagnosis(
  text: string,
  source: string,
  failures: ValidationFailure[],
): void {
  const haystack = text.toLowerCase();
  for (const term of DIAGNOSIS_TERMS) {
    if (!haystack.includes(term)) continue;
    if (source.includes(term)) continue;
    failures.push({ rule: 'diagnosis', detail: `states "${term}", which the doctor did not write` });
  }
}

function checkProvenance(
  text: string,
  beat: Beat,
  failures: ValidationFailure[],
): void {
  const allowedNumbers = new Set<number>([
    ...numericTokens(beat.say),
    ...amountsInRefs(beat.refs),
    ...teethInRefs(beat.refs),
  ]);
  const allowedTeeth = new Set<number>([...teethInRefs(beat.refs), ...toothTokens(beat.say)]);

  for (const n of numericTokens(text)) {
    if (allowedNumbers.has(n)) continue;
    failures.push({ rule: 'numbers', detail: `states ${n}, which is in neither the template nor the refs` });
  }
  for (const fdi of toothTokens(text)) {
    if (allowedTeeth.has(fdi)) continue;
    failures.push({ rule: 'teeth', detail: `names tooth ${fdi}, which the beat does not reference` });
  }
}

/**
 * Check one rewritten beat.
 *
 * Returns every failure rather than the first: the report is shown to the
 * doctor in preview, and "this line was rejected" is far less useful than
 * "this line invented a price and promised a result".
 */
export function validateBeat(input: ValidateBeatInput): ValidationResult {
  const { beat, candidate, diagnosisText } = input;
  const clinicalSource = allowedClinicalText(beat, diagnosisText, input.locale ?? 'ru');
  const failures: ValidationFailure[] = [];
  const say = String(candidate.say ?? '').trim();

  if (!say) {
    return { ok: false, failures: [{ rule: 'empty', detail: 'the rewrite is empty' }] };
  }

  // A quote is not rewritten. Not "rewritten carefully" — not at all.
  if (isVerbatimQuote(beat)) {
    if (say !== beat.say.trim()) {
      failures.push({ rule: 'verbatim', detail: 'a quoted beat must be reproduced exactly' });
    }
    if (candidate.saySimple) {
      failures.push({ rule: 'verbatim', detail: 'a quoted beat has no simplified variant' });
    }
    return { ok: failures.length === 0, failures };
  }

  for (const text of [say, candidate.saySimple?.trim()].filter(Boolean) as string[]) {
    checkLength(text, failures);
    checkForbidden(text, failures);
    checkDiagnosis(text, clinicalSource, failures);
    checkProvenance(text, beat, failures);
  }

  return { ok: failures.length === 0, failures };
}

export interface BeatReview {
  beatId: string;
  accepted: boolean;
  failures: ValidationFailure[];
}

export interface ScriptReview {
  beats: BeatReview[];
  acceptedCount: number;
  rejectedCount: number;
  /** True when so much was refused that the whole rewrite is not worth keeping. */
  fellBackWholesale: boolean;
}

/**
 * Rejecting more than this share means the model was not rephrasing, it was
 * writing — and a script that is part template, part model reads as neither.
 */
export const WHOLESALE_FALLBACK_RATIO = 0.3;

/**
 * Apply the rewrite to a script, keeping the template wherever it was refused.
 *
 * Degradation is layered on purpose: one bad line costs that line, a bad batch
 * costs the whole rewrite. Both outcomes are a complete, playable script, which
 * is why the deterministic skeleton is the thing that ships and the model is
 * the thing layered on top.
 */
export function applyRewrite(
  beats: Beat[],
  rewrites: Map<string, { say: string; saySimple?: string | null }>,
  diagnosisText?: string | null,
  locale: PresentationLocale = 'ru',
): { beats: Beat[]; review: ScriptReview } {
  const reviews: BeatReview[] = [];
  const applied: Beat[] = [];

  for (const beat of beats) {
    const candidate = rewrites.get(beat.id);
    if (!candidate) {
      applied.push(beat);
      continue;
    }
    const result = validateBeat({ beat, candidate, diagnosisText, locale });
    reviews.push({ beatId: beat.id, accepted: result.ok, failures: result.failures });
    applied.push(
      result.ok
        ? {
            ...beat,
            say: candidate.say.trim(),
            ...(candidate.saySimple ? { saySimple: candidate.saySimple.trim() } : {}),
          }
        : beat,
    );
  }

  const rejectedCount = reviews.filter((r) => !r.accepted).length;
  const fellBackWholesale =
    reviews.length > 0 && rejectedCount / reviews.length > WHOLESALE_FALLBACK_RATIO;

  return {
    beats: fellBackWholesale ? beats : applied,
    review: {
      beats: reviews,
      acceptedCount: reviews.length - rejectedCount,
      rejectedCount,
      fellBackWholesale,
    },
  };
}
